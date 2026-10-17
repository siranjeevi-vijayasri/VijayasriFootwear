-- Catalogue-triggered social publishing queue.
-- Run once in Supabase SQL Editor after the current catalogue schema is installed.
-- Existing products table and catalogue data are preserved.

create table if not exists public.social_publish_queue (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_snapshot jsonb not null,
  event_type text not null check (event_type in ('created', 'updated')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'published', 'partial', 'failed')),
  attempts integer not null default 0,
  facebook_post_id text,
  instagram_post_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists social_publish_queue_pending_idx
  on public.social_publish_queue (status, created_at)
  where status in ('pending', 'partial');

alter table public.social_publish_queue enable row level security;
revoke all on public.social_publish_queue from anon, authenticated;
-- Netlify's server-side service-role key bypasses RLS. No browser access is granted.

create or replace function public.enqueue_product_social_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed boolean := false;
begin
  if tg_op = 'INSERT' then
    changed := new.published;
  else
    changed := new.published and (
      not old.published
      or (to_jsonb(new) - 'updated_at' - 'created_at')
         is distinct from
         (to_jsonb(old) - 'updated_at' - 'created_at')
    );
  end if;

  if changed then
    insert into public.social_publish_queue (product_id, product_snapshot, event_type)
    values (
      new.id,
      to_jsonb(new),
      case when tg_op = 'INSERT' or not coalesce(old.published, false)
           then 'created' else 'updated' end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists products_enqueue_social_post on public.products;
create trigger products_enqueue_social_post
after insert or update of brand, name, model, category, price, mrp, sizes, colours,
  image_url, description, published
on public.products
for each row execute function public.enqueue_product_social_post();
