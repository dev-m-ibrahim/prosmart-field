-- Step 15: المعاينة + أنواع الأوامر (تركيب/معاينة/صيانة) + كتالوج الأجهزة + سجل توريد المخزن
-- شغّله مرة واحدة في Supabase SQL Editor بعد step14

-- ───────── 1) نوع أمر الشغل ─────────
alter table work_orders add column if not exists kind text not null default 'install';
do $$ begin
  alter table work_orders add constraint work_orders_kind_chk check (kind in ('install', 'survey', 'maintenance'));
exception when duplicate_object then null; end $$;
alter table work_orders add column if not exists parent_order_id uuid references work_orders(id) on delete set null;
alter table site_reports add column if not exists maint_issue text;   -- المشكلة اللي اتلاقت في الصيانة

-- ───────── 2) صلاحية إدارة كتالوج المعاينة (المالك يديها لأي مستخدم) ─────────
alter table profiles add column if not exists can_manage_catalog boolean not null default false;

create or replace function public.can_manage_catalog() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (is_owner or can_manage_catalog) from profiles
                   where id = auth.uid() and is_active), false)
$$;
grant execute on function public.can_manage_catalog() to authenticated;

create or replace function public.guard_profile_flags() returns trigger
language plpgsql security definer set search_path = public as $g$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role
          or new.is_active is distinct from old.is_active
          or new.can_manage_orders is distinct from old.can_manage_orders
          or new.can_manage_catalog is distinct from old.can_manage_catalog
          or new.is_owner is distinct from old.is_owner)
     and not public.is_owner() then
    raise exception 'إدارة المستخدمين والأدوار للمالك بس';
  end if;
  return new;
end $g$;

