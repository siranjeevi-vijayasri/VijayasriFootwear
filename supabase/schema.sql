-- Run this whole script in Supabase SQL Editor before deploying.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  name text not null,
  model text,
  category text not null default 'Other',
  price numeric(10,2) check (price is null or price >= 0),
  mrp numeric(10,2) check (mrp is null or mrp >= 0),
  sizes text,
  colours text,
  image_url text,
  source_url text,
  description text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_published_created_idx on public.products (published, created_at desc);

-- SECURITY DEFINER avoids recursive RLS checks on admin_users.
create or replace function public.is_vjs_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users a where a.user_id = auth.uid()); $$;
revoke all on function public.is_vjs_admin() from public;
grant execute on function public.is_vjs_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;

drop policy if exists "Admins can read admin membership" on public.admin_users;
create policy "Admins can read admin membership" on public.admin_users for select to authenticated using (user_id = auth.uid() or public.is_vjs_admin());

drop policy if exists "Public reads published products" on public.products;
create policy "Public reads published products" on public.products for select to anon, authenticated using (published = true or public.is_vjs_admin());
drop policy if exists "Admins insert products" on public.products;
create policy "Admins insert products" on public.products for insert to authenticated with check (public.is_vjs_admin());
drop policy if exists "Admins update products" on public.products;
create policy "Admins update products" on public.products for update to authenticated using (public.is_vjs_admin()) with check (public.is_vjs_admin());
drop policy if exists "Admins delete products" on public.products;
create policy "Admins delete products" on public.products for delete to authenticated using (public.is_vjs_admin());

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.admin_users to authenticated;

-- Create the product-images bucket as public for image display. The object write policies below remain admin-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_vjs_admin());
drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_vjs_admin()) with check (bucket_id = 'product-images' and public.is_vjs_admin());
drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_vjs_admin());

-- FIRST ADMIN SETUP (after creating the user in Supabase Authentication > Users):
-- insert into public.admin_users (user_id) values ('PASTE-AUTH-USER-UUID-HERE');
