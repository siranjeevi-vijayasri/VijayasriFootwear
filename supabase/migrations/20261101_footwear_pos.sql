-- Additive Vijayasri Footwear POS migration. Existing public.products is preserved.
create extension if not exists pgcrypto;
create sequence if not exists public.vjs_invoice_seq;

create table if not exists public.staff_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'Cashier' check(role in ('Owner','Manager','Cashier')),
 created_at timestamptz not null default now()
);
create or replace function public.vjs_is_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select public.is_vjs_admin() or exists(select 1 from public.staff_roles where user_id=auth.uid()); $$;
create or replace function public.vjs_current_role()
returns text language sql stable security definer set search_path=public
as $$ select case when public.is_vjs_admin() then 'Owner' else coalesce((select role from public.staff_roles where user_id=auth.uid()),'None') end; $$;

create table if not exists public.product_variants (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete restrict,
 size text not null,
 sku text,
 cost_price numeric(12,2) not null default 0 check(cost_price>=0),
 selling_price numeric(12,2) check(selling_price is null or selling_price>=0),
 stock_qty integer not null default 0 check(stock_qty>=0),
 reorder_level integer not null default 2 check(reorder_level>=0),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(product_id,size)
);
create index if not exists product_variants_product_idx on public.product_variants(product_id);
create table if not exists public.inventory_movements (
 id uuid primary key default gen_random_uuid(),
 variant_id uuid not null references public.product_variants(id) on delete restrict,
 movement_type text not null check(movement_type in ('OPENING','PURCHASE','SALE','RETURN','ADJUSTMENT','DAMAGE')),
 quantity_change integer not null check(quantity_change<>0),
 reference_type text, reference_id uuid, note text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.sales (
 id uuid primary key default gen_random_uuid(),
 invoice_number text not null unique,
 customer_name text, customer_phone text,
 bill_type text not null check(bill_type in ('GST','NON_GST')),
 tax_inclusive boolean not null default true,
 subtotal numeric(12,2) not null,
 discount_amount numeric(12,2) not null default 0,
 taxable_amount numeric(12,2) not null default 0,
 tax_amount numeric(12,2) not null default 0,
 total_amount numeric(12,2) not null,
 payment_method text not null default 'Cash' check(payment_method in ('Cash','UPI','Card','Other')),
 status text not null default 'COMPLETED' check(status in ('COMPLETED','CANCELLED','RETURNED')),
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists sales_created_at_idx on public.sales(created_at desc);
create table if not exists public.sale_items (
 id uuid primary key default gen_random_uuid(),
 sale_id uuid not null references public.sales(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete restrict,
 variant_id uuid not null references public.product_variants(id) on delete restrict,
 product_name text not null, brand text, model text, size text not null,
 quantity integer not null check(quantity>0),
 unit_price numeric(12,2) not null, unit_cost numeric(12,2) not null default 0,
 discount_amount numeric(12,2) not null default 0, tax_rate numeric(5,2) not null default 0,
 taxable_amount numeric(12,2) not null default 0, tax_amount numeric(12,2) not null default 0,
 line_total numeric(12,2) not null
);
create table if not exists public.purchases (
 id uuid primary key default gen_random_uuid(), purchase_number text not null unique,
 supplier_name text, supplier_invoice text, subtotal numeric(12,2) not null default 0,
 tax_amount numeric(12,2) not null default 0, total_amount numeric(12,2) not null default 0,
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.purchase_items (
 id uuid primary key default gen_random_uuid(),
 purchase_id uuid not null references public.purchases(id) on delete cascade,
 variant_id uuid not null references public.product_variants(id) on delete restrict,
 quantity integer not null check(quantity>0), unit_cost numeric(12,2) not null check(unit_cost>=0),
 tax_rate numeric(5,2) not null default 0, line_total numeric(12,2) not null
);

alter table public.staff_roles enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

drop policy if exists "Staff read roles" on public.staff_roles;
create policy "Staff read roles" on public.staff_roles for select to authenticated using(public.vjs_is_staff());
drop policy if exists "Owners manage roles" on public.staff_roles;
create policy "Owners manage roles" on public.staff_roles for all to authenticated using(public.is_vjs_admin()) with check(public.is_vjs_admin());
drop policy if exists "Staff manage variants" on public.product_variants;
create policy "Staff manage variants" on public.product_variants for all to authenticated using(public.vjs_is_staff()) with check(public.vjs_is_staff());
drop policy if exists "Staff read movements" on public.inventory_movements;
create policy "Staff read movements" on public.inventory_movements for select to authenticated using(public.vjs_is_staff());
drop policy if exists "Staff read sales" on public.sales;
create policy "Staff read sales" on public.sales for select to authenticated using(public.vjs_is_staff());
drop policy if exists "Staff read sale items" on public.sale_items;
create policy "Staff read sale items" on public.sale_items for select to authenticated using(public.vjs_is_staff());
drop policy if exists "Staff read purchases" on public.purchases;
create policy "Staff read purchases" on public.purchases for select to authenticated using(public.vjs_is_staff());
drop policy if exists "Staff read purchase items" on public.purchase_items;
create policy "Staff read purchase items" on public.purchase_items for select to authenticated using(public.vjs_is_staff());
grant select,insert,update,delete on public.staff_roles,public.product_variants to authenticated;
grant select on public.inventory_movements,public.sales,public.sale_items,public.purchases,public.purchase_items to authenticated;
grant usage,select on sequence public.vjs_invoice_seq to authenticated;

create or replace function public.vjs_adjust_stock(p_variant_id uuid,p_quantity_change integer,p_movement_type text default 'ADJUSTMENT',p_note text default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_stock integer; v_role text;
begin
 v_role:=public.vjs_current_role();
 if v_role not in ('Owner','Manager') then raise exception 'Only Owner or Manager can adjust stock'; end if;
 if p_quantity_change=0 then raise exception 'Quantity change cannot be zero'; end if;
 if p_movement_type not in ('OPENING','PURCHASE','RETURN','ADJUSTMENT','DAMAGE') then raise exception 'Invalid stock movement'; end if;
 select stock_qty into v_stock from public.product_variants where id=p_variant_id for update;
 if not found then raise exception 'Product size not found'; end if;
 if v_stock+p_quantity_change<0 then raise exception 'Insufficient stock'; end if;
 update public.product_variants set stock_qty=stock_qty+p_quantity_change,updated_at=now() where id=p_variant_id returning stock_qty into v_stock;
 insert into public.inventory_movements(variant_id,movement_type,quantity_change,note,created_by)
 values(p_variant_id,p_movement_type,p_quantity_change,p_note,auth.uid());
 return v_stock;
end; $$;

create or replace function public.vjs_create_sale(
 p_customer_name text,p_customer_phone text,p_bill_type text,p_tax_inclusive boolean,
 p_payment_method text,p_discount_amount numeric,p_items jsonb,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_role text:=public.vjs_current_role(); v_sale uuid:=gen_random_uuid(); v_invoice text;
 v_subtotal numeric(12,2):=0; v_discount numeric(12,2):=greatest(coalesce(p_discount_amount,0),0);
 v_taxable numeric(12,2):=0; v_tax numeric(12,2):=0; v_total numeric(12,2):=0;
 v_item jsonb; v_variant public.product_variants%rowtype; v_product public.products%rowtype;
 v_qty integer; v_price numeric(12,2); v_rate numeric(5,2); v_gross numeric(12,2);
 v_line_discount numeric(12,2); v_base numeric(12,2); v_line_tax numeric(12,2); v_line_total numeric(12,2);
begin
 if v_role not in ('Owner','Manager','Cashier') then raise exception 'Not authorised to create bills'; end if;
 if p_bill_type not in ('GST','NON_GST') then raise exception 'Invalid bill type'; end if;
 if p_payment_method not in ('Cash','UPI','Card','Other') then raise exception 'Invalid payment method'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one item'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;
  if v_qty<=0 then raise exception 'Quantity must be positive'; end if;
  select * into v_variant from public.product_variants where id=(v_item->>'variant_id')::uuid and active for update;
  if not found then raise exception 'Selected size is unavailable'; end if;
  if v_variant.stock_qty<v_qty then raise exception 'Insufficient stock for size % (available %)',v_variant.size,v_variant.stock_qty; end if;
  select * into v_product from public.products where id=v_variant.product_id;
  v_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,v_variant.selling_price,v_product.price,0);
  if v_price<0 then raise exception 'Invalid price'; end if;
  v_rate:=case when p_bill_type='GST' then greatest(coalesce(nullif(v_item->>'tax_rate','')::numeric,0),0) else 0 end;
  if v_rate>100 then raise exception 'Invalid GST rate'; end if;
  v_subtotal:=v_subtotal+v_price*v_qty;
 end loop;
 if v_discount>v_subtotal then raise exception 'Discount cannot exceed subtotal'; end if;
 v_invoice:='VJS-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('public.vjs_invoice_seq')::text,5,'0');
 insert into public.sales(id,invoice_number,customer_name,customer_phone,bill_type,tax_inclusive,subtotal,discount_amount,payment_method,notes,created_by)
 values(v_sale,v_invoice,nullif(trim(p_customer_name),''),nullif(trim(p_customer_phone),''),p_bill_type,coalesce(p_tax_inclusive,true),v_subtotal,v_discount,p_payment_method,nullif(trim(p_notes),''),auth.uid());
 for v_item in select value from jsonb_array_elements(p_items) loop
  select * into v_variant from public.product_variants where id=(v_item->>'variant_id')::uuid for update;
  select * into v_product from public.products where id=v_variant.product_id;
  v_qty:=(v_item->>'quantity')::integer;
  v_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,v_variant.selling_price,v_product.price,0);
  v_rate:=case when p_bill_type='GST' then greatest(coalesce(nullif(v_item->>'tax_rate','')::numeric,0),0) else 0 end;
  v_gross:=round(v_price*v_qty,2);
  v_line_discount:=case when v_subtotal=0 then 0 else round(v_discount*v_gross/v_subtotal,2) end;
  v_base:=v_gross-v_line_discount;
  if p_bill_type='GST' and coalesce(p_tax_inclusive,true) then
   v_line_tax:=round(v_base*v_rate/(100+v_rate),2); v_taxable:=v_taxable+v_base-v_line_tax; v_line_total:=v_base;
  elsif p_bill_type='GST' then
   v_line_tax:=round(v_base*v_rate/100,2); v_taxable:=v_taxable+v_base; v_line_total:=v_base+v_line_tax;
  else v_line_tax:=0; v_taxable:=v_taxable+v_base; v_line_total:=v_base; end if;
  v_tax:=v_tax+v_line_tax; v_total:=v_total+v_line_total;
  insert into public.sale_items(sale_id,product_id,variant_id,product_name,brand,model,size,quantity,unit_price,unit_cost,discount_amount,tax_rate,taxable_amount,tax_amount,line_total)
  values(v_sale,v_product.id,v_variant.id,v_product.name,v_product.brand,v_product.model,v_variant.size,v_qty,v_price,v_variant.cost_price,v_line_discount,v_rate,
   case when p_bill_type='GST' and coalesce(p_tax_inclusive,true) then v_base-v_line_tax else v_base end,v_line_tax,v_line_total);
  update public.product_variants set stock_qty=stock_qty-v_qty,updated_at=now() where id=v_variant.id;
  insert into public.inventory_movements(variant_id,movement_type,quantity_change,reference_type,reference_id,note,created_by)
  values(v_variant.id,'SALE',-v_qty,'SALE',v_sale,v_invoice,auth.uid());
 end loop;
 update public.sales set taxable_amount=round(v_taxable,2),tax_amount=round(v_tax,2),total_amount=round(v_total,2) where id=v_sale;
 return jsonb_build_object('id',v_sale,'invoice_number',v_invoice,'subtotal',v_subtotal,'discount_amount',v_discount,'taxable_amount',round(v_taxable,2),'tax_amount',round(v_tax,2),'total_amount',round(v_total,2));
end; $$;
grant execute on function public.vjs_adjust_stock(uuid,integer,text,text) to authenticated;
grant execute on function public.vjs_create_sale(text,text,text,boolean,text,numeric,jsonb,text) to authenticated;
