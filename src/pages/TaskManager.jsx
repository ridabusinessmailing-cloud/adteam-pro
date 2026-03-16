import { useState, useEffect, useMemo } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  C, Tag, Avatar, Modal, FL, Inp, Sel, TA, Row, Btn,
  ErrorBanner, PRIORITY_META, STATUS_META, MEMBER_COLORS,
} from '../components/ui.jsx'
import { checkSaidaTasksCompleted, checkCampaignTaskCompleted, checkPendingReviewTasks } from '../hooks/useWorkflowAutomation.js'
import { getDeliverableConfig, validateDeliverable, saveDeliverableAsset, ensureAssetRow } from '../hooks/useDeliverables.js'

// ── Constants (unchanged) ─────────────────────────────────────────────────────
const TEAM       = ['Rida', 'Oussama', 'Saida', 'Sana']
const TEAMS_LIST = ['Creative', 'Media Buying', 'Operations']
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const TASK_COLS  = ['Backlog', 'To do', 'In progress', 'Review', 'Done']

const blank = (user) => ({
  title: '', description: '', team: 'Creative', assigned_to: user,
  deadline: '', priority: 'Medium', column_name: 'To do',
  related_product: '', drive_links: '', completed: false,
  deliverableUrl: '',   // extra field for Saida's deliverable tasks — not a DB column
})

