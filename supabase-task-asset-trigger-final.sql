-- ============================================================
-- Task → Product Asset Automation  — DEFINITIVE VERSION
-- Run in Supabase SQL Editor → New Query → Run
--
-- This script is FULLY SELF-CONTAINED and IDEMPOTENT.
-- Safe to run even if previous trigger versions were applied.
-- Safe to run on a fresh database with no prior migrations.
--
-- SCHEMA FACTS (read from actual codebase)
-- ─────────────────────────────────────────────────────────────
-- media_tasks columns:
--   id, title, description, assigned_to, created_by,
--   product_name (text, nullable — null = "General"),
--   type  CHECK IN ('creative_video','creative_image','landing_page','research','other'),
--   status CHECK IN ('todo','done'),
--   asset_link, visibility, due_date, created_at, updated_at
--
-- media_assets columns (after this script):
--   id, product_name, name, type, link, created_by,
--   source_task_id → media_tasks(id),
--   created_at
--
-- landing_pages columns:
--   id, product_name, angle_name, lp_url, created_at, updated_at
--
-- NOTE: The system uses product_name (text), NOT product_id (uuid).
-- This matches every table and every React component in the codebase.
-- ============================================================

-- ── STEP 1: Ensure media_assets has the "name" column ──────
alter table public.media_assets
  add column if not exists name text not null default 'Untitled Asset';

-- ── STEP 2: Add UNIQUE(source_task_id) for deduplication ───
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_assets_source_task_id_unique'
      and conrelid = 'public.media_assets'::regclass
  ) then
    alter table public.media_assets
      add constraint media_assets_source_task_id_unique
      unique (source_task_id);
  end if;
end $$;

-- ── STEP 3: Add UNIQUE(product_name, lp_url) on landing_pages
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'landing_pages_product_lp_url_unique'
      and conrelid = 'public.landing_pages'::regclass
  ) then
    alter table public.landing_pages
      add constraint landing_pages_product_lp_url_unique
      unique (product_name, lp_url);
  end if;
end $$;

-- ── STEP 4: Drop ALL previous versions of this trigger/function
drop trigger if exists on_media_task_done on public.media_tasks;
drop function if exists public.handle_media_task_done() cascade;

-- Restore set_updated_at on media_tasks (cascade drop removes it)
drop trigger if exists set_updated_at on public.media_tasks;
create trigger set_updated_at
  before update on public.media_tasks
  for each row execute function public.handle_updated_at();

-- ── STEP 5: Create the trigger function ────────────────────
create or replace function public.handle_media_task_done()
returns trigger
language plpgsql
security definer   -- runs as DB owner; bypasses RLS completely
set search_path = public
as $$
declare
  v_name       text;
  v_angle_name text;
begin
  -- ── Guard: only fire on status transition todo → done ────
  if not (
    NEW.status    = 'done'
    and OLD.status != 'done'
    and NEW.asset_link   is not null
    and trim(NEW.asset_link)   <> ''
    and NEW.product_name is not null
    and trim(NEW.product_name) <> ''
  ) then
    return NEW;
  end if;

  -- Asset name = task title, trimmed, max 255 chars
  v_name := left(trim(coalesce(NEW.title, '')), 255);
  if v_name = '' then v_name := 'Untitled Asset'; end if;

  -- ── A. INSERT one row into media_assets ──────────────────
  -- UNIQUE(source_task_id) means re-firing this trigger on the
  -- same row (e.g. if another column is updated after done) is safe.
  begin
    insert into public.media_assets (
      product_name,
      name,
      type,
      link,
      created_by,
      source_task_id
    ) values (
      trim(NEW.product_name),
      v_name,
      NEW.type,
      trim(NEW.asset_link),
      coalesce(nullif(trim(NEW.created_by), ''), 'system'),
      NEW.id
    )
    on conflict (source_task_id) do nothing;
  exception when others then
    -- Log but never let asset failure break the task update
    raise warning '[handle_media_task_done] media_assets insert failed: %', sqlerrm;
  end;

  -- ── B. landing_page type: also write to landing_pages ────
  if NEW.type = 'landing_page' then
    v_angle_name := left(trim(coalesce(NEW.title, '')), 60);
    if length(trim(coalesce(NEW.title, ''))) > 60 then
      v_angle_name := left(trim(NEW.title), 57) || '…';
    end if;
    if v_angle_name = '' then v_angle_name := 'Landing Page'; end if;

    begin
      insert into public.landing_pages (product_name, angle_name, lp_url)
      values (
        trim(NEW.product_name),
        v_angle_name,
        trim(NEW.asset_link)
      )
      on conflict (product_name, lp_url) do nothing;
    exception when others then
      raise warning '[handle_media_task_done] landing_pages insert failed: %', sqlerrm;
    end;
  end if;

  return NEW;
end;
$$;

-- ── STEP 6: Attach trigger ──────────────────────────────────
create trigger on_media_task_done
  after update on public.media_tasks
  for each row
  execute function public.handle_media_task_done();

-- ── STEP 7: Verify (run manually after applying) ───────────
--
-- 1. Confirm both triggers on media_tasks:
--    select trigger_name, event_manipulation, action_timing
--    from information_schema.triggers
--    where event_object_table = 'media_tasks'
--    order by trigger_name;
--    Expected rows:
--      on_media_task_done  | UPDATE | AFTER
--      set_updated_at      | UPDATE | BEFORE
--
-- 2. Confirm media_assets columns include "name":
--    select column_name from information_schema.columns
--    where table_name = 'media_assets'
--    order by ordinal_position;
--    Expected: id, product_name, name, type, link, created_by,
--              source_task_id, created_at
--
-- 3. Smoke-test the automation:
--    -- Find a todo task with product_name and asset_link
--    select id, title, type, status, product_name, asset_link
--    from public.media_tasks
--    where status = 'todo'
--      and product_name is not null
--      and asset_link is not null
--    limit 1;
--
--    -- Mark it done (replace the UUID):
--    update public.media_tasks
--    set status = 'done'
--    where id = '<uuid from above>';
--
--    -- Confirm the asset was created:
--    select name, type, link, created_by, source_task_id
--    from public.media_assets
--    order by created_at desc
--    limit 3;
