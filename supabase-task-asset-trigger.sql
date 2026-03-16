-- ============================================================
-- Migration: Task → Product Asset Automation (Database Trigger)
-- Run in Supabase SQL Editor → New Query → Run
--
-- WHY THIS IS NEEDED
-- The React-side automation was silently failing because:
--   1. RLS policies block the anon/service role from upsert in some paths
--   2. Race conditions between update() resolving and createMediaAsset()
--   3. Stale task objects passed to the JS automation function
--   4. Silent .catch(console.warn) hiding real errors
--
-- This trigger runs INSIDE Postgres as a SECURITY DEFINER function,
-- bypassing RLS, atomically, every time a media_task row is updated.
-- ============================================================

-- ── Step 1: Create the trigger function ──────────────────
create or replace function public.handle_media_task_done()
returns trigger
language plpgsql
security definer                -- runs as table owner, bypasses RLS
set search_path = public
as $$
declare
  v_angle_name text;
begin
  -- ── Only fire when status transitions TO 'done' ──────────
  -- OLD.status != 'done' ensures we don't re-run on subsequent updates
  if (NEW.status = 'done'
      and OLD.status != 'done'
      and NEW.asset_link is not null
      and NEW.asset_link != ''
      and NEW.product_name is not null
      and NEW.product_name != '') then

    -- ── 1. Ensure product_assets row exists ──────────────
    insert into public.product_assets (product_name)
    values (NEW.product_name)
    on conflict (product_name) do nothing;

    -- ── 2. Map task type → correct asset storage ─────────
    if NEW.type = 'creative_video' then
      -- Update creatives_drive_url on the product_assets row
      update public.product_assets
      set    creatives_drive_url = NEW.asset_link,
             updated_at          = now()
      where  product_name = NEW.product_name;

    elsif NEW.type = 'creative_image' then
      -- Update images_drive_url on the product_assets row
      update public.product_assets
      set    images_drive_url = NEW.asset_link,
             updated_at       = now()
      where  product_name = NEW.product_name;

    elsif NEW.type = 'landing_page' then
      -- Insert into landing_pages (deduplicated by product_name + lp_url)
      v_angle_name := left(NEW.title, 60);
      if length(NEW.title) > 60 then
        v_angle_name := left(NEW.title, 57) || '…';
      end if;

      insert into public.landing_pages (product_name, angle_name, lp_url)
      values (NEW.product_name, v_angle_name, NEW.asset_link)
      on conflict do nothing;   -- landing_pages has no unique constraint yet;
                                -- see Step 3 below for the constraint we add
    end if;

    -- ── 3. Record in media_assets for traceability ───────
    -- Deduplicated by source_task_id (only insert once per task)
    insert into public.media_assets (
      product_name, type, link, created_by, source_task_id
    )
    values (
      NEW.product_name,
      NEW.type,
      NEW.asset_link,
      coalesce(NEW.created_by, ''),
      NEW.id
    )
    on conflict (source_task_id) do nothing;  -- see Step 4 below

  end if;

  return NEW;
end;
$$;

-- ── Step 2: Attach trigger to media_tasks ────────────────
drop trigger if exists on_media_task_done on public.media_tasks;

create trigger on_media_task_done
  after update on public.media_tasks
  for each row
  execute function public.handle_media_task_done();

-- ── Step 3: Add unique constraint to landing_pages ───────
-- Prevents duplicate LP rows for the same product + URL
-- (safe to run even if constraint already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'landing_pages_product_name_lp_url_key'
  ) then
    alter table public.landing_pages
    add constraint landing_pages_product_name_lp_url_key
    unique (product_name, lp_url);
  end if;
end $$;

-- ── Step 4: Add unique constraint to media_assets ────────
-- Prevents duplicate traceability rows for the same source task
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_assets_source_task_id_key'
  ) then
    alter table public.media_assets
    add constraint media_assets_source_task_id_key
    unique (source_task_id);
  end if;
end $$;

-- ── Step 5: Grant execute on trigger function ────────────
-- The function is SECURITY DEFINER so it runs as owner,
-- but we still need authenticated users to be able to trigger it
-- indirectly through UPDATE. The trigger fires automatically.
grant execute on function public.handle_media_task_done() to authenticated;

-- ── Verify ───────────────────────────────────────────────
-- After running, confirm with:
--   select trigger_name, event_manipulation, action_timing
--   from information_schema.triggers
--   where event_object_table = 'media_tasks';
-- You should see: on_media_task_done | UPDATE | AFTER
