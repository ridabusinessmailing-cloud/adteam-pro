/**
 * useWorkflowAutomation
 *
 * All product-testing pipeline automation lives here.
 * This file is the ONLY place that creates workflow tasks.
 * It never modifies existing tasks or existing logic.
 *
 * Trigger points (called from outside):
 *  1. triggerProductCreated(productName)
 *     → called right after a "test" product is inserted
 *     → creates 4 tasks: 1 for Sana + 3 for Saida
 *
 *  2. checkSaidaTasksCompleted(productName, allTasks)
 *     → called after any task is toggled to completed
 *     → if ALL 3 Saida workflow tasks for this product are done,
 *       and the "Launch test campaign" task doesn't exist yet,
 *       creates the campaign task for Sana
 *
 *  3. checkCampaignTaskCompleted(task, allTasks)
 *     → called after a task is toggled to completed
 *     → if the completed task is the "Launch test campaign" task,
 *       schedules the 24h review task for Rida via a DB-persisted timestamp
 *
 *  4. checkPendingReviewTasks(allTasks)
 *     → called on TaskManager mount and periodically
 *     → finds campaign tasks completed > 24h ago with no review task yet,
 *       and creates the Rida review task
 */

import { supabase } from '../lib/supabase.js'

// ── Task templates ───────────────────────────────────────────────────────────

// Workflow task titles — used as stable identifiers to detect duplicates
const T = {
  angles:   (p) => `Write product description and angles for ${p}`,
  landing:  (p) => `Create landing page for ${p}`,
  videos:   (p) => `Create 4 video creatives for ${p}`,
  static:   (p) => `Create 1 static image for ${p}`,
  campaign: (p) => `Launch test campaign for ${p}`,
  review:   (p) => `Review performance after 24h for ${p}`,
}

// The 3 Saida task titles that must ALL be done before campaign task fires
const SAIDA_TASK_TITLES = (productName) => [
  T.landing(productName),
  T.videos(productName),
  T.static(productName),
]

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Insert a single task using the exact same schema as TaskManager.
 * workflow_tag is stored in the `drive_links` column as a hidden marker
 * so we don't need to alter the schema at all.
 * Format: "__workflow:{tag}" — users won't see this since TaskManager
 * only shows drive_links as a plain text field inside the edit modal.
 */
