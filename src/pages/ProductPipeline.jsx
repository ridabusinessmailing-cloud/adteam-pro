import { useState, useEffect, useRef, useMemo } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { C, ErrorBanner, Spinner, Modal } from '../components/ui.jsx'
import { supabase } from '../lib/supabase.js'
import { triggerProductCreated } from '../hooks/useWorkflowAutomation.js'
import {
  SIMPLE_ASSET_TYPES, upsertAssetField, ensureAssetRow,
  addLandingPage, updateLandingPage, deleteLandingPage,
} from '../hooks/useDeliverables.js'
import { useRealtimeTable as useRT } from '../hooks/useRealtimeTable.js'

// ── Constants (unchanged) ─────────────────────────────────
const PRODUCT_STATUSES = ['test', 'active']
const STATUS_STYLE = {
  test:   { bg: '#FDF6E3', color: '#B07D1A', border: '#E8D08A' },
  active: { bg: '#EBF7F1', color: '#1E7B4B', border: '#BBE8D0' },
}
const LOW_WARN = 200
const LOW_CRIT = 50

// ── Unchanged logic helpers ───────────────────────────────
function rowColors(available) {
  if (available < LOW_CRIT) return { bg: '#FDECEA', border: '#F5C6C2' }
  if (available < LOW_WARN) return { bg: '#FEF3F2', border: '#FECACA' }
  return { bg: '#FFFFFF', border: '#F0EDE8' }
}
const blankProduct = () => ({
  name: '', sku: '', status: 'test',
  available_qty: 0, sold_qty: 0, add_qty: 0, incoming_qty: 0,
})

// ── Shared UI helpers ─────────────────────────────────────
function isValidUrl(s) {
  if (!s) return false
  try { new URL(s); return true } catch { return false }
}
function linkLabel(url) {
  if (!url) return 'Open'
  try {
    const u = new URL(url)
    if (u.hostname.includes('drive.google.com')) return 'Open Drive'
    if (u.hostname.includes('docs.google.com'))  return 'Open Doc'
    if (u.hostname.includes('notion.so'))        return 'Open Notion'
    if (url.toLowerCase().endsWith('.pdf'))      return 'Open PDF'
    return 'Open Link'
  } catch { return 'Open Link' }
}

function Pill({ children, color = C.textLight, bg = '#F0EDE8', border }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: bg, color,
      border: border ? `1px solid ${border}` : 'none',
    }}>
      {children}
    </span>
  )
}

function OpenBtn({ url }) {
  if (!url || !isValidUrl(url)) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 7,
      background: C.blueLight, color: C.blue, textDecoration: 'none',
      border: `1px solid ${C.blue}22`, whiteSpace: 'nowrap',
    }}>
      ↗ {linkLabel(url)}
    </a>
  )
}

