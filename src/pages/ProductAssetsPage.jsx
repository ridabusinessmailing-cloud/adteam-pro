import { useState, useMemo } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'
import { C, Modal, Spinner } from '../components/ui.jsx'
import {
  SIMPLE_ASSET_TYPES,
  upsertAssetField, ensureAssetRow,
  addLandingPage, updateLandingPage, deleteLandingPage,
} from '../hooks/useDeliverables.js'

// ── URL helpers ───────────────────────────────────────────
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

// ── Shared small components ───────────────────────────────
function OpenBtn({ url, sm }) {
  if (!url || !isValidUrl(url)) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: sm ? 11.5 : 12, fontWeight: 600,
      padding: sm ? '3px 9px' : '5px 12px', borderRadius: 7,
      background: C.blueLight, color: C.blue,
      textDecoration: 'none', border: `1px solid ${C.blue}22`,
      whiteSpace: 'nowrap',
    }}>
      ↗ {linkLabel(url)}
    </a>
  )
}

function StatusDot({ uploaded }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: uploaded ? '#EBF7F1' : '#F0EDE8',
      color:      uploaded ? '#1E7B4B' : '#9B9589',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: uploaded ? '#1E7B4B' : '#C8C3BC' }} />
      {uploaded ? 'Uploaded' : 'Pending'}
    </span>
  )
}

