-- ============================================================
-- Migration: Media Task Board + Asset Automation
-- Run in Supabase SQL Editor → New Query → Run
--
-- Creates two NEW tables:
--   media_tasks   — the team task board (separate from existing `tasks`)
--   media_assets  — assets auto-created when tasks are completed
--
-- The existing `tasks` table and all its automation are UNTOUCHED.
-- ============================================================

-- ── media_tasks ───────────────────────────────────────────
create table if not exists public.media_tasks (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  description  text,
  assigned_to  text not null,
  created_by   text not null,
  product_name text,                   -- null means "General"
  type         text not null default 'other'
               check (type in ('creative_video','creative_image','landing_page','research','other')),
  status       text not null default 'todo'
               check (status in ('todo','done')),
  asset_link   text,
  visibility   text not null default 'team'
               check (visibility in ('team','admin_only')),
  due_date     date,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- updated_at trigger
drop trigger if exists set_updated_at on public.media_tasks;
create trigger set_updated_at
  before update on public.media_tasks
  for each row execute function public.handle_updated_at();

-- Indexes
create index if not exists idx_media_tasks_assigned_to  on public.media_tasks(assigned_to);
create index if not exists idx_media_tasks_status        on public.media_tasks(status);
create index if not exists idx_media_tasks_due_date      on public.media_tasks(due_date);
create index if not exists idx_media_tasks_product_name  on public.media_tasks(product_name);

-- RLS
alter table public.media_tasks enable row level security;

-- Select: team members see team tasks only; admins see everything
create policy "media_tasks_select" on public.media_tasks
  for select using (
    visibility = 'team'
    or exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "media_tasks_insert" on public.media_tasks
  for insert with check (auth.role() = 'authenticated');

create policy "media_tasks_update" on public.media_tasks
  for update using (auth.role() = 'authenticated');

create policy "media_tasks_delete" on public.media_tasks
  for delete using (auth.role() = 'authenticated');

-- ── media_assets ──────────────────────────────────────────
create table if not exists public.media_assets (
  id             uuid primary key default uuid_generate_v4(),
  product_name   text not null,
  type           text not null
                 check (type in ('creative_video','creative_image','landing_page','other')),
  link           text not null,
  created_by     text not null,
  source_task_id uuid references public.media_tasks(id) on delete set null,
  created_at     timestamptz default now()
);

create index if not exists idx_media_assets_product_name on public.media_assets(product_name);

-- RLS
alter table public.media_assets enable row level security;

create policy "media_assets_select" on public.media_assets
  for select using (auth.role() = 'authenticated');

create policy "media_assets_insert" on public.media_assets
  for insert with check (auth.role() = 'authenticated');

create policy "media_assets_update" on public.media_assets
  for update using (auth.role() = 'authenticated');

create policy "media_assets_delete" on public.media_assets
  for delete using (auth.role() = 'authenticated');

-- Add to realtime
alter publication supabase_realtime add table public.media_tasks;
alter publication supabase_realtime add table public.media_assets;
