import { useState } from 'react'
import { useInventory } from '../hooks/useInventory.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  C, Tag, Avatar, Card, Modal, FL, Inp, Sel, Row, TA, Btn,
  PageHeader, THead, TR, TD, StatCard, EmptyRow, LoadingRow, ErrorBanner,
} from '../components/ui.jsx'

const LOW = 50
const MOVEMENT_TYPES = ['Requested', 'Received', 'Sale', 'Adjustment']

const blankInv = () => ({ product: '', sku: '', available_stock: 0, requested_stock: 0, incoming_stock: 0, total_sold: 0, low_stock_threshold: 50, notes: '', last_update: new Date().toISOString().slice(0, 10) })

export default function InventoryPage() {
  const { userName, isAdmin } = useAuth()
  const { inventory, history, recordMovement } = useInventory()

  const [modal, setModal]     = useState(false)
  const [mvModal, setMvModal] = useState(false)
  const [histModal, setHistModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm]       = useState(blankInv())
  const [mvForm, setMvForm]   = useState({ movementType: 'Received', quantity: '', notes: '' })
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  function openNew()   { setForm(blankInv()); setEditing(null); setErr(''); setModal(true) }
  function openEdit(r) {
    setForm({ product: r.product, sku: r.sku || '', available_stock: r.available_stock, requested_stock: r.requested_stock, incoming_stock: r.incoming_stock, total_sold: r.total_sold, low_stock_threshold: r.low_stock_threshold || 50, notes: r.notes || '', last_update: r.last_update || new Date().toISOString().slice(0, 10) })
    setEditing(r.id); setErr(''); setModal(true)
  }

  async function saveInv() {
    if (!form.product.trim()) return setErr('Product name is required.')
    setSaving(true); setErr('')
    try {
      const data = { ...form, available_stock: +form.available_stock || 0, requested_stock: +form.requested_stock || 0, incoming_stock: +form.incoming_stock || 0, total_sold: +form.total_sold || 0, low_stock_threshold: +form.low_stock_threshold || 50 }
      if (editing) await inventory.update(editing, data)
      else await inventory.insert(data)
      setModal(false)
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function saveMv() {
    if (!mvForm.quantity) return setErr('Enter a quantity.')
    setSaving(true); setErr('')
    try {
      await recordMovement(selected, mvForm.movementType, mvForm.quantity, mvForm.notes)
      setMvModal(false)
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function del(id) {
    if (!isAdmin) return alert('Only admins can remove inventory items.')
    if (!confirm('Remove from inventory?')) return
    try { await inventory.remove(id) } catch (e) { alert(e.message) }
  }

  const rows = inventory.rows
  const totalStock = rows.reduce((s, r) => s + r.available_stock, 0)
  const totalSold  = rows.reduce((s, r) => s + r.total_sold, 0)
  const lowCount   = rows.filter(r => r.available_stock < (r.low_stock_threshold || LOW)).length

  return (
    <div>
      <PageHeader title="📦 Inventory & Stock" subtitle="Track stock levels, movements and history"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={() => setHistModal(true)}>📋 Stock History</Btn>
            {isAdmin && <Btn onClick={openNew}>+ Add Product</Btn>}
          </div>
        }
      />
      {inventory.error && <ErrorBanner message={inventory.error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard icon="📦" label="Total Available" value={totalStock} color={C.blue} />
        <StatCard icon="🛒" label="Total Sold"      value={totalSold}  color={C.green} />
        <StatCard icon="⚠️" label="Low Stock Items" value={lowCount}   color={lowCount > 0 ? C.red : C.green} sub={lowCount > 0 ? 'Needs reorder' : 'All good'} />
      </div>

      {inventory.loading && <p style={{ color: C.textLight, textAlign: 'center', padding: 40 }}>Loading inventory…</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, marginBottom: 24 }}>
        {rows.map(inv => {
          const isLow = inv.available_stock < (inv.low_stock_threshold || LOW)
          const total = inv.available_stock + inv.total_sold
          const pct   = total > 0 ? Math.min(100, (inv.available_stock / total) * 100) : 0
          return (
            <Card key={inv.id} style={{ padding: 20, border: isLow ? `2px solid ${C.red}55` : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{inv.product}</div>
                  <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>SKU: {inv.sku || '—'}</div>
                </div>
                {isLow && <Tag label="Low Stock" meta={{ bg: C.redLight, text: C.red }} />}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Available', value: inv.available_stock, color: isLow ? C.red : C.green },
                  { label: 'Incoming',  value: inv.incoming_stock,  color: C.blue },
                  { label: 'Requested', value: inv.requested_stock, color: C.yellow },
                  { label: 'Total Sold',value: inv.total_sold,      color: C.textMid },
                ].map(s => (
                  <div key={s.label} style={{ background: C.bg, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.textLight }}>Stock level</span>
                  <span style={{ fontSize: 11, color: C.textLight }}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, background: C.borderLight, borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isLow ? C.red : pct > 50 ? C.green : C.yellow, borderRadius: 3 }} />
                </div>
              </div>
              {inv.notes && <div style={{ fontSize: 12, color: C.textMid, marginBottom: 10, fontStyle: 'italic' }}>{inv.notes}</div>}
              <div style={{ fontSize: 11, color: C.textLight, marginBottom: 12 }}>Last update: {inv.last_update}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn sm variant="accent" onClick={() => { setSelected(inv); setMvForm({ movementType: 'Received', quantity: '', notes: '' }); setErr(''); setMvModal(true) }}>+ Movement</Btn>
                {isAdmin && <Btn sm variant="ghost" onClick={() => openEdit(inv)}>Edit</Btn>}
                {isAdmin && <Btn sm variant="danger" onClick={() => del(inv.id)}>Del</Btn>}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Add/Edit Inventory Modal */}
      {modal && (
        <Modal title={editing ? 'Edit Inventory Item' : 'Add to Inventory'} onClose={() => setModal(false)}>
          {err && <ErrorBanner message={err} />}
          <Row>
            <FL label="Product Name" half><Inp value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="Product name" /></FL>
            <FL label="SKU" half><Inp value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="e.g. SSP-001" /></FL>
          </Row>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <FL label="Available"><Inp type="number" value={form.available_stock} onChange={e => setForm({ ...form, available_stock: e.target.value })} /></FL>
            <FL label="Requested"><Inp type="number" value={form.requested_stock} onChange={e => setForm({ ...form, requested_stock: e.target.value })} /></FL>
            <FL label="Incoming"><Inp type="number" value={form.incoming_stock} onChange={e => setForm({ ...form, incoming_stock: e.target.value })} /></FL>
            <FL label="Total Sold"><Inp type="number" value={form.total_sold} onChange={e => setForm({ ...form, total_sold: e.target.value })} /></FL>
          </div>
          <Row>
            <FL label="Low Stock Alert" half><Inp type="number" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} /></FL>
            <FL label="Last Update" half><Inp type="date" value={form.last_update} onChange={e => setForm({ ...form, last_update: e.target.value })} /></FL>
          </Row>
          <FL label="Notes"><TA value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes…" /></FL>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={saveInv} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </Modal>
      )}

      {/* Movement Modal */}
      {mvModal && selected && (
        <Modal title={`Stock Movement — ${selected.product}`} onClose={() => setMvModal(false)}>
          {err && <ErrorBanner message={err} />}
          <div style={{ background: C.bg, borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: C.textLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Current Stock</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <span style={{ fontWeight: 700, color: C.green }}>Available: {selected.available_stock}</span>
              <span style={{ fontWeight: 700, color: C.blue }}>Incoming: {selected.incoming_stock}</span>
              <span style={{ fontWeight: 700, color: C.textMid }}>Sold: {selected.total_sold}</span>
            </div>
          </div>
          <FL label="Movement Type">
            <Sel value={mvForm.movementType} onChange={e => setMvForm({ ...mvForm, movementType: e.target.value })}>
              {MOVEMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </Sel>
          </FL>
          <div style={{ background: C.yellowLight, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: C.yellow }}>
            {mvForm.movementType === 'Requested' && '📋 Increases Requested Stock — stock ordered from supplier.'}
            {mvForm.movementType === 'Received'  && '📥 Moves Incoming → Available. Decreases Incoming.'}
            {mvForm.movementType === 'Sale'       && '🛒 Decreases Available, increases Total Sold.'}
            {mvForm.movementType === 'Adjustment' && '🔧 Manual adjustment to Available Stock.'}
          </div>
          <FL label="Quantity"><Inp type="number" value={mvForm.quantity} onChange={e => setMvForm({ ...mvForm, quantity: e.target.value })} placeholder="Number of units" /></FL>
          <FL label="Notes (optional)"><TA value={mvForm.notes} onChange={e => setMvForm({ ...mvForm, notes: e.target.value })} placeholder="PO number, reference…" /></FL>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setMvModal(false)}>Cancel</Btn>
            <Btn onClick={saveMv} disabled={saving}>{saving ? 'Recording…' : 'Record Movement'}</Btn>
          </div>
        </Modal>
      )}

      {/* Stock History Modal */}
      {histModal && (
        <Modal title="📋 Stock History (append-only)" onClose={() => setHistModal(false)} wide>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <THead cols={['Date', 'Product', 'Change', 'Type', 'By', 'Notes']} />
              <tbody>
                {history.loading && <LoadingRow cols={6} />}
                {!history.loading && history.rows.map((r, i) => (
                  <TR key={r.id} alt={i % 2}>
                    <TD>{r.date}</TD>
                    <TD><span style={{ fontWeight: 600 }}>{r.product}</span></TD>
                    <TD><span style={{ fontWeight: 800, color: r.quantity_change > 0 ? C.green : C.red }}>{r.quantity_change > 0 ? '+' : ''}{r.quantity_change}</span></TD>
                    <TD><Tag label={r.movement_type} /></TD>
                    <TD><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar name={r.updated_by} size={22} /><span style={{ fontSize: 12 }}>{r.updated_by}</span></div></TD>
                    <TD><span style={{ color: C.textLight, fontSize: 12 }}>{r.notes || '—'}</span></TD>
                  </TR>
                ))}
                {!history.loading && history.rows.length === 0 && <EmptyRow cols={6} msg="No movements recorded yet." />}
              </tbody>
            </table>
          </Card>
        </Modal>
      )}
    </div>
  )
}
