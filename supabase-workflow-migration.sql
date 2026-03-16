-- ============================================================
-- Migration: Product Testing Workflow Automation
-- Run in Supabase SQL Editor → New Query → Run
--
-- This ONLY adds one new table.
-- No existing tables, columns, or policies are modified.
-- ============================================================

-- ── workflow_timers ────────────────────────────────────────
-- Tracks when a "Launch test campaign" task is completed
-- so the frontend can fire the 24h Rida review task.
-- One row per product (upserted on conflict).

create table if not exists public.workflow_timers (
  id                    uuid primary key default uuid_generate_v4(),
  product_name          text not null unique,
  campaign_completed_at timestamptz not null,
  review_task_created   boolean not null default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- updated_at trigger (reuses existing handle_updated_at function)
drop trigger if exists set_updated_at on public.workflow_timers;
create trigger set_updated_at
  before update on public.workflow_timers
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.workflow_timers enable row level security;

create policy "auth_read_workflow_timers" on public.workflow_timers
  for select using (auth.role() = 'authenticated');

create policy "auth_insert_workflow_timers" on public.workflow_timers
  for insert with check (auth.role() = 'authenticated');

create policy "auth_update_workflow_timers" on public.workflow_timers
  for update using (auth.role() = 'authenticated');

-- Add to realtime publication
alter publication supabase_realtime add table public.workflow_timers;
