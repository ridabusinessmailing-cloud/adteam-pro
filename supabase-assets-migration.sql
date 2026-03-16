-- ============================================================
-- Migration: Product Assets
-- Run in Supabase SQL Editor → New Query → Run
--
-- Adds one new table: product_assets
-- Nothing else is modified.
-- ============================================================

-- ── product_assets ─────────────────────────────────────────
-- Stores deliverable links that Saida provides when completing
-- her workflow tasks. One row per product (upserted on conflict).
-- All URL columns are nullable — they are filled progressively
-- as each task is completed.

create table if not exists public.product_assets (
  id                   uuid primary key default uuid_generate_v4(),
  product_name         text not null unique,   -- matches products.name
  landing_page_url     text,                   -- from "Create landing page" task
  creatives_drive_url  text,                   -- from "Create 4 video creatives" task
  images_drive_url     text,                   -- from "Create 1 static image" task
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- updated_at trigger
drop trigger if exists set_updated_at on public.product_assets;
create trigger set_updated_at
  before update on public.product_assets
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.product_assets enable row level security;

create policy "auth_read_product_assets" on public.product_assets
  for select using (auth.role() = 'authenticated');

create policy "auth_insert_product_assets" on public.product_assets
  for insert with check (auth.role() = 'authenticated');

create policy "auth_update_product_assets" on public.product_assets
  for update using (auth.role() = 'authenticated');

-- Add to realtime so the Products page updates live
alter publication supabase_realtime add table public.product_assets;
