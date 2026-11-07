-- Tighten variant permissions: Cashiers may view stock, but only Owner/Manager may edit it.
drop policy if exists "Staff manage variants" on public.product_variants;
drop policy if exists "Staff read variants" on public.product_variants;
drop policy if exists "Managers manage variants" on public.product_variants;
create policy "Staff read variants" on public.product_variants for select to authenticated using(public.vjs_is_staff());
create policy "Managers manage variants" on public.product_variants for all to authenticated
using(public.vjs_current_role() in ('Owner','Manager'))
with check(public.vjs_current_role() in ('Owner','Manager'));

-- POS staff need access to all catalogue products, including unpublished items, for in-store billing.
drop policy if exists "POS staff read products" on public.products;
create policy "POS staff read products" on public.products for select to authenticated using(public.vjs_is_staff());