// ── Pill styles ───────────────────────────────────────────────────────────────
const STATUS_PILL = {
  'Backlog':     { bg: '#F0EDE8', text: '#9B9589',  dot: '#C8C3BC' },
  'To do':       { bg: '#F0EDE8', text: '#9B9589',  dot: '#C8C3BC' },
  'In progress': { bg: '#EEF4FD', text: '#1A5FB4',  dot: '#1A5FB4' },
  'Review':      { bg: '#FDF6E3', text: '#B07D1A',  dot: '#B07D1A' },
  'Done':        { bg: '#EBF7F1', text: '#1E7B4B',  dot: '#1E7B4B' },
}
const PRIORITY_PILL = {
  Low:    { bg: '#F0EDE8', text: '#9B9589' },
  Medium: { bg: '#EEF4FD', text: '#1A5FB4' },
  High:   { bg: '#FDF6E3', text: '#B07D1A' },
  Urgent: { bg: '#FDECEA', text: '#C0392B' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return null
  const date  = new Date(d + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const diff  = Math.round((date - today) / 86400000)
  if (diff === 0) return { label: 'Today',     color: C.accent }
  if (diff === 1) return { label: 'Tomorrow',  color: C.green }
  if (diff  <  0) return { label: `${Math.abs(diff)}d overdue`, color: C.red }
  if (diff  <= 7) return { label: `${diff}d`,  color: C.yellow }
  return { label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), color: C.textLight }
}

// ── Inline status dropdown ────────────────────────────────────────────────────
function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const p = STATUS_PILL[value] || STATUS_PILL['To do']
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: p.bg, color: p.text, border: 'none',
        borderRadius: 20, padding: '3px 10px 3px 8px',
        fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
        {value}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 51,
            background: C.surface, border: `1.5px solid ${C.border}`,
            borderRadius: 10, boxShadow: '0 8px 24px #1A171420',
            padding: 4, minWidth: 140,
          }}>
            {TASK_COLS.map(col => {
              const cp = STATUS_PILL[col] || STATUS_PILL['To do']
              return (
                <button key={col} onClick={() => { onChange(col); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    width: '100%', padding: '7px 10px', border: 'none',
                    background: col === value ? C.bg : 'transparent',
                    color: cp.text, cursor: 'pointer', borderRadius: 7,
                    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                    textAlign: 'left',
                  }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: cp.dot }} />
                  {col}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Priority pill ─────────────────────────────────────────────────────────────
function PriorityPill({ value }) {
  const p = PRIORITY_PILL[value] || PRIORITY_PILL.Medium
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: p.bg, color: p.text,
      borderRadius: 6, padding: '3px 9px',
      fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {value}
    </span>
  )
}

// ── Sortable column header ────────────────────────────────────────────────────
function SortTH({ label, field, sort, onSort, align = 'left' }) {
  const active = sort.field === field
  return (
    <th onClick={() => onSort(field)} style={{
      padding: '10px 14px', textAlign: align,
      fontSize: 11, fontWeight: 700, color: active ? C.accent : C.textLight,
      textTransform: 'uppercase', letterSpacing: '0.07em',
      borderBottom: `1.5px solid ${C.border}`,
      background: '#FAFAF8', whiteSpace: 'nowrap',
      cursor: 'pointer', userSelect: 'none',
      transition: 'color 0.15s',
    }}>
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3 }}>
        {active ? (sort.asc ? '↑' : '↓') : '↕'}
      </span>
    </th>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, onToggle, onEdit, onDelete, onStatusChange }) {
  const [hover, setHover] = useState(false)
  const due = fmtDate(task.deadline)
  const mc  = MEMBER_COLORS[task.assigned_to] || { bg: '#F0EDE8', text: '#9B9589', dot: '#9B9589' }

  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: `1px solid ${C.borderLight}`,
        background: hover ? '#FAFAF8' : C.surface,
        transition: 'background 0.1s',
        opacity: task.completed ? 0.55 : 1,
      }}
    >
      {/* Checkbox */}
      <td style={{ padding: '0 4px 0 16px', width: 36, verticalAlign: 'middle' }}>
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task)}
          style={{ width: 15, height: 15, accentColor: C.accent, cursor: 'pointer' }}
        />
      </td>

      {/* Task title */}
      <td style={{ padding: '11px 14px 11px 8px', verticalAlign: 'middle', maxWidth: 320 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: C.text,
          textDecoration: task.completed ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        {task.description && (
          <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.description.slice(0, 80)}
          </div>
        )}
      </td>

      {/* Product */}
      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
        {task.related_product
          ? <span style={{ fontSize: 12.5, fontWeight: 600, color: C.blue, background: C.blueLight, padding: '3px 9px', borderRadius: 6 }}>{task.related_product}</span>
          : <span style={{ color: C.textLight, fontSize: 13 }}>—</span>
        }
      </td>

      {/* Assigned */}
      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 26, height: 26, borderRadius: '50%',
            background: mc.bg, color: mc.text,
            fontSize: 10, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${mc.dot}33`, flexShrink: 0,
          }}>
            {task.assigned_to?.[0]?.toUpperCase()}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.textMid }}>{task.assigned_to}</span>
        </div>
      </td>

      {/* Priority */}
      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
        <PriorityPill value={task.priority} />
      </td>

      {/* Status — inline dropdown */}
      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
        <StatusSelect
          value={task.column_name}
          onChange={col => onStatusChange(task.id, col)}
        />
      </td>

      {/* Due date */}
      <td style={{ padding: '11px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
        {due
          ? <span style={{ fontSize: 12.5, fontWeight: 600, color: due.color }}>{due.label}</span>
          : <span style={{ color: C.textLight, fontSize: 13 }}>—</span>
        }
      </td>

      {/* Actions */}
      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', gap: 4, opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>
          <button onClick={() => onEdit(task)} style={{
            background: C.bg, border: `1.5px solid ${C.border}`,
            borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', color: C.textMid, fontFamily: 'inherit',
          }}>Edit</button>
          <button onClick={() => onDelete(task.id)} style={{
            background: C.redLight, border: `1.5px solid #F5C6C2`,
            borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', color: C.red, fontFamily: 'inherit',
          }}>Del</button>
        </div>
      </td>
    </tr>
  )
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function TaskModal({ title, form, setForm, onSave, onClose, saving, err }) {
  // Detect if this task has a deliverable requirement
  const dConfig = getDeliverableConfig(form.title)
  const isMarkingDone = form.completed || form.column_name === 'Done'
  const deliverableMissing = isMarkingDone && dConfig && !form.deliverableUrl?.trim()

  return (
    <Modal title={title} onClose={onClose}>
      {err && <ErrorBanner message={err} />}

      <FL label="Task Name">
        <Inp
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="What needs to be done?"
          autoFocus
        />
      </FL>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FL label="Assigned To">
          <Sel value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
            {TEAM.map(m => <option key={m}>{m}</option>)}
          </Sel>
        </FL>
        <FL label="Team">
          <Sel value={form.team} onChange={e => setForm({ ...form, team: e.target.value })}>
            {TEAMS_LIST.map(t => <option key={t}>{t}</option>)}
          </Sel>
        </FL>
        <FL label="Priority">
          <Sel value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </Sel>
        </FL>
        <FL label="Status">
          <Sel value={form.column_name} onChange={e => setForm({ ...form, column_name: e.target.value, completed: e.target.value === 'Done' })}>
            {TASK_COLS.map(c => <option key={c}>{c}</option>)}
          </Sel>
        </FL>
        <FL label="Due Date">
          <Inp type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
        </FL>
        <FL label="Product">
          <Inp value={form.related_product} onChange={e => setForm({ ...form, related_product: e.target.value })} placeholder="e.g. Skin Serum Pro" />
        </FL>
      </div>

      <FL label="Description (optional)">
        <TA value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add more details…" />
      </FL>

      <FL label="Google Drive Link (optional)">
        <Inp value={form.drive_links} onChange={e => setForm({ ...form, drive_links: e.target.value })} placeholder="https://drive.google.com/…" />
      </FL>

      {/* ── Deliverable field — shown only for Saida's 3 workflow tasks ──────── */}
      {dConfig && (
        <div style={{
          margin: '4px 0 16px',
          padding: '16px 18px',
          borderRadius: 12,
          background: deliverableMissing ? '#FEF9EC' : '#F0FBF5',
          border: `2px solid ${deliverableMissing ? '#E8D08A' : '#BBE8D0'}`,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>{dConfig.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: deliverableMissing ? '#B07D1A' : '#1E7B4B', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Deliverable Required
              </div>
              <div style={{ fontSize: 11.5, color: C.textMid, marginTop: 1 }}>
                Will be saved to <strong>Product Assets → {dConfig.assetSection}</strong>
              </div>
            </div>
            {isMarkingDone && !deliverableMissing && (
              <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#1E7B4B', background: '#EBF7F1', padding: '2px 10px', borderRadius: 20 }}>
                ✓ Ready
              </span>
            )}
            {deliverableMissing && (
              <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#B07D1A', background: '#FDF6E3', padding: '2px 10px', borderRadius: 20 }}>
                Required to mark Done
              </span>
            )}
          </div>

          {/* URL input */}
          <div style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {dConfig.label} {deliverableMissing && <span style={{ color: '#C0392B' }}>*</span>}
            </label>
            <input
              type="url"
              value={form.deliverableUrl || ''}
              onChange={e => setForm({ ...form, deliverableUrl: e.target.value })}
              placeholder={dConfig.placeholder}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                border: `2px solid ${deliverableMissing ? '#E8D08A' : '#BBE8D0'}`,
                fontSize: 13.5, color: C.text, background: '#fff',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: 11.5, color: C.textMid, marginTop: 5 }}>
              {dConfig.hint}
            </div>
          </div>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 20 }}>
        <input type="checkbox" checked={form.completed}
          onChange={e => setForm({ ...form, completed: e.target.checked, column_name: e.target.checked ? 'Done' : form.column_name })}
          style={{ accentColor: C.accent, width: 15, height: 15 }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.textMid }}>Mark as completed</span>
      </label>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={onSave} disabled={saving}>{saving ? 'Saving…' : title.startsWith('Edit') ? 'Save Changes' : 'Create Task'}</Btn>
      </div>
    </Modal>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TaskManager() {
  const { userName, isAdmin } = useAuth()
  const { rows, loading, error, insert, update, remove } = useRealtimeTable('tasks', { orderBy: 'created_at', ascending: true })

  // ── State (all logic state preserved exactly) ─────────────────────────────
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(blank(userName))
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  // ── New filter/sort state ─────────────────────────────────────────────────
  const [search,   setSearch]  = useState('')
  const [fProduct, setFP]      = useState('')
  const [fMember,  setFM]      = useState('')
  const [fStatus,  setFS]      = useState('')
  const [sort,     setSort]    = useState({ field: 'deadline', asc: true })

  // ── Workflow automation: poll on mount (unchanged) ────────────────────────
  useEffect(() => {
    checkPendingReviewTasks().catch(console.warn)
  }, [])

  // ── Logic functions (all unchanged from original) ─────────────────────────
  function openNew() { setForm(blank(userName)); setEditing(null); setErr(''); setModal(true) }
  function openEdit(r) {
    // Populate deliverableUrl: for deliverable tasks, the URL is stored in drive_links
    // (replaces the initial __workflow: tag once Saida provides the real URL).
    const dConfig = getDeliverableConfig(r.title)
    const rawDriveLinks = r.drive_links || ''
    const isWorkflowTag = rawDriveLinks.startsWith('__workflow:')
    const deliverableUrl = (dConfig && !isWorkflowTag) ? rawDriveLinks : ''
    setForm({ title: r.title, description: r.description || '', team: r.team || 'Creative', assigned_to: r.assigned_to, deadline: r.deadline || '', priority: r.priority, column_name: r.column_name, related_product: r.related_product || '', drive_links: rawDriveLinks, completed: r.completed, deliverableUrl })
    setEditing(r.id); setErr(''); setModal(true)
  }

  async function save() {
    if (!form.title.trim()) return setErr('Title is required.')

    // ── Deliverable validation: block Done if required URL is missing ──────
    const isMarkingDone = form.completed || form.column_name === 'Done'
    if (isMarkingDone) {
      const delivErr = validateDeliverable(form.title, form.deliverableUrl)
      if (delivErr) return setErr(delivErr)
    }

    setSaving(true); setErr('')
    try {
      // Build DB entry — deliverableUrl is stored in drive_links (not a separate column)
      const dConfig = getDeliverableConfig(form.title)
      const dbEntry = { ...form, column_name: form.completed ? 'Done' : form.column_name }
      delete dbEntry.deliverableUrl          // not a DB column
      if (dConfig && form.deliverableUrl?.trim()) {
        // Replace the __workflow: tag with the actual deliverable URL
        dbEntry.drive_links = form.deliverableUrl.trim()
      }

      if (editing) await update(editing, dbEntry)
      else {
        await insert(dbEntry)
        // ── Ensure product_assets row exists as soon as task is created ─────
        if (dbEntry.related_product?.trim()) {
          ensureAssetRow(dbEntry.related_product).catch(console.warn)
        }
      }

      // ── Auto-save asset to product_assets when marked Done ────────────────
      if (isMarkingDone && dConfig && form.related_product && form.deliverableUrl?.trim()) {
        saveDeliverableAsset(form.related_product, form.title, form.deliverableUrl).catch(console.warn)
      }

      setModal(false)
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function toggleDone(task) {
    const completed   = !task.completed
    const column_name = completed ? 'Done' : 'To do'

    // ── Deliverable gate: if marking Done, check required URL is stored ────
    if (completed) {
      const dConfig = getDeliverableConfig(task.title)
      if (dConfig) {
        // URL is stored in drive_links once Saida provides it
        const rawLinks = task.drive_links || ''
        const storedUrl = (!rawLinks.startsWith('__workflow:')) ? rawLinks : ''
        if (!storedUrl.trim()) {
          // Can't mark Done via checkbox — must use Edit modal to add the URL
          alert(`⚠️ Please open "Edit" to add the required ${dConfig.label} before marking this task as Done.`)
          openEdit(task)
          return
        }
        // URL exists — also save/re-confirm in product_assets
        if (task.related_product) {
          saveDeliverableAsset(task.related_product, task.title, storedUrl).catch(console.warn)
        }
      }
    }

    try {
      await update(task.id, { completed, column_name })
      // ── Workflow automation: check step 2 and step 3 triggers ──
      if (completed && task.related_product) {
        const updatedTask = { ...task, completed: true }
        checkSaidaTasksCompleted(task.related_product, rows.map(r => r.id === task.id ? updatedTask : r)).catch(console.warn)
        checkCampaignTaskCompleted(updatedTask).catch(console.warn)
      }
    } catch (e) { alert(e.message) }
  }

  async function changeStatus(id, column_name) {
    // ── Deliverable gate on inline status dropdown too ─────────────────────
    if (column_name === 'Done') {
      const task = rows.find(r => r.id === id)
      if (task) {
        const dConfig = getDeliverableConfig(task.title)
        if (dConfig) {
          const rawLinks = task.drive_links || ''
          const storedUrl = (!rawLinks.startsWith('__workflow:')) ? rawLinks : ''
          if (!storedUrl.trim()) {
            alert(`⚠️ Please open "Edit" to add the required ${dConfig.label} before marking this task as Done.`)
            openEdit(task)
            return
          }
          if (task.related_product) {
            saveDeliverableAsset(task.related_product, task.title, storedUrl).catch(console.warn)
          }
        }
      }
    }
    try { await update(id, { column_name, completed: column_name === 'Done' }) } catch (e) { alert(e.message) }
  }

  async function del(id) {
    if (!isAdmin && rows.find(r => r.id === id)?.assigned_to !== userName) return alert('You can only delete your own tasks.')
    if (!confirm('Delete task?')) return
    try { await remove(id) } catch (e) { alert(e.message) }
  }

  // ── Filter + sort pipeline ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = [...rows]
    if (search)   r = r.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || (t.related_product || '').toLowerCase().includes(search.toLowerCase()) || (t.description || '').toLowerCase().includes(search.toLowerCase()))
    if (fProduct) r = r.filter(t => t.related_product === fProduct)
    if (fMember)  r = r.filter(t => t.assigned_to === fMember)
    if (fStatus)  r = r.filter(t => t.column_name  === fStatus)

    const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 }
    r.sort((a, b) => {
      let va, vb
      if (sort.field === 'deadline') {
        va = a.deadline || '9999'
        vb = b.deadline || '9999'
      } else if (sort.field === 'priority') {
        va = PRIORITY_ORDER[a.priority] ?? 9
        vb = PRIORITY_ORDER[b.priority] ?? 9
      } else {
        va = a[sort.field] || ''
        vb = b[sort.field] || ''
      }
      if (va < vb) return sort.asc ? -1 : 1
      if (va > vb) return sort.asc ?  1 : -1
      return 0
    })
    return r
  }, [rows, search, fProduct, fMember, fStatus, sort])

  function toggleSort(field) {
    setSort(s => s.field === field ? { field, asc: !s.asc } : { field, asc: true })
  }

  // Unique products for filter dropdown
  const productOptions = useMemo(() => [...new Set(rows.map(r => r.related_product).filter(Boolean))].sort(), [rows])

  // Stats
  const totalOpen = rows.filter(r => !r.completed).length
  const totalDone = rows.filter(r =>  r.completed).length
  const overdue   = rows.filter(r => !r.completed && r.deadline && new Date(r.deadline + 'T00:00:00') < new Date()).length

  // ── Shared input style for top bar ────────────────────────────────────────
  const ctrlStyle = {
    padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`,
    fontSize: 13, background: C.surface, color: C.text, fontFamily: 'inherit',
    outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>✅ Tasks</h2>
            <p style={{ margin: '3px 0 0', color: C.textLight, fontSize: 13 }}>
              {totalOpen} open · {totalDone} done{overdue > 0 ? ` · ` : ''}
              {overdue > 0 && <span style={{ color: C.red, fontWeight: 600 }}>{overdue} overdue</span>}
            </p>
          </div>
          <button onClick={openNew} style={{
            background: C.text, color: '#fff', border: 'none', borderRadius: 9,
            padding: '9px 18px', fontSize: 13.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            + New Task
          </button>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.textLight, pointerEvents: 'none' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              style={{ ...ctrlStyle, width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
            />
          </div>

          {/* Product filter */}
          <select value={fProduct} onChange={e => setFP(e.target.value)} style={ctrlStyle}>
            <option value="">All Products</option>
            {productOptions.map(p => <option key={p}>{p}</option>)}
          </select>

          {/* Member filter */}
          <select value={fMember} onChange={e => setFM(e.target.value)} style={ctrlStyle}>
            <option value="">All Members</option>
            {TEAM.map(m => <option key={m}>{m}</option>)}
          </select>

          {/* Status filter */}
          <select value={fStatus} onChange={e => setFS(e.target.value)} style={ctrlStyle}>
            <option value="">All Statuses</option>
            {TASK_COLS.map(c => <option key={c}>{c}</option>)}
          </select>

          {/* Clear filters */}
          {(search || fProduct || fMember || fStatus) && (
            <button onClick={() => { setSearch(''); setFP(''); setFM(''); setFS('') }}
              style={{ ...ctrlStyle, color: C.accent, fontWeight: 600, border: `1.5px solid ${C.accentLight}`, background: C.accentLight }}>
              Clear ×
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textLight }}>
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* ── Task table ────────────────────────────────────────────────────── */}
      <div style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: '#FAFAF8' }}>
                <th style={{ width: 36, borderBottom: `1.5px solid ${C.border}` }} />
                <SortTH label="Task"     field="title"     sort={sort} onSort={toggleSort} />
                <SortTH label="Product"  field="related_product" sort={sort} onSort={toggleSort} />
                <SortTH label="Assigned" field="assigned_to"     sort={sort} onSort={toggleSort} />
                <SortTH label="Priority" field="priority"        sort={sort} onSort={toggleSort} />
                <SortTH label="Status"   field="column_name"     sort={sort} onSort={toggleSort} />
                <SortTH label="Due"      field="deadline"        sort={sort} onSort={toggleSort} />
                <th style={{ padding: '10px 14px', borderBottom: `1.5px solid ${C.border}`, background: '#FAFAF8', width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: C.textLight, fontSize: 14 }}>
                    Loading tasks…
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textMid }}>
                      {search || fProduct || fMember || fStatus ? 'No tasks match your filters' : 'No tasks yet'}
                    </div>
                    <div style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>
                      {search || fProduct || fMember || fStatus ? 'Try clearing the filters' : 'Click "+ New Task" to get started'}
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={toggleDone}
                  onEdit={openEdit}
                  onDelete={del}
                  onStatusChange={changeStatus}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Table footer ──────────────────────────────────────────────── */}
        {!loading && rows.length > 0 && (
          <div style={{
            padding: '10px 16px', borderTop: `1px solid ${C.border}`,
            background: '#FAFAF8', display: 'flex', gap: 24, flexWrap: 'wrap',
          }}>
            {TASK_COLS.map(col => {
              const count = rows.filter(r => r.column_name === col).length
              if (count === 0) return null
              const sp = STATUS_PILL[col] || STATUS_PILL['To do']
              return (
                <span key={col} style={{ fontSize: 12, color: C.textLight, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sp.dot }} />
                  <span style={{ color: sp.text, fontWeight: 700 }}>{col}</span>
                  <span>{count}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Task modal ────────────────────────────────────────────────────── */}
      {modal && (
        <TaskModal
          title={editing ? 'Edit Task' : 'New Task'}
          form={form}
          setForm={setForm}
          onSave={save}
          onClose={() => setModal(false)}
          saving={saving}
          err={err}
        />
      )}
    </div>
  )
}