// ── Edit Link Modal ───────────────────────────────────────
function EditLinkModal({ title, hint, placeholder, productName, dbColumn, currentUrl, onSave, onClose }) {
  const [url, setUrl]       = useState(currentUrl || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  async function save() {
    const trimmed = url.trim()
    if (trimmed && !isValidUrl(trimmed)) return setErr('Please enter a valid URL (must start with https://)')
    setSaving(true); setErr('')
    try {
      await upsertAssetField(productName, dbColumn, trimmed)
      onSave(trimmed); onClose()
    } catch (e) { setErr(e.message || 'Failed to save.') }
    setSaving(false)
  }
  const inp = { width: '100%', padding: '10px 12px', borderRadius: 9, boxSizing: 'border-box', border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.text, background: C.bg, outline: 'none', fontFamily: 'inherit' }
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ marginBottom: 12, fontSize: 13, color: C.textMid }}>Product: <strong style={{ color: C.text }}>{productName}</strong></div>
      {err && <div style={{ background: C.redLight, border: `1.5px solid #F5C6C2`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>⚠️ {err}</div>}
      <div style={{ marginBottom: 6 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Resource URL</label>
        <input type="url" value={url} onChange={e => { setUrl(e.target.value); setErr('') }}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
          placeholder={placeholder} autoFocus style={inp}
          onFocus={e => e.target.style.borderColor = C.accent}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 5 }}>{hint} Leave blank to clear.</div>
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

// ── Landing Page Modal ────────────────────────────────────
function LandingPageModal({ productName, existing, onSave, onClose }) {
  const [angleName, setAngleName] = useState(existing?.angle_name || '')
  const [lpUrl,     setLpUrl]     = useState(existing?.lp_url || '')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  async function save() {
    if (!angleName.trim()) return setErr('Angle name is required.')
    if (!lpUrl.trim())     return setErr('URL is required.')
    if (!isValidUrl(lpUrl.trim())) return setErr('Please enter a valid URL.')
    setSaving(true); setErr('')
    try {
      if (existing) await updateLandingPage(existing.id, angleName, lpUrl)
      else          await addLandingPage(productName, angleName, lpUrl)
      onSave(); onClose()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', background: C.bg, outline: 'none', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, color: C.text }
  return (
    <Modal title={existing ? '✏️ Edit Landing Page' : '+ Add Landing Page'} onClose={onClose}>
      <div style={{ marginBottom: 12, fontSize: 13, color: C.textMid }}>Product: <strong style={{ color: C.text }}>{productName}</strong></div>
      {err && <div style={{ background: C.redLight, border: `1.5px solid #F5C6C2`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>⚠️ {err}</div>}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Angle Name *</label>
        <input value={angleName} onChange={e => setAngleName(e.target.value)} placeholder="e.g. Pain Relief, Focus, Doctor Recommendation" autoFocus style={inp} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
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

// ── Product Asset Card ─────────────────────────────────────
// ── Task-generated assets section ────────────────────────
const MEDIA_TYPE_META = {
  creative_video: { label: 'Creative Video', icon: '🎬', bg: '#F3EEF9', color: '#6B3FA0' },
  creative_image: { label: 'Creative Image', icon: '🖼️', bg: '#EEF4FD', color: '#1A5FB4' },
  landing_page:   { label: 'Landing Page',   icon: '🌐', bg: '#EBF7F1', color: '#1E7B4B' },
  research:       { label: 'Research',       icon: '🔍', bg: '#FDF6E3', color: '#B07D1A' },
  other:          { label: 'Other',          icon: '📋', bg: '#F0EDE8', color: '#9B9589' },
}

function MediaAssetsSection({ mediaAssets }) {
  if (!mediaAssets || mediaAssets.length === 0) return null
  return (
    <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.borderLight}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 15 }}>⚡</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Task Assets</span>
        <span style={{ fontSize: 11, color: C.textLight, background: C.border, padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
          {mediaAssets.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mediaAssets.map(asset => {
          const tm = MEDIA_TYPE_META[asset.type] || MEDIA_TYPE_META.other
          return (
            <div key={asset.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: C.bg, border: `1px solid ${C.borderLight}`,
            }}>
              {/* Type badge */}
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: tm.bg, color: tm.color, flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {tm.icon} {tm.label}
              </span>

              {/* Asset name */}
              <span style={{
                fontSize: 12.5, fontWeight: 600, color: C.text,
                flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={asset.name}>
                {asset.name || 'Untitled Asset'}
              </span>

              {/* Created by */}
              {asset.created_by && (
                <span style={{ fontSize: 11, color: C.textLight, flexShrink: 0 }}>
                  {asset.created_by}
                </span>
              )}

              {/* Open link */}
              {asset.link && (
                <a href={asset.link} target="_blank" rel="noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
                  background: C.blueLight, color: C.blue, textDecoration: 'none',
                  border: `1px solid ${C.blue}22`, flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  ↗ Open
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProductAssetCard({ productName, productStatus, assetRow, landingPages, mediaAssets }) {
  const [localUrls, setLocalUrls] = useState({})
  const [editingAsset, setEditingAsset] = useState(null) // SIMPLE_ASSET_TYPES entry
  const [addingLP, setAddingLP]   = useState(false)
  const [editingLP, setEditingLP] = useState(null)

  async function handleDeleteLP(id) {
    if (!confirm('Delete this landing page?')) return
    try { await deleteLandingPage(id) } catch (e) { alert(e.message) }
  }

  const merged = { ...(assetRow || {}), ...localUrls }

  // Progress
  const uploadedSimple = SIMPLE_ASSET_TYPES.filter(at => merged[at.dbColumn] && isValidUrl(merged[at.dbColumn])).length
  const totalItems = SIMPLE_ASSET_TYPES.length + (landingPages.length > 0 ? 1 : 0)
  const uploadedItems = uploadedSimple + (landingPages.length > 0 ? 1 : 0)
  const pct = totalItems > 0 ? Math.round((uploadedItems / (SIMPLE_ASSET_TYPES.length + 1)) * 100) : 0

  const ss = productStatus === 'active'
    ? { bg: '#EBF7F1', color: '#1E7B4B', border: '#BBE8D0' }
    : { bg: '#FDF6E3', color: '#B07D1A', border: '#E8D08A' }

  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px #1A171406' }}>

      {/* Card header */}
      <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${C.borderLight}`, background: '#FAFAF8' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{productName}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, flexShrink: 0 }}>{productStatus || 'test'}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: uploadedSimple === SIMPLE_ASSET_TYPES.length && landingPages.length > 0 ? C.green : C.textMid }}>
            {uploadedItems}/{SIMPLE_ASSET_TYPES.length + 1}
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ height: 4, background: C.borderLight, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: pct === 100 ? C.green : C.accent, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Landing pages section */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.borderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: landingPages.length > 0 ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>🌐</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Landing Pages</span>
            <span style={{ fontSize: 11, color: C.textLight, background: C.border, padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
              {landingPages.length}
            </span>
          </div>
          <button onClick={() => setAddingLP(true)} style={{ background: 'transparent', border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: C.textMid, fontFamily: 'inherit' }}>
            + Add
          </button>
        </div>

        {landingPages.length === 0 ? (
          <div style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', marginTop: 6 }}>No landing pages yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {landingPages.map(lp => (
              <div key={lp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{lp.angle_name}</span>
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                  <OpenBtn url={lp.lp_url} sm />
                  <button onClick={() => setEditingLP(lp)} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', color: C.textMid, fontFamily: 'inherit' }}>Edit</button>
                  <button onClick={() => handleDeleteLP(lp.id)} style={{ background: 'transparent', border: `1px solid #F5C6C2`, borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', color: C.red, fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Simple asset rows */}
      <div style={{ padding: '4px 20px 12px' }}>
        {SIMPLE_ASSET_TYPES.map((at, idx) => {
          const url = merged[at.dbColumn]
          const uploaded = !!(url && isValidUrl(url))
          return (
            <div key={at.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: idx < SIMPLE_ASSET_TYPES.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
              <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center' }}>{at.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1, minWidth: 0 }}>{at.label}</span>
              <StatusDot uploaded={uploaded} />
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {uploaded && <OpenBtn url={url} sm />}
                <button onClick={() => setEditingAsset(at)} style={{ background: uploaded ? C.bg : C.accent, color: uploaded ? C.textMid : '#fff', border: uploaded ? `1.5px solid ${C.border}` : 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {uploaded ? 'Edit' : '+ Add'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {editingAsset && (
        <EditLinkModal
          title={`${editingAsset.icon} ${editingAsset.label}`}
          hint={editingAsset.hint}
          placeholder={editingAsset.placeholder}
          productName={productName}
          dbColumn={editingAsset.dbColumn}
          currentUrl={merged[editingAsset.dbColumn]}
          onSave={url => setLocalUrls(p => ({ ...p, [editingAsset.dbColumn]: url }))}
          onClose={() => setEditingAsset(null)}
        />
      )}
      {(addingLP || editingLP) && (
        <LandingPageModal
          productName={productName}
          existing={editingLP}
          onSave={() => {}}
          onClose={() => { setAddingLP(false); setEditingLP(null) }}
        />
      )}

      {/* Task-generated assets from media_assets table */}
      <MediaAssetsSection mediaAssets={mediaAssets} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function ProductAssetsPage() {
  const { rows: products,    loading: pLoad } = useRealtimeTable('products',       { orderBy: 'created_at',   ascending: true })
  const { rows: assets,      loading: aLoad } = useRealtimeTable('product_assets', { orderBy: 'product_name', ascending: true })
  const { rows: allLPs }                      = useRealtimeTable('landing_pages',  { orderBy: 'created_at',   ascending: true })
  const { rows: allMediaAssets }              = useRealtimeTable('media_assets',   { orderBy: 'created_at',   ascending: false })

  const [search,   setSearch]   = useState('')
  const [fStatus,  setFStatus]  = useState('')
  const [addModal, setAddModal] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [adding,   setAdding]   = useState(false)

  const loading = pLoad || aLoad

  const assetMap = useMemo(() => {
    const m = {}; assets.forEach(a => { m[a.product_name] = a }); return m
  }, [assets])

  const lpMap = useMemo(() => {
    const m = {}
    allLPs.forEach(lp => { if (!m[lp.product_name]) m[lp.product_name] = []; m[lp.product_name].push(lp) })
    return m
  }, [allLPs])

  // Group media_assets by product_name for O(1) lookup in cards
  const mediaAssetsMap = useMemo(() => {
    const m = {}
    allMediaAssets.forEach(a => {
      if (!m[a.product_name]) m[a.product_name] = []
      m[a.product_name].push(a)
    })
    return m
  }, [allMediaAssets])

  const productMap = useMemo(() => {
    const m = {}; products.forEach(p => { m[p.name] = p }); return m
  }, [products])

  const allNames = useMemo(() => {
    const fromProducts = products.map(p => p.name)
    const fromAssets   = assets.map(a => a.product_name).filter(n => !fromProducts.includes(n))
    return [...fromProducts, ...fromAssets]
  }, [products, assets])

  const filtered = useMemo(() => {
    let names = allNames
    if (search)  names = names.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    if (fStatus) {
      names = names.filter(n => {
        const p = productMap[n]
        return p ? p.status === fStatus : fStatus === 'test'
      })
    }
    return names
  }, [allNames, search, fStatus, productMap])

  // Stats
  const totalProducts  = allNames.length
  const totalSimple    = SIMPLE_ASSET_TYPES.length
  const uploadedSimpleCount = assets.reduce((sum, a) => sum + SIMPLE_ASSET_TYPES.filter(at => a[at.dbColumn] && isValidUrl(a[at.dbColumn])).length, 0)
  const totalLPs = allLPs.length

  async function handleAddProduct() {
    const n = newName.trim()
    if (!n) return
    setAdding(true)
    try { await ensureAssetRow(n); setNewName(''); setAddModal(false) } catch (e) { alert(e.message) }
    setAdding(false)
  }

  function isValidUrl(s) { try { new URL(s); return !!s } catch { return false } }

  const ctrlSt = { padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, background: C.surface, color: C.text, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>🗂️ Product Assets</h2>
            <p style={{ margin: '3px 0 0', color: C.textLight, fontSize: 13 }}>Resource library — landing pages, creatives, docs for every product</p>
          </div>
          <button onClick={() => setAddModal(true)} style={{ background: C.text, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Product
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Products',         value: totalProducts,           color: C.text },
            { label: 'Assets uploaded',  value: uploadedSimpleCount,     color: C.accent },
            { label: 'Landing pages',    value: totalLPs,                color: C.blue },
            { label: 'Task assets',       value: allMediaAssets.length,   color: C.green },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', minWidth: 110 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: C.textLight, fontWeight: 600, marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 160px', maxWidth: 240 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.textLight, pointerEvents: 'none' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={{ ...ctrlSt, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }} />
          </div>
          {[{ v: '', label: 'All' }, { v: 'test', label: '🟡 Test' }, { v: 'active', label: '🟢 Active' }].map(({ v, label }) => (
            <button key={v} onClick={() => setFStatus(v)} style={{ ...ctrlSt, fontWeight: fStatus === v ? 700 : 500, background: fStatus === v ? C.text : C.surface, color: fStatus === v ? '#fff' : C.textMid, border: fStatus === v ? 'none' : `1.5px solid ${C.border}` }}>
              {label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textLight }}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Spinner /></div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>
            {search || fStatus ? 'No products match' : 'No products yet'}
          </div>
          <div style={{ fontSize: 13, color: C.textLight }}>
            {search || fStatus ? 'Try clearing the filters' : 'Products appear automatically when tasks are created.'}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
          {filtered.map(name => (
            <ProductAssetCard
              key={name}
              productName={name}
              productStatus={productMap[name]?.status || 'test'}
              assetRow={assetMap[name]}
              landingPages={lpMap[name] || []}
              mediaAssets={mediaAssetsMap[name] || []}
            />
          ))}
        </div>
      )}

      {/* Add product modal */}
      {addModal && (
        <Modal title="Add Product to Assets" onClose={() => setAddModal(false)}>
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Product Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddProduct(); if (e.key === 'Escape') setAddModal(false) }} placeholder="e.g. Brain Supplement" autoFocus style={{ width: '100%', padding: '10px 12px', borderRadius: 9, boxSizing: 'border-box', border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.text, background: C.bg, outline: 'none', fontFamily: 'inherit' }} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
            <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 5 }}>Must match the product name used in tasks.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setAddModal(false)} style={{ background: 'transparent', color: C.textMid, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleAddProduct} disabled={adding} style={{ background: adding ? C.textLight : C.text, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: adding ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {adding ? 'Creating…' : 'Create'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
