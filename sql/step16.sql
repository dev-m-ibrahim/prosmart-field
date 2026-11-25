-- Step 16: مدير المخزن الوحيد + موافقة الصرف + السائقين + رأي/توقيع العميل بالـ QR
-- شغّله مرة واحدة في Supabase > SQL Editor (بعد step15).
--
-- لو ظهر خطأ في الجزء الأول (إضافة دور "سائق") شغّل الجزء ده لوحده الأول، وبعدين شغّل الباقي.
-- ملحوظة: حساب andro@prosmart.app لازم يكون دوره "إداري" أو "أمين مخزن" عشان يشوف أوامر الشغل في الصرف.

-- ═════════════════════════════════════════════════════════════════
-- 0) دور جديد: سائق (driver)
-- ═════════════════════════════════════════════════════════════════
do $$
declare ty text; c record;
begin
  select a.atttypid::regtype::text into ty
    from pg_attribute a
   where a.attrelid = 'public.profiles'::regclass and a.attname = 'role'
     and exists (select 1 from pg_type t where t.oid = a.atttypid and t.typtype = 'e');
  if ty is not null then
    execute 'alter type ' || ty || ' add value if not exists ''driver''';
  else
    -- العمود text عادي: نعدّل الـ check constraint القديم
    for c in select conname from pg_constraint
              where conrelid = 'public.profiles'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) ilike '%role%' loop
      execute format('alter table public.profiles drop constraint %I', c.conname);
    end loop;
    alter table public.profiles add constraint profiles_role_check
      check (role in ('admin', 'technician', 'storekeeper', 'driver'));
  end if;
end $$;

-- ═════════════════════════════════════════════════════════════════
-- 1) مدير المخزن: andro@prosmart.app هو الوحيد اللي يضيف / يعدّل / يحذف في المخزن
--    (الصلاحية متثبتة على إيميل الحساب جوه الـ JWT، مفيش حد يقدر يديها لحد تاني من التطبيق)
-- ═════════════════════════════════════════════════════════════════
create or replace function public.is_stock_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'andro@prosmart.app'
     and exists (select 1 from profiles where id = auth.uid() and is_active)
$$;
grant execute on function public.is_stock_manager() to authenticated;

create or replace function public.stock_manager_id() returns uuid
language sql stable security definer set search_path = public as $$
  select u.id from auth.users u join profiles p on p.id = u.id
   where lower(u.email) = 'andro@prosmart.app' and p.is_active limit 1
$$;
revoke all on function public.stock_manager_id() from public, anon, authenticated;

alter table stock_movements add column if not exists issue_request_id uuid;

do $$
declare t text;
begin
  foreach t in array array['products', 'stock_items', 'stock_movements', 'stock_receipts', 'categories'] loop
    -- القراءة: الإداري وأمين المخزن ومدير المخزن
    execute format('drop policy if exists stock_staff_all on public.%I', t);
    execute format('drop policy if exists stock_staff_read on public.%I', t);
    execute format($p$create policy stock_staff_read on public.%I for select to authenticated
      using (public.my_role() in ('admin','storekeeper') or public.is_stock_manager())$p$, t);
    -- الكتابة (إضافة / تعديل / حذف): مدير المخزن بس
    execute format('drop policy if exists stock_mgr_write on public.%I', t);
    execute format($p$create policy stock_mgr_write on public.%I for all to authenticated
      using (public.is_stock_manager()) with check (public.is_stock_manager())$p$, t);
    -- حاجز: أي policy قديمة بتسمح لغيره تتلغي
    execute format('drop policy if exists stock_guard_ins on public.%I', t);
    execute format($p$create policy stock_guard_ins on public.%I as restrictive for insert to authenticated
      with check (public.is_stock_manager())$p$, t);
    execute format('drop policy if exists stock_guard_upd on public.%I', t);
    execute format($p$create policy stock_guard_upd on public.%I as restrictive for update to authenticated
      using (public.is_stock_manager())$p$, t);
    execute format('drop policy if exists stock_guard_del on public.%I', t);
    execute format($p$create policy stock_guard_del on public.%I as restrictive for delete to authenticated
      using (public.is_stock_manager())$p$, t);
  end loop;
