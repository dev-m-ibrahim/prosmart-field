-- Step 14: الفئات المتداخلة (سمارت هوم > الماركة > النوع > ...) — شغّله مرة واحدة بعد step13

create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references categories(id) on delete restrict,
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create unique index if not exists categories_uniq
  on categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

alter table categories enable row level security;
drop policy if exists cat_read on categories;
create policy cat_read on categories for select to authenticated using (true);
drop policy if exists cat_write on categories;
create policy cat_write on categories for all to authenticated
  using (public.my_role()::text in ('admin', 'storekeeper') or public.is_owner())
  with check (public.my_role()::text in ('admin', 'storekeeper') or public.is_owner());

alter table products add column if not exists category_id uuid references categories(id) on delete restrict;

-- المسار الكامل للفئة: سمارت هوم › Avatto › سويتش
create or replace function public.category_path(cid uuid) returns text
language sql stable set search_path = public as $$
  with recursive up as (
    select id, parent_id, name, 1 as lvl from categories where id = cid
    union all
    select c.id, c.parent_id, c.name, up.lvl + 1 from categories c join up on c.id = up.parent_id
  ) select string_agg(name, ' › ' order by lvl desc) from up
$$;
grant execute on function public.category_path(uuid) to authenticated;

-- نقل الفئات النصية القديمة كفئات رئيسية وربط المنتجات بيها
insert into categories (name)
select d.n from (select distinct trim(category) as n from products where nullif(trim(category), '') is not null) d
where not exists (select 1 from categories c where c.parent_id is null and lower(c.name) = lower(d.n));
update products p set category_id = c.id
  from categories c
 where p.category_id is null and c.parent_id is null and lower(c.name) = lower(trim(p.category));

-- فئات مبدئية (تقدر تعدّلها وتزود من التطبيق: المخزن > الفئات)
create or replace function public._cat(p uuid, nm text) returns uuid
language plpgsql as $$
declare r uuid;
begin
  select id into r from categories where parent_id is not distinct from p and lower(name) = lower(nm);
  if r is null then insert into categories (parent_id, name) values (p, nm) returning id into r; end if;
  return r;
end $$;
do $$
declare sh uuid; cam uuid; b uuid;
begin
  sh  := public._cat(null, 'سمارت هوم');
  cam := public._cat(null, 'كاميرات');
  b := public._cat(sh, 'Avatto');  perform public._cat(b, 'سويتشات');
  b := public._cat(sh, 'Moes');    perform public._cat(b, 'سويتشات');
  perform public._cat(cam, 'Hikvision');
end $$;
drop function public._cat(uuid, text);

-- رصيد المخزن + الفئة (بنزود عمودين في الآخر)
do $$
declare has_min boolean; v text;
begin
  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'products' and column_name = 'min_stock') into has_min;
  v := 'select p.id as product_id, p.name, p.brand, p.model, p.category, p.barcode, '
    || case when has_min then 'p.min_stock' else '0::numeric as min_stock' end
    || ', coalesce(p.track_serial, false) as track_serial, '
    || 'coalesce(sum(case m.type::text when ''in'' then abs(m.quantity) when ''out'' then -abs(m.quantity) else 0 end), 0) as balance, '
    || 'p.category_id, coalesce(public.category_path(p.category_id), p.category) as category_path '
    || 'from public.products p left join public.stock_movements m on m.product_id = p.id group by p.id';
  begin
    execute 'create or replace view public.stock_balance as ' || v;
  exception when others then
    execute 'drop view public.stock_balance';
    execute 'create view public.stock_balance as ' || v;
  end;
  execute 'grant select on public.stock_balance to authenticated';
end $$;
