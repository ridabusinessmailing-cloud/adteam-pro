-- ============================================================
-- Migration: update products table for new spreadsheet layout
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================

-- 1. Add new columns (safe to run even if some already exist)
alter table public.products
  add column if not exists sku           text,
  add column if not exists status        text not null default 'test'
                                         check (status in ('test', 'active')),
  add column if not exists available_qty integer not null default 0,
  add column if not exists sold_qty      integer not null default 0,
  add column if not exists add_qty       integer not null default 0,
  add column if not exists incoming_qty  integer not null default 0;

-- 2. Drop the old constraint on validation_status if it exists
--    (the new schema no longer uses that column)
alter table public.products
  drop column if exists validation_status,
  drop column if exists product_link,
  drop column if exists supplier,
  drop column if exists added_by;

-- 3. Drop old RLS policies for products so we can replace them
drop policy if exists "auth_insert"           on public.products;
drop policy if exists "auth_update"           on public.products;
drop policy if exists "admin_update_products" on public.products;
drop policy if exists "admin_delete"          on public.products;

-- 4. New simplified policies — all authenticated users can do everything
--    (you can tighten this if needed)
create policy "auth_insert_products" on public.products
  for insert with check (auth.role() = 'authenticated');

create policy "auth_update_products" on public.products
  for update using (auth.role() = 'authenticated');

create policy "auth_delete_products" on public.products
  for delete using (auth.role() = 'authenticated');
