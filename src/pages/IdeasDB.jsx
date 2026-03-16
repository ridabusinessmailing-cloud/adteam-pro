import { useState } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  C, Tag, Avatar, Card, Modal, FL, Inp, Sel, TA, Row, Btn,
  PageHeader, THead, TR, TD, FilterBar, FilterSel, DriveLink,
  EmptyRow, LoadingRow, ErrorBanner,
} from '../components/ui.jsx'

const TEAM = ['Rida', 'Oussama', 'Saida', 'Sana']
const IDEA_STATUSES = ['Idea', 'Approved', 'In production', 'Ready for ads', 'Tested', 'Winner']

const blank = (user) => ({ title: '', description: '', reference_link: '', product: '', added_by: user, status: 'Idea' })

export default function IdeasDB() {
  const { userName } = useAuth()
  const { rows, loading, error, insert, update, remove } = useRealtimeTable('creative_ideas', { orderBy: 'created_at', ascending: false })

  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [fStatus, setFStatus] = useState('')
  const [fMember, setFMember] = useState('')
  const [form, setForm]     = useState(blank(userName))
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  function openNew()  { setForm(blank(userName)); setEditing(null); setErr(''); setModal(true) }
  function openEdit(r) { setForm({ title: r.title, description: r.description || '', reference_link: r.reference_link || '', product: r.product || '', added_by: r.added_by, status: r.status }); setEditing(r.id); setErr(''); setModal(true) }

  async function save() {
    if (!form.title.trim()) return setErr('Title is required.')
    setSaving(true); setErr('')
    try {
      if (editing) await update(editing, form)
      else await insert(form)
      setModal(false)
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function del(id) {
    if (!confirm('Delete this idea?')) return
    try { await remove(id) } catch (e) { alert(e.message) }
  }

  const F = rows.filter(r => (!fStatus || r.status === fStatus) && (!fMember || r.added_by === fMember))

  return (
    <div>
      <PageHeader title="💡 Creative Ideas" subtitle="Build your library of winning ad concepts"
        action={<Btn onClick={openNew}>+ New Idea</Btn>} />
      {error && <ErrorBanner message={error} />}
      <FilterBar>
        <FilterSel value={fStatus} onChange={setFStatus} options={IDEA_STATUSES} placeholder="All statuses" />
        <FilterSel value={fMember} onChange={setFMember} options={TEAM} placeholder="All members" />
        <span style={{ fontSize: 12, color: C.textLight }}>{F.length} idea{F.length !== 1 ? 's' : ''}</span>
      </FilterBar>
      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <THead cols={['Title', 'Product', 'Added By', 'Status', 'Reference', '']} />
          <tbody>
            {loading && <LoadingRow cols={6} />}
            {!loading && F.map((r, i) => (
              <TR key={r.id} alt={i % 2}>
                <TD>
                  <div style={{ fontWeight: 700 }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 2 }}>{r.description?.slice(0, 70)}{r.description?.length > 70 ? '…' : ''}</div>
                </TD>
                <TD><span style={{ fontWeight: 600 }}>{r.product || '—'}</span></TD>
                <TD><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Avatar name={r.added_by} size={24} /><span style={{ fontSize: 12.5 }}>{r.added_by}</span></div></TD>
                <TD><Tag label={r.status} /></TD>
                <TD><DriveLink href={r.reference_link} label="Link" /></TD>
                <TD><div style={{ display: 'flex', gap: 6 }}><Btn sm variant="ghost" onClick={() => openEdit(r)}>Edit</Btn><Btn sm variant="danger" onClick={() => del(r.id)}>Del</Btn></div></TD>
              </TR>
            ))}
            {!loading && F.length === 0 && <EmptyRow cols={6} msg="No ideas yet. Add your first concept!" />}
          </tbody>
        </table>
      </Card>

      {modal && (
        <Modal title={editing ? 'Edit Idea' : 'New Creative Idea'} onClose={() => setModal(false)}>
          {err && <ErrorBanner message={err} />}
          <FL label="Idea Title"><Inp value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Before/After transformation" /></FL>
          <FL label="Description"><TA value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the concept..." /></FL>
          <Row>
            <FL label="Product" half><Inp value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="Product name" /></FL>
            <FL label="Added By" half><Sel value={form.added_by} onChange={e => setForm({ ...form, added_by: e.target.value })}>{TEAM.map(m => <option key={m}>{m}</option>)}</Sel></FL>
          </Row>
          <FL label="Reference Link"><Inp value={form.reference_link} onChange={e => setForm({ ...form, reference_link: e.target.value })} placeholder="https://tiktok.com/..." /></FL>
          <FL label="Status"><Sel value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{IDEA_STATUSES.map(s => <option key={s}>{s}</option>)}</Sel></FL>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Idea'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
