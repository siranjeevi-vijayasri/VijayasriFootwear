-- Additive migration for model-based catalogue and colour-specific galleries.
-- Run AFTER supabase/schema.sql. Existing products, IDs, images and policies are preserved.

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  colour_name text not null,
  colour_hex text,
  sizes text[] not null default '{}',
  available_sizes text[] not null default '{}',
  availability_synced boolean not null default false,
  image_urls text[] not null default '{}',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_colour_name_nonempty check (length(trim(colour_name)) > 0),
  constraint product_variants_colour_hex_format check (
    colour_hex is null or colour_hex ~ '^#[0-9A-Fa-f]{6}$'
  ),
  constraint product_variants_product_colour_unique unique (product_id, colour_name)
);

create index if not exists product_variants_product_active_idx
  on public.product_variants(product_id, active, sort_order);

alter table public.product_variants add column if not exists availability_synced boolean not null default false;
alter table public.product_variants enable row level security;

drop policy if exists "Public reads variants of published products" on public.product_variants;
create policy "Public reads variants of published products"
  on public.product_variants for select to anon, authenticated
  using (
    active = true and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.published = true
    )
    or public.is_vjs_admin()
  );

drop policy if exists "Admins insert product variants" on public.product_variants;
create policy "Admins insert product variants"
  on public.product_variants for insert to authenticated
  with check (public.is_vjs_admin());

drop policy if exists "Admins update product variants" on public.product_variants;
create policy "Admins update product variants"
  on public.product_variants for update to authenticated
  using (public.is_vjs_admin()) with check (public.is_vjs_admin());

drop policy if exists "Admins delete product variants" on public.product_variants;
create policy "Admins delete product variants"
  on public.product_variants for delete to authenticated
  using (public.is_vjs_admin());

grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

-- Compatibility note:
-- Legacy products continue to render from products.sizes, products.colours and products.image_url.
-- New colour rows are optional during migration. Populate them gradually from VJSManage or the
-- Operations sync; no existing product rows or image objects are rewritten by this migration.
