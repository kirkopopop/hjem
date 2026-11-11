-- Things: a shared wishlist (for a person or for the home) and a register of
-- bigger purchases with warranty dates, manuals, receipts and attached files.

-- ---------- Purchases ----------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 100),
  model text check (char_length(model) <= 100),
  category text not null default 'other'
    check (category in ('electronics', 'appliance', 'kitchen', 'furniture', 'baby', 'sports', 'tools', 'clothing', 'vehicle', 'other')),
  -- Whose it is; null = the whole household.
  owner_id uuid references auth.users(id) on delete set null,
  store text check (char_length(store) <= 120),
  price numeric(12, 2) check (price is null or price >= 0),
  currency text not null default 'DKK' check (currency ~ '^[A-Z]{3}$'),
  purchased_on date,
  warranty_until date,
  serial_number text check (char_length(serial_number) <= 120),
  manual_url text check (char_length(manual_url) <= 2000),
  product_url text check (char_length(product_url) <= 2000),
  receipt_url text check (char_length(receipt_url) <= 2000),
  notes text check (char_length(notes) <= 4000),
  -- Uploaded files: [{ path, name, kind: receipt|manual|photo|other, size, type }]
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchases_household_idx on public.purchases (household_id, purchased_on desc);

alter table public.purchases enable row level security;

drop policy if exists "purchases: members read" on public.purchases;
create policy "purchases: members read" on public.purchases for select to authenticated
  using (public.is_household_member(household_id));
drop policy if exists "purchases: members insert" on public.purchases;
create policy "purchases: members insert" on public.purchases for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = (select auth.uid()));
drop policy if exists "purchases: members update" on public.purchases;
create policy "purchases: members update" on public.purchases for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
drop policy if exists "purchases: members delete" on public.purchases;
create policy "purchases: members delete" on public.purchases for delete to authenticated
  using (public.is_household_member(household_id));

drop trigger if exists purchases_touch on public.purchases;
create trigger purchases_touch before update on public.purchases
  for each row execute function public.touch_updated_at();

-- ---------- Wishlist ----------
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  -- Who it's for; null = the home.
  for_user_id uuid references auth.users(id) on delete set null,
  -- Private items (e.g. gift ideas) are only visible to whoever added them.
  is_private boolean not null default false,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  price_estimate numeric(12, 2) check (price_estimate is null or price_estimate >= 0),
  currency text not null default 'DKK' check (currency ~ '^[A-Z]{3}$'),
  url text check (char_length(url) <= 2000),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'wanted' check (status in ('wanted', 'bought')),
  bought_at timestamptz,
  bought_by uuid references auth.users(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wishlist_household_idx on public.wishlist_items (household_id, status);

alter table public.wishlist_items enable row level security;

drop policy if exists "wishlist: members read" on public.wishlist_items;
create policy "wishlist: members read" on public.wishlist_items for select to authenticated
  using (public.is_household_member(household_id) and (not is_private or created_by = (select auth.uid())));
drop policy if exists "wishlist: members insert" on public.wishlist_items;
create policy "wishlist: members insert" on public.wishlist_items for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = (select auth.uid()));
drop policy if exists "wishlist: members update" on public.wishlist_items;
create policy "wishlist: members update" on public.wishlist_items for update to authenticated
  using (public.is_household_member(household_id) and (not is_private or created_by = (select auth.uid())))
  with check (public.is_household_member(household_id) and (not is_private or created_by = (select auth.uid())));
drop policy if exists "wishlist: members delete" on public.wishlist_items;
create policy "wishlist: members delete" on public.wishlist_items for delete to authenticated
  using (public.is_household_member(household_id) and (not is_private or created_by = (select auth.uid())));

-- Before write: keep timestamps honest; the wall tablet can't make private items;
-- record who marked it bought and when.
create or replace function public.wishlist_before_write()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare uid uuid := (select auth.uid());
begin
  new.updated_at := now();
  if new.is_private and exists (
       select 1 from public.household_members d
       where d.user_id = new.created_by and d.household_id = new.household_id and d.role = 'device') then
    new.is_private := false;
  end if;
  if new.status = 'bought' and (tg_op = 'INSERT' or old.status <> 'bought') then
    new.bought_at := now();
    new.bought_by := coalesce(uid, new.bought_by);
  elsif new.status = 'wanted' and tg_op = 'UPDATE' and old.status = 'bought' then
    new.bought_at := null;
    new.bought_by := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists wishlist_before_write on public.wishlist_items;
create trigger wishlist_before_write before insert or update on public.wishlist_items
  for each row execute function public.wishlist_before_write();

-- Badges: first wish ticked off ("wish_granted"), and five purchases on record together ("paper_trail").
create or replace function public.wishlist_after_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.status = 'bought' and old.status <> 'bought' and new.bought_by is not null then
    perform public.award_badge(new.household_id, new.bought_by, 'wish_granted');
  end if;
  return new;
end;
$function$;
drop trigger if exists wishlist_after_update on public.wishlist_items;
create trigger wishlist_after_update after update on public.wishlist_items
  for each row execute function public.wishlist_after_update();

create or replace function public.purchases_after_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if (select count(*) from public.purchases where household_id = new.household_id) >= 5 then
    perform public.award_badge(new.household_id, null, 'paper_trail');
  end if;
  return new;
end;
$function$;
drop trigger if exists purchases_after_insert on public.purchases;
create trigger purchases_after_insert after insert on public.purchases
  for each row execute function public.purchases_after_insert();

revoke execute on function public.wishlist_after_update() from anon, authenticated, public;
revoke execute on function public.purchases_after_insert() from anon, authenticated, public;

-- Live sync across phones and the wall tablet.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'wishlist_items') then
    alter publication supabase_realtime add table public.wishlist_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'purchases') then
    alter publication supabase_realtime add table public.purchases;
  end if;
end $$;

-- ---------- Files (receipts, manuals, photos) ----------
-- Private bucket; objects live under "<household_id>/<purchase_id>/<file>".
insert into storage.buckets (id, name, public, file_size_limit)
values ('purchase-files', 'purchase-files', false, 20971520)
on conflict (id) do nothing;

create or replace function public.is_household_folder(folder text)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.household_members m
    where m.household_id::text = folder and m.user_id = (select auth.uid())
  );
$function$;
revoke execute on function public.is_household_folder(text) from anon, public;
grant execute on function public.is_household_folder(text) to authenticated;

drop policy if exists "purchase files: members read" on storage.objects;
create policy "purchase files: members read" on storage.objects for select to authenticated
  using (bucket_id = 'purchase-files' and public.is_household_folder((storage.foldername(name))[1]));
drop policy if exists "purchase files: members upload" on storage.objects;
create policy "purchase files: members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'purchase-files' and public.is_household_folder((storage.foldername(name))[1]));
drop policy if exists "purchase files: members delete" on storage.objects;
create policy "purchase files: members delete" on storage.objects for delete to authenticated
  using (bucket_id = 'purchase-files' and public.is_household_folder((storage.foldername(name))[1]));