async function insertWorkflowTask({ title, description, team, assigned_to, priority = 'High', related_product, workflow_tag }) {
  const record = {
    title,
    description,
    team,
    assigned_to,
    priority,
    column_name: 'To do',
    related_product: related_product || '',
    drive_links: workflow_tag ? `__workflow:${workflow_tag}` : '',
    completed: false,
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(record)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Check if a task with this exact title + related_product already exists.
 * Prevents duplicate workflow tasks if the trigger fires more than once.
 */
async function taskExists(title, relatedProduct) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('title', title)
    .eq('related_product', relatedProduct)
    .limit(1)

  if (error) return false
  return data && data.length > 0
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Step 1: Called immediately after a product with status "test" is created.
 * Creates 4 tasks: angles (Sana) + landing/videos/static (Saida).
 */
export async function triggerProductCreated(productName) {
  const p = productName.trim()
  if (!p) return

  const errors = []

  // Task 1 — Sana: write angles
  try {
    const exists = await taskExists(T.angles(p), p)
    if (!exists) {
      await insertWorkflowTask({
        title:           T.angles(p),
        description:     'Prepare product description, marketing angles, and ad hooks that will be used for creatives and ads.',
        team:            'Media Buying',
        assigned_to:     'Sana',
        priority:        'High',
        related_product: p,
        workflow_tag:    'angles',
      })
    }
  } catch (e) { errors.push(`angles: ${e.message}`) }

  // Task 2 — Saida: landing page
  try {
    const exists = await taskExists(T.landing(p), p)
    if (!exists) {
      await insertWorkflowTask({
        title:           T.landing(p),
        description:     'Build the product landing page that will be used for the test campaign.',
        team:            'Creative',
        assigned_to:     'Saida',
        priority:        'High',
        related_product: p,
        workflow_tag:    'landing',
      })
    }
  } catch (e) { errors.push(`landing: ${e.message}`) }

  // Task 3 — Saida: 4 video creatives
  try {
    const exists = await taskExists(T.videos(p), p)
    if (!exists) {
      await insertWorkflowTask({
        title:           T.videos(p),
        description:     'Produce 4 video creatives for the product test. Vary hooks and angles based on the brief.',
        team:            'Creative',
        assigned_to:     'Saida',
        priority:        'High',
        related_product: p,
        workflow_tag:    'videos',
      })
    }
  } catch (e) { errors.push(`videos: ${e.message}`) }

  // Task 4 — Saida: 1 static image
  try {
    const exists = await taskExists(T.static(p), p)
    if (!exists) {
      await insertWorkflowTask({
        title:           T.static(p),
        description:     'Create 1 high-quality static image creative for the product test.',
        team:            'Creative',
        assigned_to:     'Saida',
        priority:        'Medium',
        related_product: p,
        workflow_tag:    'static',
      })
    }
  } catch (e) { errors.push(`static: ${e.message}`) }

  if (errors.length > 0) {
    console.warn('[Workflow] Some tasks failed to create:', errors)
  }
}

/**
 * Step 2: Called after any task is marked completed.
 * Checks if ALL 3 Saida tasks for this product are done.
 * If yes, creates the "Launch test campaign" task for Sana.
 *
 * @param {string} productName  - the related_product of the completed task
 * @param {Array}  allTasks     - current tasks array from useRealtimeTable
 */
export async function checkSaidaTasksCompleted(productName, allTasks) {
  if (!productName) return

  const p = productName.trim()
  const saidaTitles = SAIDA_TASK_TITLES(p)

  // Find all 3 Saida workflow tasks for this product in the current rows
  const saidaTasks = allTasks.filter(t =>
    t.related_product === p &&
    saidaTitles.includes(t.title)
  )

  // Need all 3 to exist and be completed
  if (saidaTasks.length < 3) return
  const allDone = saidaTasks.every(t => t.completed)
  if (!allDone) return

  // Don't create if campaign task already exists
  const campaignExists = await taskExists(T.campaign(p), p)
  if (campaignExists) return

  try {
    await insertWorkflowTask({
      title:           T.campaign(p),
      description:     `Launch testing ads for the product.\n\nRecommended structure:\n• 3 ad sets\n• 2 creatives per ad set\n• Test budget per ad set`,
      team:            'Media Buying',
      assigned_to:     'Sana',
      priority:        'Urgent',
      related_product: p,
      workflow_tag:    'campaign',
    })
  } catch (e) {
    console.warn('[Workflow] Failed to create campaign task:', e.message)
  }
}

/**
 * Step 3 & 4: Called after any task is marked completed.
 * If the completed task is the "Launch test campaign" task,
 * we record the completion time and schedule a 24h review task for Rida.
 *
 * Since we cannot run a true server-side cron from the frontend,
 * we use this strategy:
 *   - Store the campaign completion timestamp in a dedicated table row
 *     (workflow_timers) — created here as a lightweight record
 *   - checkPendingReviewTasks() polls this on TaskManager mount
 *     and fires the Rida task when 24h has elapsed
 *
 * @param {object} task      - the task that was just completed
 */
export async function checkCampaignTaskCompleted(task) {
  if (!task.completed) return
  if (!task.title.startsWith('Launch test campaign for ')) return

  const productName = task.related_product
  if (!productName) return

  // Check review task doesn't already exist
  const reviewExists = await taskExists(T.review(productName), productName)
  if (reviewExists) return

  // Record this campaign completion in the workflow_timers table
  // so checkPendingReviewTasks() can fire the Rida task after 24h
  const { error } = await supabase
    .from('workflow_timers')
    .upsert({
      product_name:          productName,
      campaign_completed_at: new Date().toISOString(),
      review_task_created:   false,
    }, { onConflict: 'product_name' })

  if (error) {
    console.warn('[Workflow] Failed to record campaign timer:', error.message)
  }
}

/**
 * Step 4 (polling): Called on TaskManager mount.
 * Reads pending workflow_timers and creates Rida review tasks
 * for any campaign that completed more than 24h ago.
 */
export async function checkPendingReviewTasks() {
  const { data: timers, error } = await supabase
    .from('workflow_timers')
    .select('*')
    .eq('review_task_created', false)

  if (error || !timers || timers.length === 0) return

  const now = Date.now()
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

  for (const timer of timers) {
    const completedAt = new Date(timer.campaign_completed_at).getTime()
    const elapsed     = now - completedAt

    if (elapsed < TWENTY_FOUR_HOURS) continue

    const p = timer.product_name

    // Double-check: don't create if already exists
    const reviewExists = await taskExists(T.review(p), p)
    if (reviewExists) {
      // Clean up the timer
      await supabase.from('workflow_timers').update({ review_task_created: true }).eq('product_name', p)
      continue
    }

    try {
      await insertWorkflowTask({
        title:           T.review(p),
        description:     `Check campaign performance and decide the next action.\n\nPossible decisions:\n• Scale\n• Improve creatives\n• Kill product`,
        team:            'Media Buying',
        assigned_to:     'Rida',
        priority:        'Urgent',
        related_product: p,
        workflow_tag:    'review',
      })

      // Mark timer as done
      await supabase.from('workflow_timers').update({ review_task_created: true }).eq('product_name', p)
    } catch (e) {
      console.warn('[Workflow] Failed to create review task:', e.message)
    }
  }
}
