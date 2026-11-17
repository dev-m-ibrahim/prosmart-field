-- Step 13: المرتجعات لازم أمين المخزن يوافق عليها قبل ما تتضاف للرصيد + زر واتساب
-- شغّله مرة واحدة في SQL Editor (بعد step12)

create table if not exists stock_returns (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  product_id    uuid not null references products(id),
  stock_item_id uuid,
  quantity      numeric not null check (quantity > 0),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by  uuid,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
alter table stock_returns enable row level security;   -- الوصول من الدوال بس

-- الرصيد بيزيد فقط لما الأمين يعتمد
create or replace function public.approve_return(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r stock_returns%rowtype;
begin
  if not (public.my_role()::text = 'storekeeper' or public.is_owner()) then
    raise exception 'مش مصرّح لك تعتمد المرتجعات';
  end if;
  select * into r from stock_returns where id = rid and status = 'pending' for update;
  if not found then raise exception 'الطلب مش موجود أو اتراجع قبل كده'; end if;
  insert into stock_movements (product_id, stock_item_id, type, quantity, work_order_id)
    values (r.product_id, r.stock_item_id, 'in', r.quantity, r.work_order_id);
  update stock_returns set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = rid;
end $$;

-- الرفض: القطع تفضل على ذمة الفني ويقدر يسجلها تاني
create or replace function public.reject_return(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.my_role()::text = 'storekeeper' or public.is_owner()) then
    raise exception 'مش مصرّح لك ترفض المرتجعات';
  end if;
  update stock_returns set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where id = rid and status = 'pending';
end $$;

create or replace function public.pending_returns() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'qty', r.quantity, 'product', p.name, 'model', p.model,
           'serial', si.serial_number, 'order_no', w.order_no, 'client', w.client_name,
           'tech', pr.full_name, 'at', r.created_at) order by r.created_at), '[]'::jsonb)
  from stock_returns r
  join products p on p.id = r.product_id
  join work_orders w on w.id = r.work_order_id
  left join stock_items si on si.id = r.stock_item_id
  left join profiles pr on pr.id = r.requested_by
  where r.status = 'pending'
    and (public.my_role()::text in ('storekeeper', 'admin') or public.is_owner())
$$;
grant execute on function public.approve_return(uuid), public.reject_return(uuid), public.pending_returns() to authenticated;

-- زر واتساب: الأونر يقدر يشيله من أي مستخدم
alter table profiles add column if not exists can_whatsapp boolean not null default true;

create or replace function public.order_stock_lines(wo uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not (public.my_role() in ('admin', 'storekeeper')
          or exists (select 1 from work_order_techs where work_order_id = wo and tech_id = auth.uid())) then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(q.l order by q.l ->> 'name'), '[]'::jsonb) into res
  from (
    select jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'model', p.model,
      'track_serial', coalesce(p.track_serial, false),
      'issued', o.issued,
      'returned', coalesce(r.returned, 0) + coalesce(rp.pending, 0), 'returned_pending', coalesce(rp.pending, 0),
      'installed', case when coalesce(p.track_serial, false) then coalesce(u.inst_serial, 0) else coalesce(u.inst, 0) end,
      'serials', case when coalesce(p.track_serial, false) then (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'id', si.id, 'sn', si.serial_number,
                   'pending_return', exists (select 1 from stock_returns sr2 where sr2.work_order_id = wo and sr2.stock_item_id = si.id and sr2.status = 'pending'),
                   'state', case
                     when exists (select 1 from stock_movements m2 where m2.work_order_id = wo and m2.stock_item_id = si.id and m2.type::text = 'in') then 'returned'
                     when exists (select 1 from stock_returns sr where sr.work_order_id = wo and sr.stock_item_id = si.id and sr.status = 'pending') then 'returned'
                     when exists (select 1 from order_stock_usage u2 where u2.work_order_id = wo and u2.stock_item_id = si.id and u2.installed > 0) then 'installed'
                     else 'pending' end
                 ) order by si.serial_number), '[]'::jsonb)
            from stock_items si
           where si.id in (select stock_item_id from stock_movements
                            where work_order_id = wo and type::text = 'out' and stock_item_id is not null and product_id = p.id))
        else '[]'::jsonb end
    ) as l
    from products p
    join (select product_id, sum(abs(quantity)) as issued from stock_movements
           where work_order_id = wo and type::text = 'out' group by product_id) o on o.product_id = p.id
    left join (select product_id, sum(abs(quantity)) as returned from stock_movements
                where work_order_id = wo and type::text = 'in' group by product_id) r on r.product_id = p.id
    left join (select product_id, sum(quantity) as pending from stock_returns
                where work_order_id = wo and status = 'pending' group by product_id) rp on rp.product_id = p.id
    left join (select product_id,
                      sum(installed) filter (where stock_item_id is null) as inst,
                      sum(installed) filter (where stock_item_id is not null) as inst_serial
                 from order_stock_usage where work_order_id = wo group by product_id) u on u.product_id = p.id
  ) q;
  return res;
