-- Step 11: المالك + استلام الأمر + التذكيرات + سجل العمليات + تاريخ اعتماد المهام
-- شغّله مرة واحدة في Supabase > SQL Editor (بعد step8 و step10)

-- ───────── 1) المالك (Owner) ─────────
alter table profiles add column if not exists is_owner boolean not null default false;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from profiles where id = auth.uid() and is_active), false)
$$;

-- المالك له صلاحية تعديل/حذف الأوامر تلقائيًا + أي إداري المالك فعّلها له
create or replace function public.can_manage_orders() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (is_owner or can_manage_orders) from profiles
                   where id = auth.uid() and is_active and role::text = 'admin'), false)
$$;
grant execute on function public.is_owner() to authenticated;

-- إدارة المستخدمين (الدور / التفعيل / الصلاحيات) للمالك بس
create or replace function public.guard_profile_flags() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role
          or new.is_active is distinct from old.is_active
          or new.can_manage_orders is distinct from old.can_manage_orders
          or new.is_owner is distinct from old.is_owner)
     and not public.is_owner() then
    raise exception 'إدارة المستخدمين والأدوار للمالك بس';
  end if;
  return new;
end $$;
-- (الـ trigger trg_guard_profile_flags اتعمل في step10 وهيستخدم الدالة دي)

-- ───────── 2) دالة إرسال إشعار لمجموعة مستخدمين (للاستخدام الداخلي بس) ─────────
create or replace function public.push_to_users(ttl text, bdy text, wo uuid, uids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  nid uuid;
  has_cb boolean;
  creator uuid;
begin
  if uids is null or coalesce(array_length(uids, 1), 0) = 0 then return; end if;
  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'notifications' and column_name = 'created_by') into has_cb;
  if has_cb then
    creator := coalesce(auth.uid(), (select id from profiles where role::text = 'admin' and is_active order by is_owner desc limit 1));
    execute 'insert into notifications (title, body, work_order_id, created_by) values ($1, $2, $3, $4) returning id'
      into nid using ttl, bdy, wo, creator;
  else
    insert into notifications (title, body, work_order_id) values (ttl, bdy, wo) returning id into nid;
  end if;
  insert into notification_recipients (notification_id, user_id) select nid, unnest(uids);
end $$;
revoke all on function public.push_to_users(text, text, uuid, uuid[]) from public, anon, authenticated;

create or replace function public.admin_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from profiles where role::text = 'admin' and is_active
$$;
revoke all on function public.admin_ids() from public, anon, authenticated;

-- ───────── 3) "استلمت الأمر" ─────────
alter table work_order_techs add column if not exists acknowledged_at timestamptz;

create or replace function public.notify_ack() returns trigger
language plpgsql security definer set search_path = public as $$
declare o work_orders%rowtype; nm text;
begin
  if new.acknowledged_at is not null and old.acknowledged_at is null then
    begin
      select * into o from work_orders where id = new.work_order_id;
      select full_name into nm from profiles where id = new.tech_id;
      perform public.push_to_users(
        '✓ ' || coalesce(nm, 'الفني') || ' استلم أمر #' || o.order_no,
        'العميل: ' || o.client_name || E'\nالميعاد: ' ||
        to_char(o.scheduled_at at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI'),
        o.id, public.admin_ids());
    exception when others then
      raise warning 'notify_ack failed: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_ack on work_order_techs;
create trigger trg_notify_ack after update on work_order_techs
  for each row execute function public.notify_ack();

-- ───────── 4) تاريخ اعتماد المهمة (لتقرير البونص الشهري) ─────────
alter table work_order_tasks add column if not exists reviewed_at timestamptz;

create or replace function public.set_task_reviewed_at() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    new.reviewed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_task_reviewed_at on work_order_tasks;
create trigger trg_task_reviewed_at before update on work_order_tasks
  for each row execute function public.set_task_reviewed_at();

-- المهام المعتمدة قبل كده: نعتبر تاريخها = ميعاد أمر الشغل
update work_order_tasks t set reviewed_at = w.scheduled_at
  from work_orders w
 where w.id = t.work_order_id and t.status = 'approved' and t.reviewed_at is null;

-- ───────── 5) التذكيرات التلقائية ─────────
create table if not exists reminder_log (
  work_order_id uuid not null,
  tech_id       uuid not null,   -- 00000000-… = تذكير للإدارة
  kind          text not null,
  sent_at       timestamptz not null default now(),
  primary key (work_order_id, tech_id, kind)
);
alter table reminder_log enable row level security;   -- مفيش policies: داخلي بس

