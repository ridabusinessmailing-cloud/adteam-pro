-- ============================================================
-- AdTeam Pro — Supabase Schema
-- Run this entire file in your Supabase SQL Editor:
-- https://app.supabase.com → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── users (mirrors auth.users, stores role) ────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text not null,
  role        text not null check (role in ('admin', 'member')) default 'member',
  created_at  timestamptz default now()
);

-- ── creative_ideas ─────────────────────────────────────────
create table if not exists public.creative_ideas (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  reference_link  text,
  product         text,
  added_by        text not null,
  status          text not null default 'Idea'
                  check (status in ('Idea','Approved','In production','Ready for ads','Tested','Winner')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── products ───────────────────────────────────────────────
create table if not exists public.products (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  product_link      text,
  supplier          text,
  added_by          text not null,
  validation_status text not null default 'Pending'
                    check (validation_status in (
                      'Pending','Approved','Rejected',
                      'In creative production','Testing','Scaling','Killed'
                    )),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── creatives ──────────────────────────────────────────────
create table if not exists public.creatives (
  id               uuid primary key default uuid_generate_v4(),
  product          text not null,
  creative_type    text not null check (creative_type in ('Video','Static','Landing Page')),
  drive_link       text,
  landing_page_link text,
  assigned_to      text not null,
  status           text not null default 'To do'
                   check (status in ('To do','In progress','Ready')),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── ads_tests ──────────────────────────────────────────────
create table if not exists public.ads_tests (
  id           uuid primary key default uuid_generate_v4(),
  product      text not null,
  creative     text,
  platform     text not null check (platform in ('Facebook','TikTok','Snapchat','YouTube')),
  test_budget  numeric(10,2) default 0,
  spend        numeric(10,2) default 0,
  leads        integer default 0,
  cpl          numeric(10,2) default 0,
  result       text not null default 'Testing'
               check (result in ('Testing','Scaling','Winner','Killed')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── inventory ──────────────────────────────────────────────
create table if not exists public.inventory (
  id                  uuid primary key default uuid_generate_v4(),
  product             text not null unique,
  sku                 text,
  available_stock     integer not null default 0,
  requested_stock     integer not null default 0,
  incoming_stock      integer not null default 0,
  total_sold          integer not null default 0,
  low_stock_threshold integer not null default 50,
  notes               text,
  last_update         date default current_date,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── stock_history (append-only, never delete) ──────────────
create table if not exists public.stock_history (
  id              uuid primary key default uuid_generate_v4(),
  date            date not null default current_date,
  product         text not null,
  quantity_change integer not null,
  movement_type   text not null check (movement_type in ('Requested','Received','Sale','Adjustment')),
  updated_by      text not null,
  notes           text,
  created_at      timestamptz default now()
);

-- ── tasks ──────────────────────────────────────────────────
create table if not exists public.tasks (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  team            text check (team in ('Creative','Media Buying','Operations')),
  assigned_to     text not null,
  deadline        date,
  priority        text not null default 'Medium'
                  check (priority in ('Low','Medium','High','Urgent')),
  column_name     text not null default 'To do'
                  check (column_name in ('Backlog','To do','In progress','Review','Done')),
  related_product text,
  drive_links     text,
  completed       boolean not null default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── updated_at triggers ────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ 
declare t text;
begin
  foreach t in array array[
    'creative_ideas','products','creatives','ads_tests','inventory','tasks'
  ] loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.handle_updated_at();', t, t
    );
  end loop;
end $$;

-- ── Row Level Security ─────────────────────────────────────
alter table public.users          enable row level security;
alter table public.creative_ideas enable row level security;
alter table public.products       enable row level security;
alter table public.creatives      enable row level security;
alter table public.ads_tests      enable row level security;
alter table public.inventory      enable row level security;
alter table public.stock_history  enable row level security;
alter table public.tasks          enable row level security;

-- Everyone authenticated can read all tables
create policy "auth_read_all" on public.creative_ideas for select using (auth.role() = 'authenticated');
create policy "auth_read_all" on public.products       for select using (auth.role() = 'authenticated');
create policy "auth_read_all" on public.creatives      for select using (auth.role() = 'authenticated');
create policy "auth_read_all" on public.ads_tests      for select using (auth.role() = 'authenticated');
create policy "auth_read_all" on public.inventory      for select using (auth.role() = 'authenticated');
create policy "auth_read_all" on public.stock_history  for select using (auth.role() = 'authenticated');
create policy "auth_read_all" on public.tasks          for select using (auth.role() = 'authenticated');
create policy "auth_read_self" on public.users         for select using (auth.uid() = id);

-- Authenticated users can insert/update most tables
create policy "auth_insert" on public.creative_ideas for insert with check (auth.role() = 'authenticated');
create policy "auth_insert" on public.products       for insert with check (auth.role() = 'authenticated');
create policy "auth_insert" on public.creatives      for insert with check (auth.role() = 'authenticated');
create policy "auth_insert" on public.ads_tests      for insert with check (auth.role() = 'authenticated');
create policy "auth_insert" on public.tasks          for insert with check (auth.role() = 'authenticated');
create policy "auth_insert" on public.stock_history  for insert with check (auth.role() = 'authenticated');

create policy "auth_update" on public.creative_ideas for update using (auth.role() = 'authenticated');
create policy "auth_update" on public.creatives      for update using (auth.role() = 'authenticated');
create policy "auth_update" on public.ads_tests      for update using (auth.role() = 'authenticated');
create policy "auth_update" on public.tasks          for update using (auth.role() = 'authenticated');

-- Admin-only: update products & inventory
create policy "admin_update_products" on public.products for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "admin_update_inventory" on public.inventory for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "admin_insert_inventory" on public.inventory for insert
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Delete only admins
create policy "admin_delete" on public.creative_ideas for delete
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "admin_delete" on public.products for delete
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "admin_delete" on public.creatives for delete
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "admin_delete" on public.ads_tests for delete
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "admin_delete" on public.tasks for delete
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- stock_history is append-only: no update or delete ever
-- (no update/delete policy = denied for all)

-- ── Realtime publications ──────────────────────────────────
drop publication if exists supabase_realtime;
create publication supabase_realtime for table
  public.creative_ideas,
  public.products,
  public.creatives,
  public.ads_tests,
  public.inventory,
  public.stock_history,
  public.tasks;

-- ── Seed: create the 4 team accounts in auth ──────────────
-- NOTE: Create these users in Supabase Dashboard →
-- Authentication → Users → Add User, then run the inserts below.
-- Replace the UUIDs with the real ones Supabase generates.

-- insert into public.users (id, email, name, role) values
--   ('REPLACE-WITH-RIDA-UUID',    'rida@yourcompany.com',    'Rida',    'admin'),
--   ('REPLACE-WITH-OUSSAMA-UUID', 'oussama@yourcompany.com', 'Oussama', 'admin'),
--   ('REPLACE-WITH-SAIDA-UUID',   'saida@yourcompany.com',   'Saida',   'member'),
--   ('REPLACE-WITH-SANA-UUID',    'sana@yourcompany.com',    'Sana',    'member');
