import { useState } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  C, Tag, Card, Modal, FL, Inp, Sel, Row, Btn,
  PageHeader, THead, TR, TD, FilterBar, FilterSel, StatCard,
  EmptyRow, LoadingRow, ErrorBanner,
} from '../components/ui.jsx'

const PLATFORMS  = ['Facebook', 'TikTok', 'Snapchat', 'YouTube']
const AD_RESULTS = ['Testing', 'Scaling', 'Winner', 'Killed']

const blank = () => ({ product: '', creative: '', platform: 'Facebook', test_budget: '', spend: '', leads: '', cpl: '', result: 'Testing' })

export default function AdsTracker() {
  const { isAdmin } = useAuth()
  const { rows, loading, error, insert, update, remove } = useRealtimeTable('ads_tests', { orderBy: 'created_at', ascending: false })

  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [fPlatform, setFP]    = useState('')
  const [fResult,   setFR]    = useState('')
  const [form, setForm]       = useState(blank())
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  function openNew()   { setForm(blank()); setEditing(null); setErr(''); setModal(true) }
  function openEdit(r) { setForm({ product: r.product, creative: r.creative || '', platform: r.platform, test_budget: r.test_budget, spend: r.spend, leads: r.leads, cpl: r.cpl, result: r.result }); setEditing(r.id); setErr(''); setModal(true) }

  async function save() {
    if (!form.product.trim()) return setErr('Product is required.')
    setSaving(true); setErr('')
    try {
      const entry = { ...form, test_budget: +form.test_budget || 0, spend: +form.spend || 0, leads: +form.leads || 0, cpl: +form.cpl || 0 }
      if (editing) await update(editing, entry)
      else await insert(entry)
      setModal(false)
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function del(id) {
    if (!isAdmin) return alert('Only admins can delete test records.')
    if (!confirm('Delete?')) return
    try { await remove(id) } catch (e) { alert(e.message) }
  }

  const F = rows.filter(r => (!fPlatform || r.platform === fPlatform) && (!fResult || r.result === fResult))
  const totalSpend = F.reduce((s, r) => s + (+r.spend || 0), 0)
  const totalLeads = F.reduce((s, r) => s + (+r.leads || 0), 0)
  const avgCPL     = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '—'

  return (
    <div>
      <PageHeader title="📊 Ads Testing Tracker" subtitle="Monitor ad performance across all platforms"
        action={<Btn onClick={openNew}>+ New Test</Btn>} />
      {error && <ErrorBanner message={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard icon="💸" label="Total Spend"  value={`$${totalSpend.toFixed(0)}`} color={C.blue} />
        <StatCard icon="👤" label="Total Leads"  value={totalLeads} color={C.green} />
        <StatCard icon="📉" label="Avg CPL"      value={`$${avgCPL}`} color={C.yellow} />
      </div>

      <FilterBar>
        <FilterSel value={fPlatform} onChange={setFP} options={PLATFORMS}  placeholder="All platforms" />
        <FilterSel value={fResult}   onChange={setFR} options={AD_RESULTS} placeholder="All results" />
        <span style={{ fontSize: 12, color: C.textLight }}>{F.length} tests</span>
      </FilterBar>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <THead cols={['Product', 'Creative', 'Platform', 'Budget', 'Spend', 'Leads', 'CPL', 'Result', '']} />
          <tbody>
            {loading && <LoadingRow cols={9} />}
            {!loading && F.map((r, i) => (
              <TR key={r.id} alt={i % 2}>
                <TD><span style={{ fontWeight: 700 }}>{r.product}</span></TD>
                <TD><span style={{ color: C.textMid, fontSize: 12.5 }}>{r.creative}</span></TD>
                <TD><Tag label={r.platform} meta={{ bg: '#F0EDE8', text: C.textMid }} /></TD>
                <TD>${r.test_budget}</TD>
                <TD>${r.spend}</TD>
                <TD style={{ fontWeight: 700 }}>{r.leads}</TD>
                <TD style={{ fontWeight: 800, color: +r.cpl < 5 ? C.green : +r.cpl < 10 ? C.yellow : C.red }}>${r.cpl}</TD>
                <TD><Tag label={r.result} /></TD>
                <TD><div style={{ display: 'flex', gap: 6 }}><Btn sm variant="ghost" onClick={() => openEdit(r)}>Edit</Btn>{isAdmin && <Btn sm variant="danger" onClick={() => del(r.id)}>Del</Btn>}</div></TD>
              </TR>
            ))}
            {!loading && F.length === 0 && <EmptyRow cols={9} msg="No ad tests yet." />}
          </tbody>
        </table>
      </Card>

      {modal && (
        <Modal title={editing ? 'Edit Test' : 'New Ad Test'} onClose={() => setModal(false)}>
          {err && <ErrorBanner message={err} />}
          <Row>
            <FL label="Product" half><Inp value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="Product name" /></FL>
            <FL label="Platform" half><Sel value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</Sel></FL>
          </Row>
          <FL label="Creative Name"><Inp value={form.creative} onChange={e => setForm({ ...form, creative: e.target.value })} placeholder="Creative description" /></FL>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <FL label="Budget ($)"><Inp type="number" value={form.test_budget} onChange={e => setForm({ ...form, test_budget: e.target.value })} /></FL>
            <FL label="Spend ($)"><Inp type="number" value={form.spend} onChange={e => setForm({ ...form, spend: e.target.value })} /></FL>
            <FL label="Leads"><Inp type="number" value={form.leads} onChange={e => setForm({ ...form, leads: e.target.value })} /></FL>
            <FL label="CPL ($)"><Inp type="number" value={form.cpl} onChange={e => setForm({ ...form, cpl: e.target.value })} /></FL>
          </div>
          <FL label="Result"><Sel value={form.result} onChange={e => setForm({ ...form, result: e.target.value })}>{AD_RESULTS.map(r => <option key={r}>{r}</option>)}</Sel></FL>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