create or replace function public.send_order_reminders() returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  zero constant uuid := '00000000-0000-0000-0000-000000000000';
  names text;
  tstr text;
begin
  -- (أ) قبل الميعاد بيوم: للفني + رسالة واحدة للإدارة
  for r in
    select w.id, w.order_no, w.client_name, w.scheduled_at, t.tech_id
      from work_orders w join work_order_techs t on t.work_order_id = w.id
     where w.status::text not in ('done', 'completed', 'finished', 'cancelled')
       and t.arrived_at is null
       and w.scheduled_at >  now() + interval '23 hours'
       and w.scheduled_at <= now() + interval '24 hours'
  loop
    tstr := to_char(r.scheduled_at at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI');
    insert into reminder_log (work_order_id, tech_id, kind) values (r.id, r.tech_id, 'day') on conflict do nothing;
    if found then
      perform public.push_to_users('تذكير: بكرة عندك أمر شغل #' || r.order_no,
        'العميل: ' || r.client_name || E'\nالميعاد: ' || tstr, r.id, array[r.tech_id]);
    end if;
    insert into reminder_log (work_order_id, tech_id, kind) values (r.id, zero, 'day_admin') on conflict do nothing;
    if found then
      select string_agg(p.full_name, '، ') into names
        from work_order_techs x join profiles p on p.id = x.tech_id where x.work_order_id = r.id;
      perform public.push_to_users('تذكير: بكرة أمر شغل #' || r.order_no,
        'العميل: ' || r.client_name || E'\nالميعاد: ' || tstr || E'\nالفنيين: ' || coalesce(names, '—'),
        r.id, public.admin_ids());
    end if;
  end loop;

  -- (ب) قبل الميعاد بساعة: للفني اللي لسه ماوصلش
  for r in
    select w.id, w.order_no, w.client_name, w.location_text, w.scheduled_at, t.tech_id
      from work_orders w join work_order_techs t on t.work_order_id = w.id
     where w.status::text not in ('done', 'completed', 'finished', 'cancelled')
       and t.arrived_at is null
       and w.scheduled_at >  now()
       and w.scheduled_at <= now() + interval '1 hour'
  loop
    insert into reminder_log (work_order_id, tech_id, kind) values (r.id, r.tech_id, 'hour') on conflict do nothing;
    if found then
      perform public.push_to_users('⏰ باقي أقل من ساعة على أمر #' || r.order_no,
        'العميل: ' || r.client_name || E'\nالعنوان: ' || r.location_text || E'\nالميعاد: ' ||
        to_char(r.scheduled_at at time zone 'Africa/Cairo', 'HH24:MI'), r.id, array[r.tech_id]);
    end if;
  end loop;

  -- (ج) تأخير: عدّى 15 دقيقة على الميعاد والفني ماضغطش "وصلت" => تنبيه للإدارة
  for r in
    select w.id, w.order_no, w.client_name, w.scheduled_at, t.tech_id, p.full_name
      from work_orders w join work_order_techs t on t.work_order_id = w.id
      left join profiles p on p.id = t.tech_id
     where w.status::text not in ('done', 'completed', 'finished', 'cancelled')
       and t.arrived_at is null
       and w.scheduled_at <  now() - interval '15 minutes'
       and w.scheduled_at >  now() - interval '12 hours'
  loop
    insert into reminder_log (work_order_id, tech_id, kind) values (r.id, r.tech_id, 'late') on conflict do nothing;
    if found then
      perform public.push_to_users('⚠ ' || coalesce(r.full_name, 'فني') || ' اتأخر على أمر #' || r.order_no,
        'العميل: ' || r.client_name || E'\nالميعاد كان: ' ||
        to_char(r.scheduled_at at time zone 'Africa/Cairo', 'HH24:MI') || ' ومالسه ماضغطش "وصلت"',
        r.id, public.admin_ids());
    end if;
  end loop;
end $$;
revoke all on function public.send_order_reminders() from public, anon, authenticated;

-- حذف الأمر يمسح سجل التذكيرات بتاعه كمان
create or replace function public.delete_work_order(wo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_orders() then
    raise exception 'مش مصرّح لك تحذف أوامر الشغل';
  end if;
  delete from report_credentials where report_id in (select id from site_reports where work_order_id = wo);
  delete from site_reports where work_order_id = wo;
  delete from work_order_photos where work_order_id = wo;
  delete from work_order_tasks where work_order_id = wo;
  delete from work_order_techs where work_order_id = wo;
  delete from reminder_log where work_order_id = wo;
  delete from work_orders where id = wo;
end $$;
grant execute on function public.delete_work_order(uuid) to authenticated;

-- ───────── 6) سجل العمليات (للمالك بس) ─────────
create table if not exists audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  user_id    uuid,
  user_name  text,
  action     text not null,
  record_id  text,
  summary    text,
  details    jsonb
);
alter table audit_log enable row level security;
drop policy if exists audit_owner_read on audit_log;
create policy audit_owner_read on audit_log for select to authenticated using (public.is_owner());
-- مفيش policy للكتابة: بيتكتب من الـ triggers بس