-- ───────── 3) كتالوج أجهزة المعاينة ─────────
create table if not exists survey_catalog (
  id         uuid primary key default gen_random_uuid(),
  section    text not null check (section in ('smart_home', 'cctv', 'network')),
  grp_ar     text not null default 'أخرى',
  grp_en     text not null default 'Other',
  name_ar    text not null check (length(trim(name_ar)) > 0),
  name_en    text not null default '',
  unit       text not null default 'pcs' check (unit in ('pcs', 'm')),
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
alter table survey_catalog enable row level security;
drop policy if exists sc_read on survey_catalog;
create policy sc_read on survey_catalog for select to authenticated using (true);
drop policy if exists sc_write on survey_catalog;
create policy sc_write on survey_catalog for all to authenticated
  using (public.can_manage_catalog()) with check (public.can_manage_catalog());

do $$ begin
  if not exists (select 1 from survey_catalog) then
insert into survey_catalog (section, grp_ar, grp_en, name_ar, name_en, unit, sort) values
('smart_home','سويتشات لمس','Touch switches','تاتش سويتش 1 خط','Touch switch 1-gang','pcs',1),
('smart_home','سويتشات لمس','Touch switches','تاتش سويتش 2 خط','Touch switch 2-gang','pcs',2),
('smart_home','سويتشات لمس','Touch switches','تاتش سويتش 3 خط','Touch switch 3-gang','pcs',3),
('smart_home','سويتشات لمس','Touch switches','تاتش سويتش 4 خط','Touch switch 4-gang','pcs',4),
('smart_home','سويتشات لمس','Touch switches','سويتش ديمر','Dimmer switch','pcs',5),
('smart_home','سويتشات لمس','Touch switches','سويتش سيناريو (أزرار)','Scene switch (buttons)','pcs',6),
('smart_home','سويتشات لمس','Touch switches','ريليه / مديول تحكم','Smart relay module','pcs',7),
('smart_home','ستائر وبوابات','Curtains, shutters & gates','سمارت شاتر (سويتش)','Smart shutter switch','pcs',8),
('smart_home','ستائر وبوابات','Curtains, shutters & gates','موتور ستارة','Curtain motor','pcs',9),
('smart_home','ستائر وبوابات','Curtains, shutters & gates','موتور رول شتر','Roller shutter motor','pcs',10),
('smart_home','ستائر وبوابات','Curtains, shutters & gates','كنترولر باب جراج','Garage door controller','pcs',11),
('smart_home','ستائر وبوابات','Curtains, shutters & gates','كنترولر بوابة','Gate controller','pcs',12),
('smart_home','حساسات','Sensors','حساس تواجد','Presence sensor','pcs',13),
('smart_home','حساسات','Sensors','حساس حركة','Motion sensor','pcs',14),
('smart_home','حساسات','Sensors','حساس باب / شباك','Door / window sensor','pcs',15),
('smart_home','حساسات','Sensors','حساس غاز','Gas sensor','pcs',16),
('smart_home','حساسات','Sensors','حساس مياه (تسريب)','Water leak sensor','pcs',17),
('smart_home','حساسات','Sensors','حساس دخان','Smoke sensor','pcs',18),
('smart_home','حساسات','Sensors','حساس حرارة ورطوبة','Temperature & humidity sensor','pcs',19),
('smart_home','حساسات','Sensors','حساس إضاءة','Light sensor','pcs',20),
('smart_home','حساسات','Sensors','حساس اهتزاز','Vibration sensor','pcs',21),
('smart_home','حساسات','Sensors','سارينة','Siren','pcs',22),
('smart_home','حساسات','Sensors','زر طوارئ','Panic button','pcs',23),
('smart_home','أقفال وأمان','Locks & security','سمارت لوك','Smart lock','pcs',24),
('smart_home','أقفال وأمان','Locks & security','جرس فيديو','Video doorbell','pcs',25),
('smart_home','طاقة وتحكم','Power & control','سمارت بلج','Smart plug','pcs',26),
('smart_home','طاقة وتحكم','Power & control','سمارت بلج بقياس الطاقة','Energy-monitoring smart plug','pcs',27),
('smart_home','طاقة وتحكم','Power & control','عداد طاقة ذكي','Smart energy meter','pcs',28),
('smart_home','طاقة وتحكم','Power & control','ريموت IR (تكييف / تلفزيون)','IR remote (AC / TV)','pcs',29),
('smart_home','طاقة وتحكم','Power & control','ثرموستات','Thermostat','pcs',30),
('smart_home','طاقة وتحكم','Power & control','كنترولر تكييف','AC controller','pcs',31),
('smart_home','إضاءة','Lighting','لمبة سمارت','Smart bulb','pcs',32),
('smart_home','إضاءة','Lighting','سبوت سمارت','Smart downlight','pcs',33),
('smart_home','إضاءة','Lighting','كنترولر شريط LED','LED strip controller','pcs',34),
('smart_home','مياه وري','Water & irrigation','محبس مياه سمارت','Smart water valve','pcs',35),
('smart_home','مياه وري','Water & irrigation','محبس غاز سمارت','Smart gas valve','pcs',36),
('smart_home','مياه وري','Water & irrigation','كنترولر ري','Irrigation controller','pcs',37),
('smart_home','مراكز تحكم','Hubs & control','جيت واي / هب زيجبي','Zigbee gateway / hub','pcs',38),
('smart_home','مراكز تحكم','Hubs & control','شاشة تحكم مركزية','Central control screen','pcs',39),
('smart_home','مراكز تحكم','Hubs & control','سمارت سبيكر (أليكسا)','Smart speaker (Alexa)','pcs',40),
('cctv','مسجلات','Recorders','NVR 4 قنوات','NVR 4-channel','pcs',41),
('cctv','مسجلات','Recorders','NVR 8 قنوات','NVR 8-channel','pcs',42),
('cctv','مسجلات','Recorders','NVR 16 قناة','NVR 16-channel','pcs',43),
('cctv','مسجلات','Recorders','NVR 32 قناة','NVR 32-channel','pcs',44),
('cctv','كاميرات','Cameras','كاميرا 2MP','Camera 2MP','pcs',45),
('cctv','كاميرات','Cameras','كاميرا 4MP','Camera 4MP','pcs',46),
('cctv','كاميرات','Cameras','كاميرا 6MP','Camera 6MP','pcs',47),
('cctv','كاميرات','Cameras','كاميرا 8MP','Camera 8MP','pcs',48),
('cctv','كاميرات','Cameras','كاميرا PTZ','PTZ camera','pcs',49),
('cctv','كاميرات','Cameras','كاميرا واي فاي','Wi-Fi camera','pcs',50),
('cctv','هارد ديسك','Hard disks','هارد 1TB','HDD 1TB','pcs',51),
('cctv','هارد ديسك','Hard disks','هارد 2TB','HDD 2TB','pcs',52),
('cctv','هارد ديسك','Hard disks','هارد 4TB','HDD 4TB','pcs',53),
('cctv','هارد ديسك','Hard disks','هارد 6TB','HDD 6TB','pcs',54),
('cctv','هارد ديسك','Hard disks','هارد 8TB','HDD 8TB','pcs',55),
('cctv','هارد ديسك','Hard disks','هارد 10TB','HDD 10TB','pcs',56),
('cctv','كابلات','Cables','كابل Cat6','Cat6 cable','m',57),
('cctv','كابلات','Cables','كابل كواكس + باور','Coaxial + power cable','m',58),
('cctv','كابلات','Cables','كابل كهرباء','Power cable','m',59),
('cctv','ملحقات','Accessories','سويتش PoE 4 بورت','PoE switch 4-port','pcs',60),
('cctv','ملحقات','Accessories','سويتش PoE 8 بورت','PoE switch 8-port','pcs',61),
('cctv','ملحقات','Accessories','سويتش PoE 16 بورت','PoE switch 16-port','pcs',62),
('cctv','ملحقات','Accessories','شاشة عرض','Monitor','pcs',63),
('cctv','ملحقات','Accessories','UPS','UPS','pcs',64),
('cctv','ملحقات','Accessories','محول كهرباء','Power adapter','pcs',65),
('cctv','ملحقات','Accessories','علبة تركيب','Junction box','pcs',66),
('cctv','ملحقات','Accessories','وصلات RJ45','RJ45 connectors','pcs',67),
('network','راوتر وأمان','Router & security','راوتر','Router','pcs',68),
('network','راوتر وأمان','Router & security','مودم','Modem','pcs',69),
('network','راوتر وأمان','Router & security','فايروول','Firewall','pcs',70),
('network','واي فاي','Wi-Fi','اكسس بوينت سقف (داخلي)','Access point (indoor, ceiling)','pcs',71),
('network','واي فاي','Wi-Fi','اكسس بوينت خارجي','Access point (outdoor)','pcs',72),
('network','واي فاي','Wi-Fi','ميش نود','Mesh node','pcs',73),
('network','واي فاي','Wi-Fi','مقوي إشارة','Range extender','pcs',74),
('network','سويتشات','Switches','سويتش 8 بورت','Switch 8-port','pcs',75),
('network','سويتشات','Switches','سويتش 16 بورت','Switch 16-port','pcs',76),
('network','سويتشات','Switches','سويتش 24 بورت','Switch 24-port','pcs',77),
('network','سويتشات','Switches','سويتش 48 بورت','Switch 48-port','pcs',78),
('network','سويتشات','Switches','سويتش PoE 8 بورت','PoE switch 8-port','pcs',79),
('network','سويتشات','Switches','سويتش PoE 16 بورت','PoE switch 16-port','pcs',80),
('network','سويتشات','Switches','سويتش PoE 24 بورت','PoE switch 24-port','pcs',81),
('network','كابلات وتوصيل','Cabling','كابل Cat6','Cat6 cable','m',82),
('network','كابلات وتوصيل','Cabling','كابل Cat6 خارجي','Cat6 outdoor cable','m',83),
('network','كابلات وتوصيل','Cabling','كابل فايبر','Fiber cable','m',84),
('network','كابلات وتوصيل','Cabling','باتش بانل 24','Patch panel 24-port','pcs',85),
('network','كابلات وتوصيل','Cabling','باتش كورد','Patch cord','pcs',86),
('network','كابلات وتوصيل','Cabling','برايزة شبكة','Network socket','pcs',87),
('network','راكات وطاقة','Racks & power','راك 6U','Rack 6U','pcs',88),
('network','راكات وطاقة','Racks & power','راك 9U','Rack 9U','pcs',89),
('network','راكات وطاقة','Racks & power','راك 12U','Rack 12U','pcs',90),
('network','راكات وطاقة','Racks & power','UPS','UPS','pcs',91);
  end if;
end $$;

-- ───────── 4) المعاينات ─────────
create table if not exists site_surveys (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null unique references work_orders(id) on delete cascade,
  customer_name text,
  data          jsonb not null default '{}'::jsonb,
  updated_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);
