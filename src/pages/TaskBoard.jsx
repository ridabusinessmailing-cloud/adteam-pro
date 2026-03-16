import { useState, useMemo, useRef, useEffect } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { upsertAssetField, ensureAssetRow, addLandingPage } from '../hooks/useDeliverables.js'
import { C, Modal, Avatar, MEMBER_COLORS } from '../components/ui.jsx'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const ADMINS = ['Rida', 'Oussama']
const TEAM   = ['Saida', 'Oussama', 'Sana', 'Rida']

const TASK_TYPES = [
  { value: 'creative_video',  label: '🎬 Creative Video',  needsLink: true  },
  { value: 'creative_image',  label: '🖼️ Creative Image',  needsLink: true  },
  { value: 'landing_page',    label: '🌐 Landing Page',    needsLink: true  },
  { value: 'research',        label: '🔍 Research',        needsLink: false },
  { value: 'other',           label: '📋 Other',           needsLink: false },
]

const TYPE_META = Object.fromEntries(TASK_TYPES.map(t => [t.value, t]))

const COLUMNS = [
  { id: 'Saida',   color: '#6B3FA0', bg: '#F3EEF9' },
  { id: 'Oussama', color: '#1A5FB4', bg: '#EEF4FD' },
  { id: 'Sana',    color: '#1E7B4B', bg: '#EBF7F1' },
  { id: 'Rida',    color: '#D4521A', bg: '#FBF0EB' },
  { id: 'Done',    color: '#5C574F', bg: '#F0EDE8' },
]

// ─────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────