create or replace function public.audit(act text, rec text, summ text, det jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (user_id, user_name, action, record_id, summary, details)
  values (auth.uid(), (select full_name from profiles where id = auth.uid()), act, rec, summ, det);
exception when others then
  raise warning 'audit failed: %', sqlerrm;
end $$;
revoke all on function public.audit(text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.audit_work_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    perform public.audit('order_delete', old.id::text,
      'حذف أمر #' || old.order_no || ' — ' || old.client_name, to_jsonb(old));
    return old;
  end if;
  if new.client_name   is distinct from old.client_name   then d := d || jsonb_build_object('اسم العميل',  jsonb_build_array(old.client_name,   new.client_name));   end if;
  if new.client_phone  is distinct from old.client_phone  then d := d || jsonb_build_object('رقم العميل',  jsonb_build_array(old.client_phone,  new.client_phone));  end if;
  if new.location_text is distinct from old.location_text then d := d || jsonb_build_object('العنوان',     jsonb_build_array(old.location_text, new.location_text)); end if;
  if new.location_url  is distinct from old.location_url  then d := d || jsonb_build_object('اللوكيشن',    jsonb_build_array(old.location_url,  new.location_url));  end if;
  if new.scheduled_at  is distinct from old.scheduled_at  then d := d || jsonb_build_object('الميعاد',     jsonb_build_array(old.scheduled_at,  new.scheduled_at));  end if;
  if new.details       is distinct from old.details       then d := d || jsonb_build_object('التفاصيل',    jsonb_build_array(old.details,       new.details));       end if;
  if new.team_leader_id is distinct from old.team_leader_id then d := d || jsonb_build_object('التيم ليدر', jsonb_build_array(old.team_leader_id, new.team_leader_id)); end if;
  if d <> '{}'::jsonb then
    perform public.audit('order_edit', new.id::text, 'تعديل أمر #' || new.order_no || ' — ' || new.client_name, d);
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_wo_upd on work_orders;
create trigger trg_audit_wo_upd after update on work_orders
  for each row execute function public.audit_work_order();
drop trigger if exists trg_audit_wo_del on work_orders;
create trigger trg_audit_wo_del before delete on work_orders
  for each row execute function public.audit_work_order();

create or replace function public.audit_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb := '{}'::jsonb;
begin
  if new.role is distinct from old.role then d := d || jsonb_build_object('الدور', jsonb_build_array(old.role, new.role)); end if;
  if new.is_active is distinct from old.is_active then d := d || jsonb_build_object('نشط', jsonb_build_array(old.is_active, new.is_active)); end if;
  if new.can_manage_orders is distinct from old.can_manage_orders then d := d || jsonb_build_object('تعديل/حذف الأوامر', jsonb_build_array(old.can_manage_orders, new.can_manage_orders)); end if;
  if new.is_owner is distinct from old.is_owner then d := d || jsonb_build_object('مالك', jsonb_build_array(old.is_owner, new.is_owner)); end if;
  if d <> '{}'::jsonb then
    perform public.audit('user_change', new.id::text, 'تعديل مستخدم: ' || coalesce(new.full_name, '—'), d);
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_profile on profiles;
create trigger trg_audit_profile after update on profiles
  for each row execute function public.audit_profile();

-- ───────── 7) جدولة التذكيرات كل 5 دقايق (pg_cron) ─────────
-- لو السطر ده اداك خطأ: Dashboard > Database > Extensions > فعّل pg_cron وشغّله تاني
create extension if not exists pg_cron;
select cron.schedule('prosmart-reminders', '*/5 * * * *', $$select public.send_order_reminders()$$);

-- ───────── 8) حساب المالك ─────────
-- 1) اعمل الحساب من: Authentication > Users > Add user > Create new user
--    (Email: administrator@prosmart.app  +  الباسورد بتاعك  +  علّم Auto Confirm User)
-- 2) شغّل السطر ده:
-- update profiles set role = 'admin', is_active = true, is_owner = true, full_name = 'المالك'
--   where id = (select id from auth.users where email = 'administrator@prosmart.app');
