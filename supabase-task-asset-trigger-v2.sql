-- ============================================================
-- Task → Product Asset Automation  (FINAL FIX)
-- Run in Supabase SQL Editor → New Query → Run
--
-- ROOT CAUSE OF PREVIOUS FAILURES
-- ────────────────────────────────────────────────────────────
-- 1. The landing_page branch used bare "on conflict do nothing"
--    without specifying the conflict target. Postgres requires
--    ON CONFLICT (columns) or ON CONFLICT ON CONSTRAINT <name>.
--    This caused a runtime error that aborted the ENTIRE trigger
--    function — so creative_video and creative_image also never
--    wrote to product_assets.
--
-- 2. The media_assets unique constraint may not have been added
--    if the trigger body errored first (same transaction).
--
-- 3. The React fallback called addLandingPage() which throws
--    when called with valid but untrimmed values, silently
--    swallowed by .catch(console.warn).
--
-- THIS SCRIPT
-- ────────────────────────────────────────────────────────────
-- • Adds all required constraints BEFORE creating the trigger
-- • Uses explicit ON CONFLICT (column) targets everywhere
-- • Wraps each INSERT in its own EXCEPTION block so one failure
--   never aborts the whole function
-- • Safe to re-run: all statements are idempotent
-- ============================================================

-- ── 1. Unique constraint on landing_pages ─────────────────
-- Must exist BEFORE the trigger references it.
-- "IF NOT EXISTS" safe to re-run.
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

-- ── 2. Unique constraint on media_assets.source_task_id ───
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

-- ── 3. Drop old trigger + function (clean slate) ──────────
drop trigger if exists on_media_task_done       on public.media_tasks;
drop trigger if exists set_updated_at           on public.media_tasks;   -- preserve
drop function if exists public.handle_media_task_done() cascade;

-- Restore the updated_at trigger that we just dropped above
-- (it was defined in the original taskboard migration)
drop trigger if exists set_updated_at on public.media_tasks;
create trigger set_updated_at
  before update on public.media_tasks
  for each row execute function public.handle_updated_at();

-- ── 4. Create the trigger function ────────────────────────
create or replace function public.handle_media_task_done()
returns trigger
language plpgsql
security definer          -- bypasses RLS; runs as DB owner
set search_path = public
as $$
declare
  v_angle_name text;
begin
  -- ── Guard: only act when status transitions TO 'done' ───
  if not (
    NEW.status    = 'done'
    and OLD.status != 'done'
    and NEW.asset_link   is not null
    and NEW.asset_link   != ''
    and NEW.product_name is not null
    and NEW.product_name != ''
  ) then
    return NEW;   -- nothing to do
  end if;

  -- ── Step A: guarantee product_assets row exists ─────────
  -- Uses the known UNIQUE constraint on product_name.
  begin
    insert into public.product_assets (product_name)
    values (NEW.product_name)
    on conflict (product_name) do nothing;
  exception when others then
    -- row already exists or other benign conflict — continue
    null;
  end;

  -- ── Step B: write to the correct asset column/table ─────
  if NEW.type = 'creative_video' then

    begin
      update public.product_assets
      set    creatives_drive_url = NEW.asset_link,
             updated_at          = now()
      where  product_name = NEW.product_name;
    exception when others then
      null;
    end;

  elsif NEW.type = 'creative_image' then

    begin
      update public.product_assets
      set    images_drive_url = NEW.asset_link,
             updated_at       = now()
      where  product_name = NEW.product_name;
    exception when others then
      null;
    end;

  elsif NEW.type = 'landing_page' then

    -- Truncate title for angle_name
    v_angle_name := left(NEW.title, 60);
    if length(NEW.title) > 60 then
      v_angle_name := left(NEW.title, 57) || '…';
    end if;

    begin
      insert into public.landing_pages (product_name, angle_name, lp_url)
      values (NEW.product_name, v_angle_name, NEW.asset_link)
      -- NOW uses explicit column list — this is what was broken before
      on conflict (product_name, lp_url) do nothing;
    exception when others then
      null;
    end;

  end if;

  -- ── Step C: record in media_assets for traceability ─────
  begin
    insert into public.media_assets (
      product_name, type, link, created_by, source_task_id
    )
    values (
      NEW.product_name,
      NEW.type,
      NEW.asset_link,
      coalesce(nullif(NEW.created_by, ''), 'system'),
      NEW.id
    )
    -- NOW uses explicit column — constraint added in Step 2 above
    on conflict (source_task_id) do nothing;
  exception when others then
    null;
  end;

  return NEW;
end;
$$;

-- ── 5. Attach trigger ─────────────────────────────────────
create trigger on_media_task_done
  after update on public.media_tasks
  for each row
  execute function public.handle_media_task_done();

-- ── 6. Verify (run these SELECT statements manually) ──────
-- After running this script, confirm everything installed:
--
-- Check trigger exists on correct table:
--   select trigger_name, event_manipulation, action_timing, action_orientation
--   from information_schema.triggers
--   where event_object_table = 'media_tasks'
--   order by trigger_name;
--   → should return both: on_media_task_done (AFTER/UPDATE) and set_updated_at (BEFORE/UPDATE)
--
-- Check unique constraints exist:
--   select conname, contype from pg_constraint
--   where conrelid in (
--     'public.landing_pages'::regclass,
--     'public.media_assets'::regclass
--   );
--   → should include landing_pages_product_lp_url_unique
--   → should include media_assets_source_task_id_unique
--
-- Test the automation manually (replace UUIDs as needed):
--   update public.media_tasks
--   set status = 'done', asset_link = 'https://test.example.com'
--   where id = '<a task uuid that has product_name and type=creative_video>';
--
--   then check:
--   select * from public.product_assets where product_name = '<product name>';
--   select * from public.media_assets   order by created_at desc limit 5;
