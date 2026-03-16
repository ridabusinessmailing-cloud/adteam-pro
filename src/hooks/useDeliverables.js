/**
 * useDeliverables
 *
 * Central hub for all "task ↔ product asset" logic.
 *
 * Asset types (simplified):
 *   Landing Pages    → landing_pages table (multiple per product)
 *   Creative Folder  → product_assets.creatives_drive_url
 *   Static Images    → product_assets.images_drive_url
 *   Documentation    → product_assets.product_documentation_url
 *
 * IMPORTANT: useWorkflowAutomation.js and all task logic are NOT touched.
 * The DELIVERABLE_CONFIG and getDeliverableConfig exports are kept
 * identical so TaskManager continues working without any changes.
 */

import { supabase } from '../lib/supabase.js'

// ── Simple asset types (single-URL, stored in product_assets) ─────────────────
// Landing Pages are excluded here — they live in the landing_pages table.
export const SIMPLE_ASSET_TYPES = [
  {
    key:             'creative_folder',
    label:           'Creative Folder',
    icon:            '🎬',
    dbColumn:        'creatives_drive_url',
    placeholder:     'https://drive.google.com/drive/folders/…',
    hint:            'One shared Drive folder containing all creatives: videos, hooks, UGC, angles.',
    taskTitlePrefix: 'Create 4 video creatives for ',
  },
  {
    key:             'static_images',
    label:           'Static Images',
    icon:            '🖼️',
    dbColumn:        'images_drive_url',
    placeholder:     'https://drive.google.com/file/d/…',
    hint:            'Drive link to static image creative.',
    taskTitlePrefix: 'Create 1 static image for ',
  },
  {
    key:             'documentation',
    label:           'Product Documentation',
    icon:            '📄',
    dbColumn:        'product_documentation_url',
    placeholder:     'PDF link, Google Drive, or Notion page URL',
    hint:            'PDF, Drive doc, or Notion page with product info.',
    taskTitlePrefix: null,
  },
]

// ── DELIVERABLE_CONFIG — kept identical for TaskManager compatibility ──────────
// TaskManager uses getDeliverableConfig() to detect Saida's tasks.
// These mappings must NOT change — they drive the save() and toggleDone() gates.
const DELIVERABLE_CONFIGS = SIMPLE_ASSET_TYPES.filter(a => a.taskTitlePrefix)

export const DELIVERABLE_CONFIG = Object.fromEntries(
  DELIVERABLE_CONFIGS.map(a => [a.key, {
    titlePrefix:  a.taskTitlePrefix,
    field:        a.dbColumn,
    label:        a.label,
    placeholder:  a.placeholder,
    assetSection: a.label,
    icon:         a.icon,
    hint:         'Required before marking this task as Done.',
  }])
)

// ── getDeliverableConfig — unchanged API, used by TaskManager ─────────────────
export function getDeliverableConfig(taskTitle) {
  if (!taskTitle) return null
  const at = DELIVERABLE_CONFIGS.find(a => taskTitle.startsWith(a.taskTitlePrefix))
  if (!at) return null
  return {
    titlePrefix:  at.taskTitlePrefix,
    field:        at.dbColumn,
    label:        at.label,
    placeholder:  at.placeholder,
    assetSection: at.label,
    icon:         at.icon,
    hint:         'Required before marking this task as Done.',
  }
}

// ── validateDeliverable — unchanged API, used by TaskManager ──────────────────
export function validateDeliverable(taskTitle, deliverableUrl) {
  const config = getDeliverableConfig(taskTitle)
  if (!config) return null
  if (!deliverableUrl || !deliverableUrl.trim()) {
    return `"${config.label}" is required before marking this task as Done.`
  }
  return null
}

// ── saveDeliverableAsset — unchanged API, used by TaskManager ─────────────────
export async function saveDeliverableAsset(productName, taskTitle, deliverableUrl) {
  if (!productName || !deliverableUrl?.trim()) return
  const config = getDeliverableConfig(taskTitle)
  if (!config) return
  const { error } = await supabase
    .from('product_assets')
    .upsert({ product_name: productName, [config.field]: deliverableUrl.trim() }, { onConflict: 'product_name' })
  if (error) {
    console.warn('[Deliverables] saveDeliverableAsset failed:', error.message)
    throw error
  }
}

// ── ensureAssetRow — unchanged API, used by TaskManager ───────────────────────
export async function ensureAssetRow(productName) {
  if (!productName?.trim()) return
  const { error } = await supabase
    .from('product_assets')
    .upsert({ product_name: productName.trim() }, { onConflict: 'product_name', ignoreDuplicates: true })
  if (error) console.warn('[Deliverables] ensureAssetRow failed:', error.message)
}

// ── upsertAssetField — used by ProductAssetsPage ───────────────────────────────
export async function upsertAssetField(productName, dbColumn, url) {
  if (!productName?.trim()) return
  const { error } = await supabase
    .from('product_assets')
    .upsert({ product_name: productName.trim(), [dbColumn]: url || null }, { onConflict: 'product_name' })
  if (error) {
    console.warn('[Deliverables] upsertAssetField failed:', error.message)
    throw error
  }
}

// ── Landing pages CRUD — new landing_pages table ──────────────────────────────

export async function addLandingPage(productName, angleName, lpUrl) {
  if (!productName?.trim() || !angleName?.trim() || !lpUrl?.trim()) {
    throw new Error('Product name, angle name, and URL are all required.')
  }
  const { data, error } = await supabase
    .from('landing_pages')
    .insert({ product_name: productName.trim(), angle_name: angleName.trim(), lp_url: lpUrl.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLandingPage(id, angleName, lpUrl) {
  const { data, error } = await supabase
    .from('landing_pages')
    .update({ angle_name: angleName.trim(), lp_url: lpUrl.trim() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLandingPage(id) {
  const { error } = await supabase.from('landing_pages').delete().eq('id', id)
  if (error) throw error
}