end $$;
grant execute on function public.order_stock_lines(uuid) to authenticated;

-- ───────── 4) الفني بيسجل (ركّبت / رجّعت) → المرتجع بيرجع للمخزن ─────────
-- lines = [ {product_id, installed, returned}  |  {product_id, installed_items:[ids], returned_items:[ids]} ]
create or replace function public.report_stock_usage(wo uuid, lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  ln jsonb; pid uuid; trk boolean; sid uuid;
  issued numeric; prev_ret numeric; inst numeric; ret numeric;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (public.my_role() in ('admin', 'storekeeper')
          or exists (select 1 from work_order_techs where work_order_id = wo and tech_id = auth.uid())) then
    raise exception 'مش مصرّح لك على الأمر ده';
  end if;
  perform pg_advisory_xact_lock(hashtext(wo::text));

  for ln in select value from jsonb_array_elements(coalesce(lines, '[]'::jsonb)) loop
    pid := (ln ->> 'product_id')::uuid;
    select coalesce(track_serial, false) into trk from products where id = pid;

    if not trk then
      select coalesce(sum(abs(quantity)), 0) into issued from stock_movements
        where work_order_id = wo and product_id = pid and type::text = 'out';
      select coalesce(sum(abs(quantity)), 0) + (select coalesce(sum(quantity), 0) from stock_returns
               where work_order_id = wo and product_id = pid and status = 'pending') into prev_ret
        from stock_movements where work_order_id = wo and product_id = pid and type::text = 'in';
      inst := coalesce((ln ->> 'installed')::numeric, 0);
      ret  := coalesce((ln ->> 'returned')::numeric, 0);
      if inst < 0 or ret < 0 then raise exception 'كميات غير صحيحة'; end if;
      if ret < prev_ret then raise exception 'المرتجع اتسجل قبل كده (%) ومينفعش يتقلل', prev_ret; end if;
      if inst + ret > issued then raise exception 'المركّب + المرتجع أكبر من المصروف (%)', issued; end if;
      if ret > prev_ret then
        insert into stock_returns (work_order_id, product_id, quantity, requested_by) values (wo, pid, ret - prev_ret, auth.uid());
      end if;
      insert into order_stock_usage (work_order_id, product_id, installed, reported_by)
        values (wo, pid, inst, auth.uid())
        on conflict (work_order_id, product_id, item_key)
        do update set installed = excluded.installed, reported_by = excluded.reported_by, updated_at = now();
    else
      for sid in select value::uuid from jsonb_array_elements_text(coalesce(ln -> 'returned_items', '[]'::jsonb)) loop
        if not exists (select 1 from stock_movements where work_order_id = wo and stock_item_id = sid and type::text = 'out') then
          raise exception 'سيريال مش من المصروف على الأمر ده';
        end if;
        if not exists (select 1 from stock_movements where work_order_id = wo and stock_item_id = sid and type::text = 'in')
           and not exists (select 1 from stock_returns where work_order_id = wo and stock_item_id = sid and status = 'pending') then
          insert into stock_returns (work_order_id, product_id, stock_item_id, quantity, requested_by) values (wo, pid, sid, 1, auth.uid());
        end if;
        delete from order_stock_usage where work_order_id = wo and stock_item_id = sid;
      end loop;
      for sid in select value::uuid from jsonb_array_elements_text(coalesce(ln -> 'installed_items', '[]'::jsonb)) loop
        if not exists (select 1 from stock_movements where work_order_id = wo and stock_item_id = sid and type::text = 'out') then
          raise exception 'سيريال مش من المصروف على الأمر ده';
        end if;
        if exists (select 1 from stock_movements where work_order_id = wo and stock_item_id = sid and type::text = 'in') then
          raise exception 'السيريال ده اترجّع قبل كده';
        end if;
        insert into order_stock_usage (work_order_id, product_id, stock_item_id, item_key, installed, reported_by)
          values (wo, pid, sid, sid, 1, auth.uid())
          on conflict (work_order_id, product_id, item_key)
          do update set installed = 1, reported_by = excluded.reported_by, updated_at = now();
      end loop;
    end if;
  end loop;
end $$;
grant execute on function public.report_stock_usage(uuid, jsonb) to authenticated;

-- حذف المنتجات للمالك والإداري بس (على مستوى الداتا بيز)
create or replace function public.guard_product_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not (public.my_role()::text = 'admin' or public.is_owner()) then
    raise exception 'حذف المنتجات للمالك والإداري بس';
  end if;
  return old;
end $$;
drop trigger if exists trg_guard_product_delete on products;
create trigger trg_guard_product_delete before delete on products
for each row execute function public.guard_product_delete();
