-- ============================================================
-- Migration: Product Assets v2 — Extended Asset Types
-- Run in Supabase SQL Editor → New Query → Run
--
-- Adds 4 new columns to the existing product_assets table.
-- Safe to run even if some columns already exist (IF NOT EXISTS).
-- No existing columns, policies, or tables are modified.
-- ============================================================

alter table public.product_assets
  add column if not exists ugc_videos_url            text,   -- UGC Videos
  add column if not exists ad_hooks_url              text,   -- Ad Hooks
  add column if not exists ad_copies_url             text,   -- Ad Copies
  add column if not exists product_documentation_url text;   -- PDF / Notion / Drive doc