// ── Editable inline cell (UNCHANGED from original) ────────
function Cell({ value, onChange, onCommit, type = 'text', align = 'left', placeholder = '—' }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
  const ref = useRef(null)
  useEffect(() => { if (editing) ref.current?.select() }, [editing])
  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])
  function commit() {
    setEditing(false)
    const v = type === 'number' ? (parseFloat(draft) || 0) : String(draft)
    if (v !== value) onChange(v)
    onCommit?.()
  }
  function onKey(e) {
    if (e.key === 'Enter')  { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setEditing(false); setDraft(value) }
  }
  if (editing) {
    return (
      <input ref={ref} type={type === 'number' ? 'number' : 'text'}
        value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={onKey}
        style={{ width: '100%', padding: '5px 8px', borderRadius: 6,
          border: `2px solid ${C.accent}`, outline: 'none', fontSize: 13.5,
          fontFamily: 'inherit', fontWeight: 500, background: '#fff',
          color: C.text, textAlign: align, boxShadow: `0 0 0 3px ${C.accent}18` }}
      />
    )
  }
  const isEmpty = value === '' || value === null || value === undefined
  return (
    <div onClick={() => setEditing(true)}
      style={{ padding: '6px 8px', borderRadius: 6, cursor: 'text',
        color: isEmpty ? C.textLight : C.text,
        fontStyle: isEmpty ? 'italic' : 'normal',
        fontWeight: type === 'number' ? 600 : 500,
        fontSize: 13.5, minHeight: 32,
        display: 'flex', alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#F2F0EC'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {isEmpty ? placeholder : (type === 'number' ? Number(value).toLocaleString() : value)}
    </div>
  )
}

// ── Add Product Modal ─────────────────────────────────────
function AddProductModal({ onSave, onClose }) {
  const [row, setRow] = useState(blankProduct())
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)
  useEffect(() => nameRef.current?.focus(), [])

  function f(field) { return e => setRow(r => ({ ...r, [field]: e.target.value })) }

  async function save() {
    if (!row.name.trim()) return setErr('Product name is required.')
    setSaving(true); setErr('')
    try {
      await onSave({
        ...row,
        available_qty: Number(row.available_qty) || 0,
        sold_qty:      Number(row.sold_qty)      || 0,
        add_qty:       Number(row.add_qty)       || 0,
        incoming_qty:  Number(row.incoming_qty)  || 0,
      })
      onClose()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  const inp = (extra = {}) => ({
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13.5,
    fontFamily: 'inherit', background: C.bg, outline: 'none', boxSizing: 'border-box',
    border: `1.5px solid ${C.border}`, color: C.text, ...extra,
  })

  return (
    <Modal title="Add New Product" onClose={onClose}>
      {err && <div style={{ background: C.redLight, border: `1.5px solid #F5C6C2`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>⚠️ {err}</div>}

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Product Name *</label>
        <input ref={nameRef} value={row.name} onChange={f('name')} onKeyDown={e => e.key === 'Enter' && save()} placeholder="e.g. Brain Supplement" style={{ ...inp(), border: `2px solid ${C.accent}` }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>SKU</label>
          <input value={row.sku} onChange={f('sku')} placeholder="SKU-001" style={inp()} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</label>
          <select value={row.status} onChange={f('status')} style={{ ...inp(), cursor: 'pointer' }}>
            {PRODUCT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Available Qty</label>
          <input type="number" value={row.available_qty} onChange={f('available_qty')} style={{ ...inp(), textAlign: 'right' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Incoming Qty</label>
          <input type="number" value={row.incoming_qty} onChange={f('incoming_qty')} style={{ ...inp(), textAlign: 'right' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ background: 'transparent', color: C.textMid, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ background: saving ? C.textLight : C.text, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Creating…' : 'Create Product'}
        </button>
      </div>
    </Modal>
  )
}

// ── Edit Asset Link Modal ─────────────────────────────────
function EditAssetModal({ assetType, productName, currentUrl, onSave, onClose }) {
  const [url, setUrl]     = useState(currentUrl || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')
  async function save() {
    const trimmed = url.trim()
    if (trimmed && !isValidUrl(trimmed)) return setErr('Please enter a valid URL (must start with https://)')
    setSaving(true); setErr('')
    try {
      await upsertAssetField(productName, assetType.dbColumn, trimmed)
      onSave(trimmed); onClose()
    } catch (e) { setErr(e.message || 'Failed to save.') }
    setSaving(false)
  }
  return (
    <Modal title={`${assetType.icon} ${assetType.label}`} onClose={onClose}>
      <div style={{ marginBottom: 12, fontSize: 13, color: C.textMid }}>
        Product: <strong style={{ color: C.text }}>{productName}</strong>
      </div>
      {err && <div style={{ background: C.redLight, border: `1.5px solid #F5C6C2`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>⚠️ {err}</div>}
      <div style={{ marginBottom: 6 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Resource URL</label>
        <input type="url" value={url} onChange={e => { setUrl(e.target.value); setErr('') }}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
          placeholder={assetType.placeholder} autoFocus
          style={{ width: '100%', padding: '10px 12px', borderRadius: 9, boxSizing: 'border-box', border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.text, background: C.bg, outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => e.target.style.borderColor = C.accent}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 5 }}>{assetType.hint} Leave blank to clear.</div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onClose} style={{ background: 'transparent', color: C.textMid, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ background: saving ? C.textLight : C.text, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : currentUrl ? 'Update Link' : 'Save Link'}
        </button>
      </div>
    </Modal>
  )
}

// ── Add / Edit Landing Page Modal ─────────────────────────
function LandingPageModal({ productName, existing, onSave, onClose }) {
  const [angleName, setAngleName] = useState(existing?.angle_name || '')
  const [lpUrl,     setLpUrl]     = useState(existing?.lp_url || '')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  async function save() {
    if (!angleName.trim()) return setErr('Angle name is required.')
    if (!lpUrl.trim())     return setErr('Landing page URL is required.')
    if (!isValidUrl(lpUrl.trim())) return setErr('Please enter a valid URL.')
    setSaving(true); setErr('')
    try {
      if (existing) {
        await updateLandingPage(existing.id, angleName, lpUrl)
      } else {
        await addLandingPage(productName, angleName, lpUrl)
      }
      onSave(); onClose()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', background: C.bg, outline: 'none', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, color: C.text }
  return (
    <Modal title={existing ? 'Edit Landing Page' : 'Add Landing Page'} onClose={onClose}>
      <div style={{ marginBottom: 12, fontSize: 13, color: C.textMid }}>
        Product: <strong style={{ color: C.text }}>{productName}</strong>
      </div>
      {err && <div style={{ background: C.redLight, border: `1.5px solid #F5C6C2`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>⚠️ {err}</div>}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Angle Name *</label>
        <input value={angleName} onChange={e => setAngleName(e.target.value)} placeholder="e.g. Pain Relief, Focus Angle, Testimonial" autoFocus style={inp} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Landing Page URL *</label>
        <input type="url" value={lpUrl} onChange={e => setLpUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="https://yourstore.com/product-page" style={inp} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ background: 'transparent', color: C.textMid, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ background: saving ? C.textLight : C.text, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : existing ? 'Update' : 'Add Landing Page'}
        </button>
      </div>
    </Modal>
  )
}

// ── Product Workspace (detail view) ──────────────────────
function ProductWorkspace({ product, onBack, insert: tableInsert, update: tableUpdate, remove: tableRemove }) {
  const [activeTab, setActiveTab]   = useState('assets')
  const [pending,   setPending]     = useState({})
  const [saving,    setSaving]      = useState({})
  const [saveErr,   setSaveErr]     = useState('')

  // Assets state
  const [assetRow,  setAssetRow]    = useState(null)
  const [localUrls, setLocalUrls]   = useState({})
  const [editingAsset, setEditingAsset] = useState(null)

  // Landing pages
  const { rows: landingPages } = useRT('landing_pages', { filter: { product_name: product.name } })
  const [addingLP,    setAddingLP]    = useState(false)
  const [editingLP,   setEditingLP]   = useState(null)

  // Load asset row for this product
  useEffect(() => {
    supabase.from('product_assets').select('*').eq('product_name', product.name).single()
      .then(({ data }) => { if (data) setAssetRow(data) })
      .catch(() => {})
  }, [product.name])

  // ── Existing logic for editing product fields (UNCHANGED) ──
  const row = product
  function queue(field, value) { setPending(p => ({ ...p, [field]: value })) }
  function display() { return { ...row, ...pending } }

  async function commitField(field) {
    const changes = pending
    if (!changes || Object.keys(changes).length === 0) return
    setSaving(s => ({ ...s, [field]: true })); setSaveErr('')
    try {
      const d = display()
      const addDelta  = field === 'add_qty'  ? (Number(d.add_qty)  - Number(row.add_qty))  : 0
      const soldDelta = field === 'sold_qty' ? (Number(d.sold_qty) - Number(row.sold_qty)) : 0
      const newAvail  = Math.max(0, (Number(row.available_qty) || 0) + addDelta - soldDelta)
      await supabase.from('products').update({ ...changes, available_qty: newAvail }).eq('id', row.id)
      setPending({})
    } catch (e) { setSaveErr(e.message) }
    setSaving(s => { const n = { ...s }; delete n[field]; return n })
  }

  // Asset helpers
  const mergedAsset = { ...(assetRow || {}), ...localUrls }
  function handleAssetSaved(dbColumn, url) { setLocalUrls(p => ({ ...p, [dbColumn]: url })) }

  async function handleDeleteLP(id) {
    if (!confirm('Delete this landing page?')) return
    try { await deleteLandingPage(id) } catch (e) { alert(e.message) }
  }

  const d = display()
  const avail = d.available_qty ?? 0
  const availColor = avail < LOW_CRIT ? C.red : avail < LOW_WARN ? C.yellow : C.green

  const TABS = [
    { id: 'assets',  label: '🗂️ Assets' },
    { id: 'tasks',   label: '✅ Tasks' },
    { id: 'stock',   label: '📦 Stock' },
  ]

  return (
    <div>
      {/* Back + header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: C.textLight, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
          ← Back to Products
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: '-0.03em' }}>{product.name}</h2>
              {product.sku && <span style={{ fontSize: 11.5, color: C.textLight, background: C.border, padding: '2px 9px', borderRadius: 6, fontWeight: 600 }}>{product.sku}</span>}
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 20, background: STATUS_STYLE[product.status]?.bg, color: STATUS_STYLE[product.status]?.color, border: `1px solid ${STATUS_STYLE[product.status]?.border}` }}>
                {product.status}
              </span>
            </div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>
              Stock: <strong style={{ color: availColor }}>{avail.toLocaleString()}</strong> available
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${C.border}`, marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: activeTab === t.id ? 800 : 500,
            color: activeTab === t.id ? C.text : C.textLight,
            padding: '10px 16px', borderBottom: activeTab === t.id ? `3px solid ${C.accent}` : '3px solid transparent',
            marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {saveErr && <ErrorBanner message={saveErr} />}

      {/* ── ASSETS TAB ──────────────────────────────────── */}
      {activeTab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Landing Pages section */}
          <div style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderLight}`, background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🌐</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Landing Pages</span>
                <span style={{ fontSize: 11.5, color: C.textLight, background: C.border, padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>
                  {landingPages.length} angle{landingPages.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button onClick={() => setAddingLP(true)} style={{ background: C.text, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add Landing Page
              </button>
            </div>
            <div style={{ padding: landingPages.length === 0 ? '32px 20px' : '4px 20px 12px' }}>
              {landingPages.length === 0 ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: C.textLight, marginBottom: 8 }}>No landing pages yet.</div>
                  <button onClick={() => setAddingLP(true)} style={{ background: C.accentLight, color: C.accent, border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Add first landing page
                  </button>
                </div>
              ) : (
                landingPages.map((lp, idx) => (
                  <div key={lp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: idx < landingPages.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{lp.angle_name}</div>
                      <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lp.lp_url}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      <OpenBtn url={lp.lp_url} />
                      <button onClick={() => setEditingLP(lp)} style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.textMid, fontFamily: 'inherit' }}>Edit</button>
                      <button onClick={() => handleDeleteLP(lp.id)} style={{ background: C.redLight, border: `1.5px solid #F5C6C2`, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.red, fontFamily: 'inherit' }}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Simple asset rows */}
          {SIMPLE_ASSET_TYPES.map(at => {
            const url = mergedAsset[at.dbColumn]
            const uploaded = !!(url && isValidUrl(url))
            return (
              <div key={at.key} style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{at.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{at.label}</div>
                      <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 1 }}>{at.hint}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: uploaded ? '#EBF7F1' : '#F0EDE8', color: uploaded ? '#1E7B4B' : '#9B9589' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: uploaded ? '#1E7B4B' : '#C8C3BC' }} />
                      {uploaded ? 'Uploaded' : 'Pending'}
                    </span>
                    {uploaded && <OpenBtn url={url} />}
                    <button onClick={() => setEditingAsset(at)} style={{ background: uploaded ? C.bg : C.accent, color: uploaded ? C.textMid : '#fff', border: uploaded ? `1.5px solid ${C.border}` : 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {uploaded ? 'Edit Link' : '+ Add Link'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TASKS TAB ───────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <TasksForProduct productName={product.name} />
      )}

      {/* ── STOCK TAB ───────────────────────────────────── */}
      {activeTab === 'stock' && (
        <StockEditor product={product} queue={queue} display={display} commitField={commitField} />
      )}

      {/* Modals */}
      {editingAsset && (
        <EditAssetModal
          assetType={editingAsset}
          productName={product.name}
          currentUrl={mergedAsset[editingAsset.dbColumn]}
          onSave={url => handleAssetSaved(editingAsset.dbColumn, url)}
          onClose={() => setEditingAsset(null)}
        />
      )}
      {(addingLP || editingLP) && (
        <LandingPageModal
          productName={product.name}
          existing={editingLP}
          onSave={() => {}}
          onClose={() => { setAddingLP(false); setEditingLP(null) }}
        />
      )}
    </div>
  )
}

// ── Tasks tab for a product ───────────────────────────────
function TasksForProduct({ productName }) {
  const { rows: tasks, loading } = useRT('tasks', { orderBy: 'created_at', ascending: true })
  const productTasks = tasks.filter(t => t.related_product === productName)
  const open = productTasks.filter(t => !t.completed)
  const done = productTasks.filter(t =>  t.completed)

  if (loading) return <div style={{ padding: '40px 0', textAlign: 'center', color: C.textLight }}>Loading…</div>
  if (productTasks.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: C.textLight }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.textMid }}>No tasks linked to this product yet</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Tasks created with this product name will appear here.</div>
    </div>
  )

  const STATUS_PILL_COLORS = {
    'To do':       { bg: '#F0EDE8', color: '#9B9589' },
    'In progress': { bg: '#EEF4FD', color: '#1A5FB4' },
    'Review':      { bg: '#FDF6E3', color: '#B07D1A' },
    'Done':        { bg: '#EBF7F1', color: '#1E7B4B' },
    'Backlog':     { bg: '#F0EDE8', color: '#9B9589' },
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ label: 'Open tasks', value: open.length, color: C.accent }, { label: 'Completed', value: done.length, color: C.green }].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: C.textLight, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
        {productTasks.map((t, idx) => {
          const sp = STATUS_PILL_COLORS[t.column_name] || STATUS_PILL_COLORS['To do']
          return (
            <div key={t.id} style={{ padding: '14px 20px', borderBottom: idx < productTasks.length - 1 ? `1px solid ${C.borderLight}` : 'none', display: 'flex', alignItems: 'center', gap: 12, opacity: t.completed ? 0.6 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, textDecoration: t.completed ? 'line-through' : 'none', marginBottom: 3 }}>{t.title}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: C.textLight }}>{t.assigned_to}</span>
                  {t.deadline && <span style={{ fontSize: 11.5, color: C.textLight }}>· {t.deadline}</span>}
                </div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sp.bg, color: sp.color, flexShrink: 0 }}>
                {t.column_name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Stock editor tab (UNCHANGED logic) ────────────────────
function StockEditor({ product, queue, display, commitField }) {
  const d = display()
  const avail = d.available_qty ?? 0
  const rc = rowColors(avail)
  const availColor = avail < LOW_CRIT ? C.red : avail < LOW_WARN ? C.yellow : C.green

  return (
    <div>
      <div style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: '#FAFAF8', borderBottom: `1px solid ${C.borderLight}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>📦 Stock Management</div>
          <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>Click any value to edit · Enter to save</div>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {[
            { label: 'Available', field: 'available_qty', color: availColor, readOnly: true, value: avail },
            { label: 'Sold Qty', field: 'sold_qty' },
            { label: 'Add Qty', field: 'add_qty' },
            { label: 'Incoming', field: 'incoming_qty' },
          ].map(({ label, field, color, readOnly, value: overrideVal }) => (
            <div key={field} style={{ background: C.bg, borderRadius: 10, padding: '14px 16px', border: `1.5px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
              {readOnly ? (
                <div style={{ fontSize: 24, fontWeight: 900, color: color || C.text, letterSpacing: '-0.02em' }}>{(overrideVal ?? d[field] ?? 0).toLocaleString()}</div>
              ) : (
                <Cell
                  value={d[field] ?? 0}
                  type="number"
                  align="right"
                  onChange={v => queue(field, v)}
                  onCommit={() => commitField(field)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <p style={{ marginTop: 10, fontSize: 11.5, color: C.textLight, textAlign: 'center' }}>
        Available is recalculated automatically when Add Qty or Sold Qty changes.
      </p>
    </div>
  )
}

// ── Product Card (inventory overview only) ───────────────
function ProductCard({ product, onClick }) {
  const avail = product.available_qty ?? 0
  const sold  = product.sold_qty      ?? 0
  const inc   = product.incoming_qty  ?? 0
  const availColor = avail < LOW_CRIT ? C.red : avail < LOW_WARN ? C.yellow : C.green
  const ss = STATUS_STYLE[product.status] || STATUS_STYLE.test

  return (
    <div onClick={onClick} style={{
      background: C.surface, borderRadius: 14, border: `1.5px solid ${C.border}`,
      cursor: 'pointer', overflow: 'hidden',
      boxShadow: '0 1px 3px #1A171406',
      transition: 'transform 0.12s, box-shadow 0.12s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px #1A171412' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px #1A171406' }}
    >
      {/* Status strip */}
      <div style={{ height: 3, background: product.status === 'active' ? '#1E7B4B' : '#B07D1A' }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Name + status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>{product.name}</div>
            {product.sku && <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginTop: 2 }}>SKU: {product.sku}</div>}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, flexShrink: 0 }}>
            {product.status}
          </span>
        </div>

        {/* Inventory metrics — the only thing on this card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ background: C.bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: availColor, letterSpacing: '-0.02em', lineHeight: 1 }}>{avail.toLocaleString()}</div>
            <div style={{ fontSize: 10.5, color: C.textLight, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>In Stock</div>
          </div>
          <div style={{ background: C.bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.textMid, letterSpacing: '-0.02em', lineHeight: 1 }}>{sold.toLocaleString()}</div>
            <div style={{ fontSize: 10.5, color: C.textLight, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sold</div>
          </div>
          <div style={{ background: C.bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: inc > 0 ? C.blue : C.textLight, letterSpacing: '-0.02em', lineHeight: 1 }}>{inc.toLocaleString()}</div>
            <div style={{ fontSize: 10.5, color: C.textLight, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Incoming</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function ProductsTable() {
  const { rows, loading, error, insert, update, remove } = useRealtimeTable('products', { orderBy: 'created_at', ascending: true })
  // assets and tasks are loaded inside ProductWorkspace — not needed on the list view

  // ── All unchanged logic state ──────────────────────────
  const [pending,   setPending]   = useState({})
  const [saving,    setSaving]    = useState({})
  const [saveErr,   setSaveErr]   = useState('')

  // ── New UI state ───────────────────────────────────────
  const [addingRow,   setAddingRow]   = useState(false)
  const [fStatus,     setFStatus]     = useState('')
  const [search,      setSearch]      = useState('')
  const [workspace,   setWorkspace]   = useState(null) // product object or null

  // ── Unchanged logic functions ──────────────────────────
  function display(row) { return { ...row, ...(pending[row.id] || {}) } }
  function queue(id, field, value) { setPending(p => ({ ...p, [id]: { ...(p[id] || {}), [field]: value } })) }

  async function commitRow(id) {
    const changes = pending[id]
    if (!changes || Object.keys(changes).length === 0) return
    setSaving(s => ({ ...s, [id]: true })); setSaveErr('')
    try {
      const row    = rows.find(r => r.id === id)
      const merged = { ...row, ...changes }
      const addDelta  = (Number(merged.add_qty)  || 0) - (Number(row.add_qty)  || 0)
      const soldDelta = (Number(merged.sold_qty) || 0) - (Number(row.sold_qty) || 0)
      const newAvail  = Math.max(0, (Number(row.available_qty) || 0) + addDelta - soldDelta)
      await supabase.from('products').update({ ...changes, available_qty: newAvail }).eq('id', id)
      setPending(p => { const n = { ...p }; delete n[id]; return n })
    } catch (e) { setSaveErr(e.message) }
    setSaving(s => { const n = { ...s }; delete n[id]; return n })
  }

  async function toggleStatus(id, newStatus) {
    await supabase.from('products').update({ status: newStatus }).eq('id', id)
  }

  async function deleteRow(id) {
    if (!confirm('Delete this product?')) return
    try { await remove(id) } catch (e) { alert(e.message) }
  }

  async function saveNewRow(data) {
    setSaveErr('')
    try {
      await insert(data)
      setAddingRow(false)
      // ── Workflow automation: fire tasks when a "test" product is created ──
      if (data.status === 'test' && data.name?.trim()) {
        triggerProductCreated(data.name.trim()).catch(console.warn)
      }
      // ── Ensure product_assets row exists ──
      if (data.name?.trim()) {
        ensureAssetRow(data.name.trim()).catch(console.warn)
      }
    } catch (e) { setSaveErr(e.message) }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (fStatus) r = r.filter(p => p.status === fStatus)
    if (search)  r = r.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()))
    return r
  }, [rows, fStatus, search])

  const ctrlSt = {
    padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`,
    fontSize: 13, background: C.surface, color: C.text,
    fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
  }

  // ── Workspace view ─────────────────────────────────────
  if (workspace) {
    return (
      <ProductWorkspace
        product={workspace}
        onBack={() => setWorkspace(null)}
        insert={insert}
        update={update}
        remove={remove}
      />
    )
  }

  // ── List view ──────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>📦 Products</h2>
            <p style={{ margin: '3px 0 0', color: C.textLight, fontSize: 13 }}>
              {rows.length} product{rows.length !== 1 ? 's' : ''} · click a card to open workspace
            </p>
          </div>
          <button onClick={() => setAddingRow(true)} style={{ background: C.text, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Product
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 160px', maxWidth: 240 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.textLight, pointerEvents: 'none' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={{ ...ctrlSt, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }} />
          </div>
          {[{ v: '', label: 'All' }, { v: 'test', label: '🟡 Test' }, { v: 'active', label: '🟢 Active' }].map(({ v, label }) => (
            <button key={v} onClick={() => setFStatus(v)} style={{
              ...ctrlSt,
              fontWeight: fStatus === v ? 700 : 500,
              background: fStatus === v ? C.text : C.surface,
              color: fStatus === v ? '#fff' : C.textMid,
              border: fStatus === v ? 'none' : `1.5px solid ${C.border}`,
            }}>
              {label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textLight }}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {saveErr && <ErrorBanner message={saveErr} />}
      {error    && <ErrorBanner message={error} />}

      {/* Loading */}
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Spinner /></div>}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>
            {search || fStatus ? 'No products match' : 'No products yet'}
          </div>
          <div style={{ fontSize: 13, color: C.textLight }}>
            {search || fStatus ? 'Try clearing the filters' : 'Click "+ Add Product" to get started.'}
          </div>
        </div>
      )}

      {/* Product cards grid */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
          {filtered.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => setWorkspace(product)}
            />
          ))}
        </div>
      )}

      {/* Add product modal */}
      {addingRow && (
        <AddProductModal
          onSave={saveNewRow}
          onClose={() => setAddingRow(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
