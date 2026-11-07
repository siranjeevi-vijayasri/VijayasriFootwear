-- Vijayasri Footwear POS compatibility patch
-- Additive only: preserves existing catalogue products and every stock quantity.
-- Apply after 20261101_footwear_pos.sql and 20261101_footwear_pos_security_fix.sql.
begin;
alter table public.product_variants
  add column if not exists cost_price numeric(12,2) not null default 0,
  add column if not exists selling_price numeric(12,2),
  add column if not exists sku text;
alter table public.sale_items add column if not exists colour text;

create or replace function public.vjs_adjust_stock(
 p_variant_id uuid,p_quantity_change integer,p_movement_type text default 'ADJUSTMENT',p_note text default null
) returns integer language plpgsql security definer set search_path=public as $$
declare v_stock integer; v_role text;
begin
 v_role:=public.vjs_current_role();
 if v_role not in ('Owner','Manager') then raise exception 'Only Owner or Manager can adjust stock'; end if;
 if p_quantity_change is null or p_quantity_change=0 then raise exception 'Quantity change cannot be zero'; end if;
 if p_movement_type not in ('OPENING','PURCHASE','RETURN','ADJUSTMENT','DAMAGE') then raise exception 'Invalid stock movement'; end if;
 select stock_quantity into v_stock from public.product_variants where id=p_variant_id for update;
 if not found then raise exception 'Product size/colour not found'; end if;
 if v_stock+p_quantity_change<0 then raise exception 'Insufficient stock'; end if;
 update public.product_variants set stock_quantity=stock_quantity+p_quantity_change,updated_at=now()
 where id=p_variant_id returning stock_quantity into v_stock;
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
 v_item jsonb; v_variant public.product_variants%rowtype; v_product public.catalog_products%rowtype;
 v_seen_variants uuid[]:=array[]::uuid[]; v_variant_id uuid;
 v_qty integer; v_price numeric(12,2); v_rate numeric(5,2); v_gross numeric(12,2);
 v_line_discount numeric(12,2); v_base numeric(12,2); v_line_tax numeric(12,2); v_line_total numeric(12,2);
begin
 if v_role not in ('Owner','Manager','Cashier') then raise exception 'Not authorised to create bills'; end if;
 if p_bill_type is null or p_bill_type not in ('GST','NON_GST') then raise exception 'Invalid bill type'; end if;
 if p_payment_method is null or p_payment_method not in ('Cash','UPI','Card','Other') then raise exception 'Invalid payment method'; end if;
 if coalesce(p_discount_amount,0)<0 then raise exception 'Discount cannot be negative'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one item'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;
  if v_qty is null or v_qty<=0 then raise exception 'Quantity must be positive'; end if;
  v_variant_id:=(v_item->>'variant_id')::uuid;
  if v_variant_id is null or v_variant_id=any(v_seen_variants) then raise exception 'Each valid size/colour can appear only once per bill'; end if;
  v_seen_variants:=array_append(v_seen_variants,v_variant_id);
  select * into v_variant from public.product_variants where id=v_variant_id and is_active for update;
  if not found then raise exception 'Selected size/colour is unavailable'; end if;
  if v_variant.stock_quantity<v_qty then raise exception 'Insufficient stock for size % colour % (available %)',v_variant.size,v_variant.colour,v_variant.stock_quantity; end if;
  select * into v_product from public.catalog_products where id=v_variant.product_id;
  if not found then raise exception 'Catalogue product not found for selected variant'; end if;
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
  v_variant_id:=(v_item->>'variant_id')::uuid;
  select * into v_variant from public.product_variants where id=v_variant_id;
  select * into v_product from public.catalog_products where id=v_variant.product_id;
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
  insert into public.sale_items(sale_id,product_id,variant_id,product_name,brand,model,size,colour,quantity,unit_price,unit_cost,discount_amount,tax_rate,taxable_amount,tax_amount,line_total)
  values(v_sale,v_product.source_product_id,v_variant.id,v_product.name,v_product.brand,v_product.model,v_variant.size,v_variant.colour,v_qty,v_price,v_variant.cost_price,v_line_discount,v_rate,
   case when p_bill_type='GST' and coalesce(p_tax_inclusive,true) then v_base-v_line_tax else v_base end,v_line_tax,v_line_total);
  update public.product_variants set stock_quantity=stock_quantity-v_qty,updated_at=now() where id=v_variant.id;
  insert into public.inventory_movements(variant_id,movement_type,quantity_change,reference_type,reference_id,note,created_by)
  values(v_variant.id,'SALE',-v_qty,'SALE',v_sale,v_invoice,auth.uid());
 end loop;
 update public.sales set taxable_amount=round(v_taxable,2),tax_amount=round(v_tax,2),total_amount=round(v_total,2) where id=v_sale;
 return jsonb_build_object('id',v_sale,'invoice_number',v_invoice,'subtotal',v_subtotal,'discount_amount',v_discount,
  'taxable_amount',round(v_taxable,2),'tax_amount',round(v_tax,2),'total_amount',round(v_total,2));
end; $$;
grant execute on function public.vjs_adjust_stock(uuid,integer,text,text) to authenticated;
grant execute on function public.vjs_create_sale(text,text,text,boolean,text,numeric,jsonb,text) to authenticated;
commit;
