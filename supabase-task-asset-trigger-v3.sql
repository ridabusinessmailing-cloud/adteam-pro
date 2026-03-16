-- ============================================================
-- Task → Product Asset Automation  v3  (INSERT-per-task model)
-- Run in Supabase SQL Editor → New Query → Run
--
-- WHAT THIS FIXES
-- ────────────────────────────────────────────────────────────
-- The previous trigger used UPDATE on product_assets to store
-- creatives_drive_url / images_drive_url.  That model meant
-- Task 2 silently overwrote Task 1's asset.
--
-- The correct model: every completed task creates ONE new row
-- in media_assets (INSERT, never UPDATE).  media_assets already
-- exists with the right FK but was missing a "name" column and
-- the trigger was not populating it.
--
-- The Product Assets page must then read ALL rows from
-- media_assets for each product, not the single-row product_assets.
--
-- CHANGES IN THIS SCRIPT
-- 1. Add  media_assets.name  column (= task title)
-- 2. Drop the old trigger + function
-- 3. Re-create trigger that ONLY does:
--      a) INSERT into media_assets (with name = task.title)
--      b) INSERT into landing_pages for landing_page type
--      c) No UPDATE on product_assets for creatives
-- 4. Unique constraint on source_task_id stays (dedup)
-- ============================================================

-- ── 1. Add "name" column to media_assets if missing ────────
alter table public.media_assets
  add column if not exists name text;

-- Back-fill existing rows: use the link as a placeholder name
-- (only affects rows already in the table, if any)
update public.media_assets
set    name = coalesce(name, 'Asset - ' || type)
where  name is null;

-- Make name NOT NULL going forward
-- (We can't use NOT NULL directly if column just added; use a default then alter)
alter table public.media_assets
  alter column name set default 'Untitled Asset';

-- ── 2. Ensure unique constraint on source_task_id ──────────
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

-- ── 3. Ensure unique constraint on landing_pages ───────────
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

-- ── 4. Drop old trigger and function ───────────────────────
drop trigger if exists on_media_task_done on public.media_tasks;
drop function if exists public.handle_media_task_done() cascade;

-- Restore set_updated_at which cascade-drop may have removed
drop trigger if exists set_updated_at on public.media_tasks;
create trigger set_updated_at
  before update on public.media_tasks
  for each row execute function public.handle_updated_at();

-- ── 5. New trigger function ────────────────────────────────
create or replace function public.handle_media_task_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_angle_name text;
  v_asset_name text;
begin
  -- Guard: only act when status transitions TO 'done'
  -- with a non-empty asset_link and a product_name
  if not (
    NEW.status    = 'done'
    and OLD.status != 'done'
    and NEW.asset_link   is not null
    and trim(NEW.asset_link)   != ''
    and NEW.product_name is not null
    and trim(NEW.product_name) != ''
  ) then
    return NEW;
  end if;

  -- Asset name = task title (trimmed, capped at 255 chars)
  v_asset_name := left(trim(NEW.title), 255);
  if v_asset_name = '' then
    v_asset_name := 'Untitled Asset';
  end if;

  -- ── A. INSERT a new row in media_assets ──────────────────
  --    UNIQUE(source_task_id) prevents duplicate rows if the
  --    trigger fires twice (e.g. re-saves of same done status).
  begin
    insert into public.media_assets (
      product_name,
      name,
      type,
      link,
      created_by,
      source_task_id
    )
    values (
      trim(NEW.product_name),
      v_asset_name,
      NEW.type,
      trim(NEW.asset_link),
      coalesce(nullif(trim(NEW.created_by), ''), 'system'),
      NEW.id
    )
    on conflict (source_task_id) do nothing;
  exception when others then
    null; -- already exists or other benign error
  end;

  -- ── B. For landing_page type: also add to landing_pages ──
  --    landing_pages is the structured LP store read by the
  --    Product Assets page LP section.
  if NEW.type = 'landing_page' then
    v_angle_name := left(trim(NEW.title), 60);
    if length(trim(NEW.title)) > 60 then
      v_angle_name := left(trim(NEW.title), 57) || '…';
    end if;

    begin
      insert into public.landing_pages (product_name, angle_name, lp_url)
      values (
        trim(NEW.product_name),
        v_angle_name,
        trim(NEW.asset_link)
      )
      on conflict (product_name, lp_url) do nothing;
    exception when others then
      null;
    end;
  end if;

  -- NOTE: We do NOT update product_assets.creatives_drive_url or
  -- images_drive_url here.  Those columns are for manually-uploaded
  -- single links.  Task completions create media_assets rows instead,
  -- so multiple tasks of the same type each get their own record.

  return NEW;
end;
$$;

-- ── 6. Attach trigger ──────────────────────────────────────
create trigger on_media_task_done
  after update on public.media_tasks
  for each row
  execute function public.handle_media_task_done();

-- ── 7. Grant (trigger fires automatically on UPDATE) ───────
grant execute on function public.handle_media_task_done() to authenticated;

-- ── 8. Verify ──────────────────────────────────────────────
-- Run these after applying to confirm correctness:
--
-- Triggers on media_tasks:
--   select trigger_name, event_manipulation, action_timing
--   from information_schema.triggers
--   where event_object_table = 'media_tasks';
--   → on_media_task_done  | UPDATE | AFTER
--   → set_updated_at      | UPDATE | BEFORE
--
-- Columns on media_assets:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'media_assets' order by ordinal_position;
--   → id, product_name, name, type, link, created_by, source_task_id, created_at
--
-- Manual smoke test:
--   update public.media_tasks
--   set status = 'done', asset_link = 'https://drive.google.com/test'
--   where id = (select id from public.media_tasks
--               where status = 'todo' and product_name is not null
--               and asset_link is not null limit 1);
--
--   select name, type, link, created_by, source_task_id
--   from public.media_assets
--   order by created_at desc limit 3;