function toDateStr(d) {
  // YYYY-MM-DD in local time
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function today() { return toDateStr(new Date()) }

function daysDiff(dateStr) {
  // negative = overdue, positive = future
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const d   = new Date(dateStr + 'T00:00:00')
  return Math.round((d - now) / 86400000)
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─────────────────────────────────────────────────────────────
// Inline input style
// ─────────────────────────────────────────────────────────────

const IS = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

// ─────────────────────────────────────────────────────────────
// Delay badge
// ─────────────────────────────────────────────────────────────

function DelayBadge({ dueDate }) {
  if (!dueDate) return null
  const diff = daysDiff(dueDate)
  if (diff >= 0) return null
  const days = Math.abs(diff)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10.5, fontWeight: 700,
      background: '#FDECEA', color: '#C0392B',
      padding: '2px 7px', borderRadius: 20,
      border: '1px solid #F5C6C2',
    }}>
      ⚠ delayed {days}d
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Task Card
// ─────────────────────────────────────────────────────────────

function TaskCard({ task, onEdit, onDrop, isDragging, colId }) {
  const ref = useRef(null)
  const tm = TYPE_META[task.type] || TYPE_META.other
  const diff = task.due_date ? daysDiff(task.due_date) : null
  const isToday   = diff === 0
  const isDelayed = diff !== null && diff < 0
  const isDone    = task.status === 'done'

  return (
    <div
      ref={ref}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('taskId', task.id)
        e.dataTransfer.setData('fromCol', colId)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onEdit(task)}
      style={{
        background: isDone ? '#FAFAF8' : C.surface,
        borderRadius: 10,
        border: `1.5px solid ${isDelayed && !isDone ? '#F5C6C2' : C.border}`,
        padding: '12px 14px',
        marginBottom: 8,
        cursor: 'grab',
        opacity: isDone ? 0.65 : 1,
        boxShadow: isDragging ? '0 8px 24px #1A171428' : '0 1px 3px #1A171408',
        transition: 'box-shadow 0.15s, opacity 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (!isDone) e.currentTarget.style.boxShadow = '0 4px 16px #1A171418' }}
      onMouseLeave={e => e.currentTarget.style.boxShadow = isDragging ? '0 8px 24px #1A171428' : '0 1px 3px #1A171408'}
    >
      {/* Type + visibility row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight }}>
          {tm.label}
        </span>
        {task.visibility === 'admin_only' && (
          <span style={{ fontSize: 10, fontWeight: 700, background: '#FDF6E3', color: '#B07D1A', padding: '1px 6px', borderRadius: 10, border: '1px solid #E8D08A' }}>
            👑 Admin
          </span>
        )}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 13.5, fontWeight: 700, color: C.text,
        textDecoration: isDone ? 'line-through' : 'none',
        lineHeight: 1.35, marginBottom: task.product_name || task.due_date ? 8 : 0,
      }}>
        {task.title}
      </div>

      {/* Product tag */}
      {task.product_name && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 11.5, fontWeight: 600,
            background: C.blueLight, color: C.blue,
            padding: '2px 8px', borderRadius: 6,
          }}>
            📦 {task.product_name}
          </span>
        </div>
      )}

      {/* Footer: date + delay */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        {task.due_date ? (
          <span style={{
            fontSize: 11.5, fontWeight: 600,
            color: isDelayed && !isDone ? '#C0392B' : isToday ? C.accent : C.textLight,
          }}>
            {isToday ? '📅 Today' : fmtDate(task.due_date)}
          </span>
        ) : <span />}
        <DelayBadge dueDate={!isDone ? task.due_date : null} />
      </div>

      {/* Asset link indicator */}
      {task.asset_link && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.borderLight}` }}>
          <a href={task.asset_link} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 11.5, fontWeight: 600, color: C.blue, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ↗ Asset link
          </a>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Kanban Column
// ─────────────────────────────────────────────────────────────

function KanbanColumn({ col, tasks, onEdit, onDrop, onAddToCol }) {
  const [dragOver, setDragOver] = useState(false)
  const meta = MEMBER_COLORS[col.id] || { bg: '#F0EDE8', text: '#9B9589', dot: '#9B9589' }
  const isDone = col.id === 'Done'

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        const taskId = e.dataTransfer.getData('taskId')
        if (taskId) onDrop(taskId, col.id)
      }}
      style={{
        flex: '0 0 240px',
        minWidth: 240, maxWidth: 240,
        background: dragOver ? (isDone ? '#ECECE9' : col.bg || '#F7F6F3') : C.bg,
        borderRadius: 14,
        padding: 12,
        border: `2px solid ${dragOver ? col.color : 'transparent'}`,
        transition: 'background 0.15s, border-color 0.15s',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '2px 0' }}>
        {isDone
          ? <span style={{ fontSize: 16 }}>✅</span>
          : <Avatar name={col.id} size={24} />
        }
        <span style={{ fontWeight: 800, fontSize: 13.5, color: C.text }}>{col.id}</span>
        <span style={{
          marginLeft: 'auto',
          background: isDone ? '#E8E5DF' : meta.bg,
          color: isDone ? C.textMid : meta.text,
          borderRadius: 10, padding: '1px 8px',
          fontSize: 11, fontWeight: 700,
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Task cards */}
      <div style={{ flex: 1, minHeight: 60 }}>
        {tasks.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            color: C.textLight, fontSize: 12,
            border: `1.5px dashed ${C.border}`,
            borderRadius: 8,
          }}>
            Drop here
          </div>
        ) : (
          tasks.map(t => (
            <TaskCard key={t.id} task={t} colId={col.id} onEdit={onEdit} onDrop={onDrop} />
          ))
        )}
      </div>

      {/* Add task button */}
      {!isDone && (
        <button
          onClick={() => onAddToCol(col.id)}
          style={{
            marginTop: 8, width: '100%', padding: '7px',
            background: 'transparent', border: `1.5px dashed ${C.border}`,
            borderRadius: 8, color: C.textLight, fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textLight }}
        >
          + Add task
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Asset Link Modal (shown before marking done)
// ─────────────────────────────────────────────────────────────

function AssetLinkModal({ task, onConfirm, onCancel }) {
  const [link, setLink] = useState(task.asset_link || '')
  const [err,  setErr]  = useState('')
  function submit() {
    const trimmed = link.trim()
    if (!trimmed) return setErr('Asset link is required before completing this task.')
    try { new URL(trimmed) } catch { return setErr('Please enter a valid URL.') }
    onConfirm(trimmed)
  }
  return (
    <Modal title="📎 Add Asset Link to Complete" onClose={onCancel}>
      <div style={{ marginBottom: 16, padding: '12px 16px', background: '#FDF6E3', borderRadius: 10, border: '1.5px solid #E8D08A' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#B07D1A', marginBottom: 4 }}>
          {TYPE_META[task.type]?.label} — {task.title}
        </div>
        <div style={{ fontSize: 12, color: '#B07D1A' }}>
          This task type requires an asset link before it can be marked as Done.
        </div>
      </div>
      {err && (
        <div style={{ background: C.redLight, border: '1.5px solid #F5C6C2', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: C.red, fontSize: 13 }}>
          ⚠️ {err}
        </div>
      )}
      <div style={{ marginBottom: 6 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Asset Link *
        </label>
        <input
          type="url"
          value={link}
          onChange={e => { setLink(e.target.value); setErr('') }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="https://drive.google.com/… or https://…"
          autoFocus
          style={IS}
          onFocus={e => e.target.style.borderColor = C.accent}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 4 }}>
          Paste Google Drive, Notion, or any URL. This will be saved to Product Assets.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onCancel} style={{ background: 'transparent', color: C.textMid, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={submit} style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Complete Task
        </button>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Task Form Modal (create / edit)
// ─────────────────────────────────────────────────────────────

function TaskFormModal({ task, defaultAssignee, products, onSave, onDelete, onClose, userName, isAdmin }) {
  const isEdit = !!task
  const blank = () => ({
    title: '', description: '', assigned_to: defaultAssignee || 'Saida',
    product_name: '', type: 'other', status: 'todo',
    asset_link: '', visibility: 'team', due_date: today(),
  })
  const [form, setForm]     = useState(isEdit ? {
    title:        task.title        || '',
    description:  task.description  || '',
    assigned_to:  task.assigned_to  || 'Saida',
    product_name: task.product_name || '',
    type:         task.type         || 'other',
    status:       task.status       || 'todo',
    asset_link:   task.asset_link   || '',
    visibility:   task.visibility   || 'team',
    due_date:     task.due_date     || today(),
  } : blank())
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const f = field => e => setForm(p => ({ ...p, [field]: e.target.value }))

  async function save() {
    if (!form.title.trim()) return setErr('Title is required.')
    if (!form.due_date)     return setErr('Due date is required.')
    setSaving(true); setErr('')
    try {
      const record = { ...form, product_name: form.product_name || null }
      await onSave(record)
      onClose()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  const inp = (extra = {}) => ({ ...IS, ...extra })
  const labelSt = { display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }

  return (
    <Modal title={isEdit ? 'Edit Task' : 'New Task'} onClose={onClose}>
      {err && (
        <div style={{ background: C.redLight, border: '1.5px solid #F5C6C2', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>
          ⚠️ {err}
        </div>
      )}

      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelSt}>Task Title *</label>
        <input value={form.title} onChange={f('title')} placeholder="What needs to be done?" autoFocus style={inp({ border: `2px solid ${C.accent}` })} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.accent} />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelSt}>Description</label>
        <textarea value={form.description} onChange={f('description')} placeholder="Optional details…" rows={3} style={{ ...inp(), minHeight: 72, resize: 'vertical' }} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
      </div>

      {/* Grid: assign + type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelSt}>Assign To</label>
          <select value={form.assigned_to} onChange={f('assigned_to')} style={inp({ cursor: 'pointer' })}>
            {TEAM.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Task Type</label>
          <select value={form.type} onChange={f('type')} style={inp({ cursor: 'pointer' })}>
            {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Grid: product + due date */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelSt}>Product</label>
          <select value={form.product_name} onChange={f('product_name')} style={inp({ cursor: 'pointer' })}>
            <option value="">— General (no product) —</option>
            {products.map(p => <option key={p.id || p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Due Date *</label>
          <input type="date" value={form.due_date} onChange={f('due_date')} style={inp()} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
        </div>
      </div>

      {/* Asset link */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelSt}>Asset Link {TYPE_META[form.type]?.needsLink ? '(required to mark Done)' : '(optional)'}</label>
        <input type="url" value={form.asset_link} onChange={f('asset_link')} placeholder="https://drive.google.com/… or any URL" style={inp()} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
      </div>

      {/* Visibility — only admins can set admin_only */}
      {isAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Visibility</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'team', label: '👥 Visible to team' }, { v: 'admin_only', label: '👑 Admins only' }].map(opt => (
              <button key={opt.v} onClick={() => setForm(p => ({ ...p, visibility: opt.v }))} style={{
                flex: 1, padding: '9px 12px', borderRadius: 9, fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: form.visibility === opt.v ? C.text : C.bg,
                color: form.visibility === opt.v ? '#fff' : C.textMid,
                border: `1.5px solid ${form.visibility === opt.v ? C.text : C.border}`,
              }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 4 }}>
        {isEdit && (
          <button onClick={() => { if (confirm('Delete this task?')) { onDelete(task.id); onClose() } }} style={{ background: C.redLight, color: C.red, border: '1.5px solid #F5C6C2', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Delete
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: C.textMid, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving} style={{ background: saving ? C.textLight : C.text, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Date Navigator
// ─────────────────────────────────────────────────────────────

function DateNavigator({ selected, onChange }) {
  const isToday = selected === today()

  function shift(days) {
    const d = new Date(selected + 'T00:00:00')
    d.setDate(d.getDate() + days)
    onChange(toDateStr(d))
  }

  const label = isToday ? 'Today' : new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => shift(-1)} style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.textMid }}>
        ‹
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: isToday ? C.accent : C.text, minWidth: 100, textAlign: 'center' }}>
          {label}
        </span>
        <input
          type="date"
          value={selected}
          onChange={e => onChange(e.target.value)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: C.textLight, fontFamily: 'inherit', outline: 'none', width: 18 }}
          title="Pick a date"
        />
      </div>

      <button onClick={() => shift(1)} style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.textMid }}>
        ›
      </button>

      {!isToday && (
        <button onClick={() => onChange(today())} style={{ background: C.accentLight, color: C.accent, border: `1.5px solid ${C.accent}33`, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Today
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Asset automation
//
// Dual-path: DB trigger is primary, this function is the fallback.
// The trigger (handle_media_task_done) fires synchronously inside
// Postgres when status → 'done'. This client function runs after
// the JS update() resolves as a safety net.
//
// Both paths are idempotent: UNIQUE(source_task_id) on media_assets
// means the same task can never produce two rows, regardless of
// which path runs first or if both run.
//
// Schema uses product_name (text), NOT product_id.
// ─────────────────────────────────────────────────────────────

async function createMediaAsset(task, createdBy) {
  const productName = (task.product_name || '').trim()
  const assetLink   = (task.asset_link   || '').trim()
  const taskType    = task.type
  const assetName   = (task.title        || '').trim() || 'Untitled Asset'
  const author      = ((createdBy || task.created_by || '')).trim() || 'system'

  // Guard — nothing to do without these
  if (!productName || !assetLink) return
  if (!['creative_video', 'creative_image', 'landing_page'].includes(taskType)) return

  // ── INSERT into media_assets ──────────────────────────────
  // ON CONFLICT (source_task_id) DO NOTHING means this is safe to
  // call even if the DB trigger already ran — no duplicate, no error.
  const { error: assetErr } = await supabase.from('media_assets').insert({
    product_name:   productName,
    name:           assetName,
    type:           taskType,
    link:           assetLink,
    created_by:     author,
    source_task_id: task.id,
  })
  // Only log non-duplicate errors (code 23505 = unique_violation = expected)
  if (assetErr && assetErr.code !== '23505') {
    console.warn('[TaskBoard] media_assets insert:', assetErr.message, assetErr.code)
  }

  // ── landing_page: also write to landing_pages ─────────────
  if (taskType === 'landing_page') {
    const angleName = assetName.length > 60 ? assetName.slice(0, 57) + '…' : assetName
    const { error: lpErr } = await supabase
      .from('landing_pages')
      .insert({ product_name: productName, angle_name: angleName, lp_url: assetLink })
    if (lpErr && lpErr.code !== '23505') {
      console.warn('[TaskBoard] landing_pages insert:', lpErr.message, lpErr.code)
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Main TaskBoard page
// ─────────────────────────────────────────────────────────────

export default function TaskBoard() {
  const { userName, isAdmin } = useAuth()

  // Data
  const { rows: allTasks, loading, insert, update, remove } = useRealtimeTable('media_tasks', { orderBy: 'created_at', ascending: true })
  const { rows: products } = useRealtimeTable('products', { orderBy: 'name', ascending: true })

  // UI state
  const [selectedDate, setSelectedDate] = useState(today())
  const [editingTask,  setEditingTask]  = useState(null)   // task object or 'new'
  const [defaultCol,   setDefaultCol]   = useState('Saida')
  const [pendingDone,  setPendingDone]  = useState(null)   // task needing asset link
  const [filterType,   setFilterType]   = useState('')

  const isTodayView = selectedDate === today()

  // ── Filter tasks for the board ──────────────────────────
  const visibleTasks = useMemo(() => {
    return allTasks.filter(t => {
      // Visibility gate
      if (t.visibility === 'admin_only' && !isAdmin) return false
      return true
    })
  }, [allTasks, isAdmin])

  const boardTasks = useMemo(() => {
    return visibleTasks.filter(t => {
      if (filterType && t.type !== filterType) return false
      if (t.status === 'done') return false // done tasks go to Done column separately

      if (isTodayView) {
        // Active = due_date <= today OR no due_date
        if (!t.due_date) return true
        return t.due_date <= selectedDate
      } else {
        // Future view: exact date match
        return t.due_date === selectedDate
      }
    })
  }, [visibleTasks, selectedDate, isTodayView, filterType])

  const doneTasks = useMemo(() => {
    return visibleTasks.filter(t => {
      if (t.status !== 'done') return false
      if (filterType && t.type !== filterType) return false
      return true
    })
  }, [visibleTasks, filterType])

  // ── Group tasks per column ──────────────────────────────
  const grouped = useMemo(() => {
    const g = {}
    COLUMNS.forEach(col => {
      if (col.id === 'Done') {
        g[col.id] = doneTasks
      } else {
        g[col.id] = boardTasks.filter(t => t.assigned_to === col.id)
      }
    })
    return g
  }, [boardTasks, doneTasks])

  // ── Stats ──────────────────────────────────────────────
  const totalActive  = boardTasks.length
  const totalDelayed = boardTasks.filter(t => t.due_date && daysDiff(t.due_date) < 0).length
  const totalDone    = doneTasks.length

  // ── Drag & drop ────────────────────────────────────────
  async function handleDrop(taskId, toCol) {
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return
    if (toCol === task.assigned_to && task.status !== 'done') return
    if (toCol === 'Done' && task.status !== 'done') return handleMarkDone(task)
    if (toCol !== 'Done') {
      try { await update(taskId, { assigned_to: toCol, status: 'todo' }) } catch (e) { alert(e.message) }
    }
  }

  // ── Mark done flow ─────────────────────────────────────
  function handleMarkDone(task) {
    const needsLink = TYPE_META[task.type]?.needsLink
    if (needsLink && !task.asset_link) {
      setPendingDone(task)
    } else {
      completeDone(task, task.asset_link)
    }
  }

  async function completeDone(task, assetLink) {
    try {
      const updates = { status: 'done' }
      if (assetLink) updates.asset_link = assetLink
      // update() triggers the DB trigger handle_media_task_done() inside Postgres
      await update(task.id, updates)
      // Client-side fallback — runs after the DB update resolves.
      // Idempotent: if the trigger already wrote to media_assets,
      // the unique(source_task_id) constraint absorbs the duplicate silently.
      if (task.product_name && assetLink) {
        await createMediaAsset({ ...task, asset_link: assetLink }, userName)
      }
    } catch (e) { alert(e.message) }
    setPendingDone(null)
  }

  // ── CRUD ───────────────────────────────────────────────
  async function saveTask(form) {
    const record = { ...form, created_by: userName }
    if (editingTask && editingTask !== 'new') {
      await update(editingTask.id, form)
    } else {
      await insert(record)
    }
  }

  async function deleteTask(id) {
    try { await remove(id) } catch (e) { alert(e.message) }
  }

  function openNew(colId) {
    setDefaultCol(colId || 'Saida')
    setEditingTask('new')
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>
              🗂 Task Board
            </h2>
            <p style={{ margin: '3px 0 0', color: C.textLight, fontSize: 13 }}>
              Media buying & creative tasks — drag to move, click to edit
            </p>
          </div>
          <button onClick={() => openNew()} style={{
            background: C.text, color: '#fff', border: 'none', borderRadius: 9,
            padding: '9px 18px', fontSize: 13.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            + New Task
          </button>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date navigator */}
          <DateNavigator selected={selectedDate} onChange={setSelectedDate} />

          {/* Type filter */}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
            padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`,
            fontSize: 13, background: C.surface, color: C.text,
            fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
          }}>
            <option value="">All types</option>
            {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* Stats pills */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: C.bg, color: C.textMid, border: `1px solid ${C.border}` }}>
              {totalActive} active
            </span>
            {totalDelayed > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#FDECEA', color: '#C0392B', border: '1px solid #F5C6C2' }}>
                ⚠ {totalDelayed} delayed
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: C.greenLight, color: C.green, border: `1px solid #BBE8D0` }}>
              ✅ {totalDone} done
            </span>
          </div>
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, border: `3px solid #E8E5DF`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* ── Board ────────────────────────────────────────── */}
      {!loading && (
        <div style={{
          display: 'flex', gap: 12, overflowX: 'auto',
          paddingBottom: 16,
          // Ensure columns don't collapse
          minWidth: 0,
        }}>
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={grouped[col.id] || []}
              onEdit={task => setEditingTask(task)}
              onDrop={handleDrop}
              onAddToCol={openNew}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────── */}
      {!loading && totalActive === 0 && totalDone === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: C.textLight }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>
            {isTodayView ? 'No active tasks for today' : `No tasks for ${fmtDate(selectedDate)}`}
          </div>
          <div style={{ fontSize: 13 }}>Click "+ New Task" to create the first one.</div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────── */}
      {editingTask && (
        <TaskFormModal
          task={editingTask === 'new' ? null : editingTask}
          defaultAssignee={defaultCol}
          products={products}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setEditingTask(null)}
          userName={userName}
          isAdmin={isAdmin}
        />
      )}

      {pendingDone && (
        <AssetLinkModal
          task={pendingDone}
          onConfirm={link => completeDone(pendingDone, link)}
          onCancel={() => setPendingDone(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