end $$;
drop policy if exists sr_staff on stock_receipts;
drop policy if exists cat_write on categories;
-- القراءة المفتوحة للفئات (من step14) تفضل زي ما هي

-- حذف المنتجات: مدير المخزن بس
create or replace function public.guard_product_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_stock_manager() then
    raise exception 'حذف المنتجات لمدير المخزن بس';
  end if;
  return old;
end $$;
drop trigger if exists trg_guard_product_delete on products;
create trigger trg_guard_product_delete before delete on products
  for each row execute function public.guard_product_delete();

-- المرتجعات: أمين المخزن / المالك / مدير المخزن
create or replace function public.approve_return(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r stock_returns%rowtype;
begin
  if not (public.my_role()::text = 'storekeeper' or public.is_owner() or public.is_stock_manager()) then
    raise exception 'مش مصرّح لك تعتمد المرتجعات';
  end if;
  select * into r from stock_returns where id = rid and status = 'pending' for update;
  if not found then raise exception 'الطلب مش موجود أو اتراجع قبل كده'; end if;
  insert into stock_movements (product_id, stock_item_id, type, quantity, work_order_id)
    values (r.product_id, r.stock_item_id, 'in', r.quantity, r.work_order_id);
  update stock_returns set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = rid;
end $$;

create or replace function public.reject_return(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.my_role()::text = 'storekeeper' or public.is_owner() or public.is_stock_manager()) then
    raise exception 'مش مصرّح لك ترفض المرتجعات';
  end if;
  update stock_returns set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where id = rid and status = 'pending';
end $$;

-- الأوامر المتاحة للصرف: كمان لمدير المخزن
create or replace function public.orders_for_issue() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.my_role() in ('admin', 'storekeeper') or public.is_stock_manager() then
    coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'order_no', w.order_no,
                                                  'client_name', w.client_name, 'status', w.status))
              from (select * from work_orders where status::text <> 'cancelled'
                    order by scheduled_at desc limit 100) w), '[]'::jsonb)
  else '[]'::jsonb end
$$;

