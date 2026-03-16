import { useState } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  C, Tag, Avatar, Card, Modal, FL, Inp, Sel, Row, Btn,
  PageHeader, FilterBar, FilterSel, DriveLink,
  ErrorBanner, STATUS_META,
} from '../components/ui.jsx'

const TEAM = ['Rida', 'Oussama', 'Saida', 'Sana']
const CREATIVE_STATUSES = ['To do', 'In progress', 'Ready']
const CREATIVE_TYPES = ['Video', 'Static', 'Landing Page']

const blank = () => ({ product: '', creative_type: 'Video', drive_link: '', landing_page_link: '', assigned_to: 'Saida', status: 'To do' })

export default function CreativeBoard() {
  const { userName } = useAuth()
  const { rows: creatives, loading, error, insert, update, remove } = useRealtimeTable('creatives')
  const { rows: products } = useRealtimeTable('products', { orderBy: 'name' })

  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [fProduct, setFProduct] = useState('')
  const [fStatus, setFStatus]   = useState('')
  const [form, setForm]     = useState(blank())
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const productNames = [...new Set(products.filter(p => !['Rejected','Killed'].includes(p.validation_status)).map(p => p.name))]

  function openNew()   { setForm(blank()); setEditing(null); setErr(''); setModal(true) }
  function openEdit(r) { setForm({ product: r.product, creative_type: r.creative_type, drive_link: r.drive_link || '', landing_page_link: r.landing_page_link || '', assigned_to: r.assigned_to, status: r.status }); setEditing(r.id); setErr(''); setModal(true) }

  async function save() {
    if (!form.product.trim()) return setErr('Product is required.')
    setSaving(true); setErr('')
    try {
      if (editing) await update(editing, form)
      else await insert(form)
      setModal(false)
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function del(id) {
    try { await remove(id) } catch (e) { alert(e.message) }
  }

  const F = creatives.filter(r => (!fProduct || r.product === fProduct) && (!fStatus || r.status === fStatus))
  const grouped = CREATIVE_STATUSES.reduce((acc, s) => { acc[s] = F.filter(r => r.status === s); return acc; }, {})

  return (
    <div>
      <PageHeader title="🎬 Creative Production" subtitle="Track creatives from brief to delivery"
        action={<Btn onClick={openNew}>+ New Creative</Btn>} />
      {error && <ErrorBanner message={error} />}
      <FilterBar>
        <FilterSel value={fProduct} onChange={setFProduct} options={productNames} placeholder="All products" />
        <FilterSel value={fStatus}  onChange={setFStatus}  options={CREATIVE_STATUSES} placeholder="All statuses" />
      </FilterBar>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {CREATIVE_STATUSES.map(status => (
          <div key={status} style={{ background: C.bg, borderRadius: 14, padding: 14, minHeight: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_META[status]?.text || C.textLight }} />
              <span style={{ fontWeight: 800, fontSize: 13.5, color: C.text }}>{status}</span>
              <span style={{ marginLeft: 'auto', background: C.border, borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: C.textMid }}>{grouped[status]?.length}</span>
            </div>
            {grouped[status]?.map(r => (
              <div key={r.id} style={{ background: C.surface, borderRadius: 10, padding: 14, marginBottom: 10, border: `1.5px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.product}</div>
                    <Tag label={r.creative_type} meta={r.creative_type === 'Video' ? { bg: C.blueLight, text: C.blue } : { bg: C.purpleLight, text: C.purple }} />
                  </div>
                  <Avatar name={r.assigned_to} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <DriveLink href={r.drive_link} label="Drive" />
                  {r.landing_page_link && (
                    <a href={r.landing_page_link} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: C.green, textDecoration: 'none', fontWeight: 600, background: C.greenLight, padding: '3px 9px', borderRadius: 6 }}>
                      🌐 Landing
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn sm variant="ghost"   onClick={() => openEdit(r)}>Edit</Btn>
                  <Btn sm variant="danger"  onClick={() => del(r.id)}>Del</Btn>
                </div>
              </div>
            ))}
            {loading && grouped[status]?.length === 0 && <div style={{ textAlign: 'center', color: C.textLight, fontSize: 12 }}>Loading…</div>}
            {!loading && grouped[status]?.length === 0 && <div style={{ textAlign: 'center', color: C.textLight, fontSize: 12.5, padding: '20px 0' }}>Empty</div>}
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Creative' : 'New Creative'} onClose={() => setModal(false)}>
          {err && <ErrorBanner message={err} />}
          <FL label="Product">
            <Sel value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}>
              <option value="">Select product…</option>
              {productNames.map(p => <option key={p}>{p}</option>)}
            </Sel>
          </FL>
          <Row>
            <FL label="Creative Type" half><Sel value={form.creative_type} onChange={e => setForm({ ...form, creative_type: e.target.value })}>{CREATIVE_TYPES.map(t => <option key={t}>{t}</option>)}</Sel></FL>
            <FL label="Assigned To" half><Sel value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>{TEAM.map(m => <option key={m}>{m}</option>)}</Sel></FL>
          </Row>
          <FL label="Google Drive Link"><Inp value={form.drive_link} onChange={e => setForm({ ...form, drive_link: e.target.value })} placeholder="https://drive.google.com/…" /></FL>
          <FL label="Landing Page Link"><Inp value={form.landing_page_link} onChange={e => setForm({ ...form, landing_page_link: e.target.value })} placeholder="https://…" /></FL>
          <FL label="Status"><Sel value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{CREATIVE_STATUSES.map(s => <option key={s}>{s}</option>)}</Sel></FL>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