alter table site_surveys enable row level security;
drop policy if exists sv_admin on site_surveys;
create policy sv_admin on site_surveys for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
drop policy if exists sv_tech_sel on site_surveys;
create policy sv_tech_sel on site_surveys for select to authenticated
  using (exists (select 1 from work_order_techs t where t.work_order_id = site_surveys.work_order_id and t.tech_id = auth.uid()));
drop policy if exists sv_tech_ins on site_surveys;
create policy sv_tech_ins on site_surveys for insert to authenticated
  with check (exists (select 1 from work_order_techs t where t.work_order_id = site_surveys.work_order_id and t.tech_id = auth.uid()));
drop policy if exists sv_tech_upd on site_surveys;
create policy sv_tech_upd on site_surveys for update to authenticated
  using (exists (select 1 from work_order_techs t where t.work_order_id = site_surveys.work_order_id and t.tech_id = auth.uid()))
  with check (exists (select 1 from work_order_techs t where t.work_order_id = site_surveys.work_order_id and t.tech_id = auth.uid()));

create or replace function public.touch_survey() returns trigger
language plpgsql as $$ begin new.updated_at := now(); new.updated_by := coalesce(auth.uid(), new.updated_by); return new; end $$;
drop trigger if exists trg_touch_survey on site_surveys;
create trigger trg_touch_survey before update on site_surveys for each row execute function public.touch_survey();

-- ───────── 5) سجل توريد المخزن (زيادة الرصيد بمصدر واضح بدل تعديل الرقم) ─────────
create table if not exists stock_receipts (
  id         uuid primary key default gen_random_uuid(),
  ref        text,                       -- المصدر: فاتورة / مورد / اسم الشغل اللي دخل
  note       text,
  created_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table stock_receipts enable row level security;
drop policy if exists sr_staff on stock_receipts;
create policy sr_staff on stock_receipts for all to authenticated
  using (public.my_role() in ('admin', 'storekeeper')) with check (public.my_role() in ('admin', 'storekeeper'));
alter table stock_movements add column if not exists receipt_id uuid references stock_receipts(id) on delete set null;