-- ═════════════════════════════════════════════════════════════════
-- 2) طلبات الصرف: أي إداري / أمين مخزن بيطلب، ومدير المخزن هو اللي يوافق
-- ═════════════════════════════════════════════════════════════════
create table if not exists stock_issue_requests (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  requested_by  uuid not null default auth.uid(),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note          text,
  reject_reason text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create table if not exists stock_issue_request_lines (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references stock_issue_requests(id) on delete cascade,
  product_id    uuid not null references products(id),
  stock_item_id uuid references stock_items(id),
  quantity      numeric not null check (quantity > 0)
);
create index if not exists sir_status_idx on stock_issue_requests(status, created_at desc);
alter table stock_issue_requests enable row level security;       -- الوصول من الدوال بس
alter table stock_issue_request_lines enable row level security;

-- تنفيذ الصرف فعليًا (داخلي: بيتنادى من الموافقة أو من طلب مدير المخزن نفسه)
create or replace function public._apply_issue(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r stock_issue_requests%rowtype; ln record; bal numeric; free numeric;
begin
  select * into r from stock_issue_requests where id = rid and status = 'pending' for update;
  if not found then raise exception 'الطلب مش موجود أو اتراجع قبل كده'; end if;
  for ln in
    select l.product_id, l.stock_item_id, l.quantity, p.name
      from stock_issue_request_lines l join products p on p.id = l.product_id
     where l.request_id = rid
  loop
    if ln.stock_item_id is not null then
      select coalesce(sum(case m.type::text when 'in' then 1 when 'out' then -1 else 0 end), 0) into free
        from stock_movements m where m.stock_item_id = ln.stock_item_id;
      if free <= 0 then raise exception 'السيريال مش متاح في المخزن (%)', ln.name; end if;
      insert into stock_movements (product_id, stock_item_id, type, quantity, work_order_id, issue_request_id)
        values (ln.product_id, ln.stock_item_id, 'out', 1, r.work_order_id, rid);
    else
      select coalesce(sum(case m.type::text when 'in' then abs(m.quantity) when 'out' then -abs(m.quantity) else 0 end), 0) into bal
        from stock_movements m where m.product_id = ln.product_id;
      if bal < ln.quantity then raise exception 'الرصيد مش كفاية: % (المتاح %)', ln.name, bal; end if;
      insert into stock_movements (product_id, type, quantity, work_order_id, issue_request_id)
        values (ln.product_id, 'out', ln.quantity, r.work_order_id, rid);
    end if;
  end loop;
  update stock_issue_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = rid;
end $$;
revoke all on function public._apply_issue(uuid) from public, anon, authenticated;

-- طلب صرف: lines = [{product_id, quantity} أو {product_id, stock_item_id}]
create or replace function public.request_issue(p_wo uuid, p_lines jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid uuid; l jsonb; sid uuid; q numeric; o work_orders%rowtype; mgr uuid; who text;
begin
  if not (public.my_role() in ('admin', 'storekeeper') or public.is_stock_manager()) then
    raise exception 'مش مصرّح لك تطلب صرف';
  end if;
  select * into o from work_orders where id = p_wo and status::text <> 'cancelled';
  if not found then raise exception 'أمر الشغل مش موجود أو ملغي'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'القائمة فاضية';
  end if;

  insert into stock_issue_requests (work_order_id, requested_by, note)
    values (p_wo, auth.uid(), nullif(trim(coalesce(p_note, '')), '')) returning id into rid;
  for l in select * from jsonb_array_elements(p_lines) loop
    sid := nullif(l ->> 'stock_item_id', '')::uuid;
    q := case when sid is not null then 1 else coalesce((l ->> 'quantity')::numeric, 0) end;
    if q <= 0 then raise exception 'كمية غلط'; end if;
    insert into stock_issue_request_lines (request_id, product_id, stock_item_id, quantity)
      values (rid, (l ->> 'product_id')::uuid, sid, q);
  end loop;

  -- مدير المخزن بيصرف على طول، أي حد غيره لازم موافقته
  if public.is_stock_manager() then
    perform public._apply_issue(rid);
    return jsonb_build_object('id', rid, 'status', 'approved');
  end if;

  begin
    mgr := public.stock_manager_id();
    select full_name into who from profiles where id = auth.uid();
    perform public.push_to_users('طلب صرف جديد محتاج موافقتك',
      coalesce(who, 'إداري') || ' طلب صرف لأمر #' || o.order_no || ' · ' || o.client_name, o.id,
      case when mgr is null then '{}'::uuid[] else array[mgr] end);
  exception when others then
    raise warning 'request_issue notify failed: %', sqlerrm;
  end;
  return jsonb_build_object('id', rid, 'status', 'pending');
end $$;

create or replace function public.approve_issue(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r stock_issue_requests%rowtype; o work_orders%rowtype;
begin
  if not public.is_stock_manager() then raise exception 'الموافقة على الصرف لمدير المخزن بس'; end if;
  perform public._apply_issue(p_id);
  begin
    select * into r from stock_issue_requests where id = p_id;
    select * into o from work_orders where id = r.work_order_id;
    perform public.push_to_users('تمت الموافقة على طلب الصرف ✓', 'أمر #' || o.order_no || ' · ' || o.client_name, o.id, array[r.requested_by]);
  exception when others then
    raise warning 'approve_issue notify failed: %', sqlerrm;
  end;
end $$;

create or replace function public.reject_issue(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r stock_issue_requests%rowtype; o work_orders%rowtype;
begin
  if not public.is_stock_manager() then raise exception 'رفض الصرف لمدير المخزن بس'; end if;
  update stock_issue_requests
     set status = 'rejected', reject_reason = nullif(trim(coalesce(p_reason, '')), ''),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'pending' returning * into r;
  if not found then raise exception 'الطلب مش موجود أو اتراجع قبل كده'; end if;
  begin
    select * into o from work_orders where id = r.work_order_id;
    perform public.push_to_users('طلب الصرف اترفض', 'أمر #' || o.order_no || ' · ' || o.client_name
      || coalesce(E'\nالسبب: ' || r.reject_reason, ''), o.id, array[r.requested_by]);
  exception when others then
    raise warning 'reject_issue notify failed: %', sqlerrm;
  end;
end $$;

-- صاحب الطلب يلغيه طالما لسه معلّق
create or replace function public.cancel_issue_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update stock_issue_requests set status = 'cancelled', reviewed_at = now()
   where id = p_id and status = 'pending' and requested_by = auth.uid();
  if not found then raise exception 'مينفعش تلغي الطلب ده'; end if;
end $$;

-- مدير المخزن بيشوف كل الطلبات، وأي حد تاني بيشوف طلباته هو بس
create or replace function public.issue_requests() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(s.x order by s.ts desc), '[]'::jsonb) from (
    select r.created_at as ts, jsonb_build_object(
      'id', r.id, 'status', r.status, 'note', r.note, 'reject_reason', r.reject_reason,
      'created_at', r.created_at, 'reviewed_at', r.reviewed_at,
      'order_no', w.order_no, 'client', w.client_name, 'by', pr.full_name,
      'mine', r.requested_by = auth.uid(),
      'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                  'product', p.name, 'model', p.model, 'serial', si.serial_number, 'qty', l.quantity)), '[]'::jsonb)
                  from stock_issue_request_lines l
                  join products p on p.id = l.product_id
                  left join stock_items si on si.id = l.stock_item_id
                 where l.request_id = r.id)) as x
      from stock_issue_requests r
      join work_orders w on w.id = r.work_order_id
      left join profiles pr on pr.id = r.requested_by
     where (public.is_stock_manager() or r.requested_by = auth.uid())
       and (r.status = 'pending' or r.created_at > now() - interval '30 days')
     order by r.created_at desc limit 100
  ) s
$$;
grant execute on function public.request_issue(uuid, jsonb, text), public.approve_issue(uuid),
  public.reject_issue(uuid, text), public.cancel_issue_request(uuid), public.issue_requests() to authenticated;

-- ═════════════════════════════════════════════════════════════════
-- 3) السائقين والمشاوير
-- ═════════════════════════════════════════════════════════════════
create table if not exists trips (
  id            uuid primary key default gen_random_uuid(),
  trip_no       bigint generated by default as identity,
  work_order_id uuid references work_orders(id) on delete set null,
  driver_id     uuid not null references profiles(id),
  pickup_text   text,
  dest_text     text not null,
  dest_url      text,
  scheduled_at  timestamptz not null,
  note          text,
  status        text not null default 'new' check (status in ('new', 'accepted', 'on_way', 'done', 'cancelled')),
  accepted_at   timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create table if not exists trip_passengers (
  trip_id uuid not null references trips(id) on delete cascade,
  tech_id uuid not null references profiles(id) on delete cascade,
  primary key (trip_id, tech_id)
);
create index if not exists trips_driver_idx on trips(driver_id, scheduled_at desc);
alter table trips enable row level security;               -- الوصول من الدوال بس
alter table trip_passengers enable row level security;

create or replace function public.create_trip(
  p_driver uuid, p_wo uuid, p_pickup text, p_dest text, p_dest_url text,
  p_at timestamptz, p_note text, p_techs uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid; o work_orders%rowtype; dst text; url text; dname text; dphone text; tno bigint; ids uuid[];
begin
  if public.my_role() is distinct from 'admin' then raise exception 'المشاوير للإداري بس'; end if;
  select full_name, phone into dname, dphone from profiles where id = p_driver and role::text = 'driver' and is_active;
  if not found then raise exception 'السائق مش موجود أو موقوف'; end if;
  dst := nullif(trim(coalesce(p_dest, '')), '');
  url := nullif(trim(coalesce(p_dest_url, '')), '');
  if p_wo is not null then
    select * into o from work_orders where id = p_wo;
    if found then dst := coalesce(dst, o.location_text); url := coalesce(url, o.location_url); end if;
  end if;
  if dst is null then raise exception 'اكتب وجهة المشوار'; end if;
  if p_at is null then raise exception 'حدد ميعاد المشوار'; end if;

  insert into trips (work_order_id, driver_id, pickup_text, dest_text, dest_url, scheduled_at, note)
    values (p_wo, p_driver, nullif(trim(coalesce(p_pickup, '')), ''), dst, url, p_at, nullif(trim(coalesce(p_note, '')), ''))
    returning id, trip_no into tid, tno;
  insert into trip_passengers (trip_id, tech_id)
    select tid, x from (select distinct unnest(coalesce(p_techs, '{}'::uuid[])) as x) s
     where exists (select 1 from profiles p where p.id = s.x and p.is_active);

  begin
    perform public.push_to_users('مشوار جديد #' || tno,
      'الوجهة: ' || dst || E'\nالميعاد: ' || to_char(p_at at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI')
      || coalesce(E'\n' || nullif(trim(coalesce(p_note, '')), ''), ''), p_wo, array[p_driver]);
    select coalesce(array_agg(tech_id), '{}') into ids from trip_passengers where trip_id = tid;
    perform public.push_to_users('سائق هيوصّلك — مشوار #' || tno,
      'السائق: ' || dname || coalesce(' (' || dphone || ')', '') || E'\nالوجهة: ' || dst
      || E'\nالميعاد: ' || to_char(p_at at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI'), p_wo, ids);
  exception when others then
    raise warning 'create_trip notify failed: %', sqlerrm;
  end;
  return tid;
end $$;

-- السائق يغيّر حالة مشواره (قبلت / في الطريق / تم)، والإداري يلغي
create or replace function public.trip_set_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare t trips%rowtype; ok boolean := false; ids uuid[]; dname text; is_adm boolean;
begin
  select * into t from trips where id = p_id for update;
  if not found then raise exception 'المشوار مش موجود'; end if;
  is_adm := public.my_role() = 'admin';
  if p_status = 'cancelled' then
    if not is_adm then raise exception 'الإلغاء للإداري بس'; end if;
    ok := t.status in ('new', 'accepted', 'on_way');
  else
    if t.driver_id is distinct from auth.uid() then raise exception 'المشوار ده مش بتاعك'; end if;
    ok := (p_status = 'accepted' and t.status = 'new')
       or (p_status = 'on_way'   and t.status in ('new', 'accepted'))
       or (p_status = 'done'     and t.status in ('accepted', 'on_way'));
  end if;
  if not ok then raise exception 'مينفعش تغيّر الحالة من % إلى %', t.status, p_status; end if;

  update trips set status = p_status,
    accepted_at = case when p_status = 'accepted' then now() else accepted_at end,
    started_at  = case when p_status = 'on_way'   then now() else started_at end,
    finished_at = case when p_status = 'done'     then now() else finished_at end
   where id = p_id;

  begin
    select full_name into dname from profiles where id = t.driver_id;
    select coalesce(array_agg(tech_id), '{}') into ids from trip_passengers where trip_id = p_id;
    if p_status = 'on_way' then
      perform public.push_to_users('السائق في الطريق ليك 🚗', coalesce(dname, 'السائق') || ' — مشوار #' || t.trip_no || E'\nالوجهة: ' || t.dest_text, t.work_order_id, ids);
    elsif p_status = 'cancelled' then
      perform public.push_to_users('مشوار #' || t.trip_no || ' اتلغى', 'الوجهة: ' || t.dest_text, t.work_order_id, ids || t.driver_id);
    end if;
    if p_status in ('accepted', 'done') and t.created_by is not null then
      perform public.push_to_users(case p_status when 'accepted' then 'السائق قبل المشوار' else 'المشوار خلص ✓' end,
        coalesce(dname, 'السائق') || ' — مشوار #' || t.trip_no || E'\nالوجهة: ' || t.dest_text, t.work_order_id, array[t.created_by]);
    end if;
  exception when others then
    raise warning 'trip_set_status notify failed: %', sqlerrm;
  end;
end $$;

-- الإداري: كل المشاوير | السائق: مشاويره | الفني: المشاوير اللي هو راكب فيها
create or replace function public.trips_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(s.x order by s.ts desc), '[]'::jsonb) from (
    select t.scheduled_at as ts, jsonb_build_object(
      'id', t.id, 'trip_no', t.trip_no, 'status', t.status, 'scheduled_at', t.scheduled_at,
      'pickup', t.pickup_text, 'dest', t.dest_text, 'dest_url', t.dest_url, 'note', t.note,
      'order_no', w.order_no, 'client', w.client_name,
      'driver_id', t.driver_id, 'driver', d.full_name, 'driver_phone', d.phone,
      'accepted_at', t.accepted_at, 'started_at', t.started_at, 'finished_at', t.finished_at,
      'passengers', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone)), '[]'::jsonb)
                       from trip_passengers tp join profiles p on p.id = tp.tech_id where tp.trip_id = t.id)) as x
      from trips t
      left join work_orders w on w.id = t.work_order_id
      left join profiles d on d.id = t.driver_id
     where case public.my_role()
             when 'admin'  then true
             when 'driver' then t.driver_id = auth.uid()
             else exists (select 1 from trip_passengers tp where tp.trip_id = t.id and tp.tech_id = auth.uid())
           end
       and (t.status in ('new', 'accepted', 'on_way') or t.scheduled_at > now() - interval '14 days')
     order by t.scheduled_at desc limit 150
  ) s
$$;
grant execute on function public.create_trip(uuid, uuid, text, text, text, timestamptz, text, uuid[]),
  public.trip_set_status(uuid, text), public.trips_list() to authenticated;

-- ═════════════════════════════════════════════════════════════════
-- 4) رأي العميل + التوقيع من موبايل العميل نفسه (QR)
-- ═════════════════════════════════════════════════════════════════
-- كل أمر له رمز سري طويل بيتحط جوه الـ QR (الأوامر القديمة بتاخد رمز تلقائيًا)
alter table work_orders add column if not exists feedback_token text not null
  default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
create unique index if not exists work_orders_feedback_token_key on work_orders(feedback_token);

create table if not exists client_feedback (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null unique references work_orders(id) on delete cascade,
  order_no      bigint not null,
  client_name   text not null,
  signer_name   text,
  rating        smallint not null check (rating between 1 and 5),
  comment       text,
  signature_png text not null,            -- data:image/png;base64,...
  user_agent    text,
  submitted_at  timestamptz not null default now()
);
alter table client_feedback enable row level security;
drop policy if exists cf_admin_read on client_feedback;
create policy cf_admin_read on client_feedback for select to authenticated using (public.my_role() = 'admin');

-- الفني/الإداري بياخد رمز الـ QR بتاع الأمر (الفني لازم يكون متعيّن عليه)
create or replace function public.get_feedback_token(p_wo uuid) returns text
language sql stable security definer set search_path = public as $$
  select w.feedback_token from work_orders w
   where w.id = p_wo
     and (public.my_role() = 'admin'
          or exists (select 1 from work_order_techs t where t.work_order_id = w.id and t.tech_id = auth.uid()))
$$;

-- حالة الرأي للفني (بدون محتواه): اتسجل ولا لسه
create or replace function public.order_feedback_status(p_wo uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('submitted', true, 'rating', f.rating, 'at', f.submitted_at)
                     from client_feedback f
                    where f.work_order_id = p_wo
                      and (public.my_role() = 'admin'
                           or exists (select 1 from work_order_techs t where t.work_order_id = p_wo and t.tech_id = auth.uid()))),
                  jsonb_build_object('submitted', false))
