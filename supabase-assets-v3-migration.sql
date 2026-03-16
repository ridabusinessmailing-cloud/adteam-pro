-- ============================================================
-- Migration: Product Assets v3 — Multiple Landing Pages
-- Run in Supabase SQL Editor → New Query → Run
--
-- Adds landing_pages table for multi-LP-per-product support.
-- The existing product_assets.landing_page_url column is kept
-- for backward-compat — it will no longer be actively written
-- (new LPs go to this table), but old data is preserved.
-- No existing columns, policies, or tables are modified.
-- ============================================================

-- ── landing_pages ─────────────────────────────────────────
-- Stores multiple landing pages per product, each with an angle name.
create table if not exists public.landing_pages (
  id           uuid primary key default uuid_generate_v4(),
  product_name text not null,        -- matches products.name
  angle_name   text not null,        -- e.g. "Pain Relief", "Focus Angle"
  lp_url       text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- updated_at trigger
drop trigger if exists set_updated_at on public.landing_pages;
create trigger set_updated_at
  before update on public.landing_pages
  for each row execute function public.handle_updated_at();

-- Index for fast product lookups
create index if not exists idx_landing_pages_product_name
  on public.landing_pages(product_name);

-- RLS
alter table public.landing_pages enable row level security;

create policy "auth_read_landing_pages" on public.landing_pages
  for select using (auth.role() = 'authenticated');

create policy "auth_insert_landing_pages" on public.landing_pages
  for insert with check (auth.role() = 'authenticated');

create policy "auth_update_landing_pages" on public.landing_pages
  for update using (auth.role() = 'authenticated');

create policy "auth_delete_landing_pages" on public.landing_pages
  for delete using (auth.role() = 'authenticated');

-- Add to realtime
alter publication supabase_realtime add table public.landing_pages;
