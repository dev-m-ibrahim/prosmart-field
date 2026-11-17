-- Step 12: منطق المخزن (صرف / تركيب / مرتجع) + لقب "مهندس"
-- شغّله مرة واحدة في SQL Editor (بعد step8 و step10 و step11)

-- ───────── 0) لقب المستخدم (المهندس = إداري بلقب مهندس) ─────────
alter table profiles add column if not exists job_title text;

-- ───────── 1) رصيد المخزن: إعادة تعريفه بشكل واضح ─────────
-- الرصيد = كل الوارد (استلام + مرتجعات)  −  كل المصروف لأوامر الشغل
-- (بنستخدم abs عشان لو في حركات قديمة اتسجلت بإشارة غلط، الرصيد يطلع صح)
do $$
declare
  has_min boolean;
  v text;
begin
  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'products' and column_name = 'min_stock') into has_min;
  v := 'select p.id as product_id, p.name, p.brand, p.model, p.category, p.barcode, '
    || case when has_min then 'p.min_stock' else '0::numeric as min_stock' end
    || ', coalesce(p.track_serial, false) as track_serial, '
    || 'coalesce(sum(case m.type::text when ''in'' then abs(m.quantity) when ''out'' then -abs(m.quantity) else 0 end), 0) as balance '
    || 'from public.products p left join public.stock_movements m on m.product_id = p.id group by p.id';
  begin
    execute 'create or replace view public.stock_balance as ' || v;
  exception when others then
    execute 'drop view public.stock_balance';
    execute 'create view public.stock_balance as ' || v;
  end;
  execute 'grant select on public.stock_balance to authenticated';
end $$;

-- ───────── 2) تسجيل التركيب لكل أمر ─────────
create table if not exists order_stock_usage (
  work_order_id uuid not null references work_orders(id) on delete cascade,
  product_id    uuid not null references products(id),
  stock_item_id uuid,                                              -- للمنتجات اللي ليها سيريال
  item_key      uuid not null default '00000000-0000-0000-0000-000000000000',
  installed     numeric not null default 0,
  reported_by   uuid,
  updated_at    timestamptz not null default now(),
  primary key (work_order_id, product_id, item_key)
);
alter table order_stock_usage enable row level security;   -- الوصول من الدوال بس

-- ───────── 3) قراءة خامات أمر (للفني المعيّن عليه + الإداري + أمين المخزن) ─────────
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
      'returned', coalesce(r.returned, 0),
      'installed', case when coalesce(p.track_serial, false) then coalesce(u.inst_serial, 0) else coalesce(u.inst, 0) end,
      'serials', case when coalesce(p.track_serial, false) then (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'id', si.id, 'sn', si.serial_number,
                   'state', case
                     when exists (select 1 from stock_movements m2 where m2.work_order_id = wo and m2.stock_item_id = si.id and m2.type::text = 'in') then 'returned'
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
      select coalesce(sum(abs(quantity)), 0) into prev_ret from stock_movements
        where work_order_id = wo and product_id = pid and type::text = 'in';
      inst := coalesce((ln ->> 'installed')::numeric, 0);
      ret  := coalesce((ln ->> 'returned')::numeric, 0);
      if inst < 0 or ret < 0 then raise exception 'كميات غير صحيحة'; end if;
      if ret < prev_ret then raise exception 'المرتجع اتسجل قبل كده (%) ومينفعش يتقلل', prev_ret; end if;
      if inst + ret > issued then raise exception 'المركّب + المرتجع أكبر من المصروف (%)', issued; end if;
      if ret > prev_ret then
        insert into stock_movements (product_id, type, quantity, work_order_id) values (pid, 'in', ret - prev_ret, wo);
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
        if not exists (select 1 from stock_movements where work_order_id = wo and stock_item_id = sid and type::text = 'in') then
          insert into stock_movements (product_id, stock_item_id, type, quantity, work_order_id) values (pid, sid, 'in', 1, wo);
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

-- حذف أمر يمسح تسجيلات التركيب بتاعته (الـ FK بيعمل cascade لوحده)