$$;

-- ↓ صفحة العميل (من غير تسجيل دخول): بتعرض اسم العميل ورقم الأمر بس، من غير تليفون أو عنوان
create or replace function public.feedback_info(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('order_no', w.order_no, 'client_name', w.client_name, 'kind', w.kind,
                            'scheduled_at', w.scheduled_at,
                            'done', exists (select 1 from client_feedback f where f.work_order_id = w.id))
    from work_orders w
   where length(coalesce(p_token, '')) >= 32 and w.feedback_token = p_token and w.status::text <> 'cancelled'
   limit 1
$$;

create or replace function public.feedback_submit(
  p_token text, p_rating int, p_comment text, p_signature text, p_signer text default null, p_ua text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o work_orders%rowtype; fid uuid;
begin
  select * into o from work_orders
   where length(coalesce(p_token, '')) >= 32 and feedback_token = p_token and status::text <> 'cancelled';
  if not found then raise exception 'الرابط ده مش صالح'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'اختار التقييم'; end if;
  if p_signature is null or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(p_signature) > 400000 then
    raise exception 'التوقيع مطلوب';
  end if;
  if length(coalesce(p_comment, '')) > 2000 then raise exception 'الرأي طويل أوي'; end if;

  insert into client_feedback (work_order_id, order_no, client_name, signer_name, rating, comment, signature_png, user_agent)
    values (o.id, o.order_no, o.client_name, nullif(left(trim(coalesce(p_signer, '')), 120), ''), p_rating,
            nullif(trim(coalesce(p_comment, '')), ''), p_signature, left(p_ua, 300))
    on conflict (work_order_id) do nothing
    returning id into fid;
  if fid is null then raise exception 'الرأي اتسجل قبل كده'; end if;

  begin
    perform public.push_to_users('رأي عميل جديد — أمر #' || o.order_no,
      'العميل: ' || o.client_name || E'\nالتقييم: ' || p_rating || '/5'
      || coalesce(E'\n' || nullif(trim(coalesce(p_comment, '')), ''), ''), o.id,
      public.admin_ids() || coalesce(array(select tech_id from work_order_techs where work_order_id = o.id), '{}'::uuid[]));
  exception when others then
    raise warning 'feedback_submit notify failed: %', sqlerrm;
  end;
  return jsonb_build_object('ok', true);
end $$;

-- صفحة "آراء العملاء" للإداري (من غير صور التوقيع عشان تبقى خفيفة)
create or replace function public.list_client_feedback() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.my_role() = 'admin' then
    coalesce((select jsonb_agg(x order by ts desc) from (
      select f.submitted_at as ts, jsonb_build_object(
        'id', f.id, 'work_order_id', f.work_order_id, 'order_no', f.order_no, 'client_name', f.client_name,
        'signer_name', f.signer_name, 'rating', f.rating, 'comment', f.comment, 'at', f.submitted_at,
        'kind', w.kind,
        'techs', (select coalesce(jsonb_agg(p.full_name), '[]'::jsonb)
                    from work_order_techs t join profiles p on p.id = t.tech_id where t.work_order_id = f.work_order_id)) as x
        from client_feedback f left join work_orders w on w.id = f.work_order_id
       order by f.submitted_at desc limit 300
    ) s), '[]'::jsonb)
  else '[]'::jsonb end
$$;

grant execute on function public.get_feedback_token(uuid), public.order_feedback_status(uuid),
  public.list_client_feedback() to authenticated;
grant execute on function public.feedback_info(text), public.feedback_submit(text, int, text, text, text, text) to anon, authenticated;

-- ═════════════════════════════════════════════════════════════════
-- 5) تأكد إن حساب andro فعّال (مفيش حاجة تتغيّر هنا، بس للتأكد)
-- ═════════════════════════════════════════════════════════════════
-- select u.email, p.role, p.is_active from auth.users u join profiles p on p.id = u.id where lower(u.email) = 'andro@prosmart.app';
