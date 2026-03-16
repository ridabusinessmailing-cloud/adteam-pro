import { C, Card, StatCard, Tag, Avatar, PRIORITY_META } from '../components/ui.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'

const LOW_STOCK_THRESHOLD = 50
const ADMINS = ['Rida', 'Oussama']
const today = new Date().toISOString().slice(0, 10)

export default function Dashboard() {
  const { userName, isAdmin } = useAuth()
  const { rows: ideas }     = useRealtimeTable('creative_ideas')
  const { rows: products }  = useRealtimeTable('products')
  const { rows: creatives } = useRealtimeTable('creatives')
  const { rows: adTests }   = useRealtimeTable('ads_tests', { orderBy: 'created_at', ascending: false })
  const { rows: inventory } = useRealtimeTable('inventory')
  const { rows: tasks }     = useRealtimeTable('tasks')

  const myTasks   = tasks.filter(t => t.assigned_to === userName && t.column_name !== 'Done')
  const lowStock  = inventory.filter(i => i.available_stock < (i.low_stock_threshold || LOW_STOCK_THRESHOLD))
  const pendingP  = products.filter(p => p.validation_status === 'Pending')
  const dueTodayTasks = tasks.filter(t => t.deadline === today && !t.completed)

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>
          Good day, <span style={{ color: C.accent }}>{userName}</span> 👋
        </h2>
        <p style={{ margin: '4px 0 0', color: C.textLight, fontSize: 14 }}>Here's your team overview.</p>
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: C.redLight, border: `1.5px solid #F5C6C2`, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <span style={{ fontWeight: 700, color: C.red, fontSize: 14 }}>Low stock: </span>
            <span style={{ color: C.red, fontSize: 13 }}>{lowStock.map(i => `${i.product} (${i.available_stock} left)`).join(' · ')}</span>
          </div>
        </div>
      )}

      {isAdmin && pendingP.length > 0 && (
        <div style={{ background: C.yellowLight, border: `1.5px solid #E8D08A`, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <span style={{ fontWeight: 700, color: C.yellow, fontSize: 13 }}>
            {pendingP.length} product{pendingP.length > 1 ? 's' : ''} awaiting approval: {pendingP.map(p => p.name).join(', ')}
          </span>
        </div>
      )}

      {dueTodayTasks.length > 0 && (
        <div style={{ background: C.blueLight, border: `1.5px solid #9EC5F5`, borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📅</span>
          <span style={{ fontWeight: 700, color: C.blue, fontSize: 13 }}>
            {dueTodayTasks.length} task{dueTodayTasks.length > 1 ? 's' : ''} due today
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard icon="🏆" label="Winner Creatives"   value={ideas.filter(i => i.status === 'Winner').length}  color={C.accent} />
        <StatCard icon="📈" label="Scaling Products"   value={products.filter(p => p.validation_status === 'Scaling').length} color={C.green} />
        <StatCard icon="🎬" label="Ready Creatives"    value={creatives.filter(c => c.status === 'Ready').length} color={C.blue} />
        <StatCard icon="📦" label="Products"           value={inventory.length} color={C.purple} sub={lowStock.length > 0 ? `${lowStock.length} low stock` : 'All stocked'} />
        <StatCard icon="✅" label="My Open Tasks"      value={myTasks.length} color={C.yellow} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: C.text }}>My Tasks</h3>
          {myTasks.length === 0
            ? <p style={{ color: C.textLight, fontSize: 13 }}>All clear! No open tasks 🎉</p>
            : myTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_META[t.priority]?.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>{t.deadline}</div>
                </div>
                <Tag label={t.column_name} />
              </div>
            ))
          }
        </Card>

        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: C.text }}>Recent Ad Tests</h3>
          {adTests.slice(0, 5).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.product}</div>
                <div style={{ fontSize: 11, color: C.textLight }}>{t.platform} · CPL: ${t.cpl}</div>
              </div>
              <Tag label={t.result} />
            </div>
          ))}
          {adTests.length === 0 && <p style={{ color: C.textLight, fontSize: 13 }}>No ad tests yet.</p>}
        </Card>

        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: C.text }}>Inventory Snapshot</h3>
          {inventory.map(inv => {
            const isLow = inv.available_stock < (inv.low_stock_threshold || LOW_STOCK_THRESHOLD)
            const total = inv.available_stock + inv.total_sold
            const pct = total > 0 ? Math.min(100, (inv.available_stock / total) * 100) : 0
            return (
              <div key={inv.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{inv.product}</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: isLow ? C.red : C.green }}>{inv.available_stock} units</span>
                </div>
                <div style={{ marginTop: 6, height: 5, background: C.borderLight, borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isLow ? C.red : C.green, borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
          {inventory.length === 0 && <p style={{ color: C.textLight, fontSize: 13 }}>No inventory items.</p>}
        </Card>

        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: C.text }}>Team Activity</h3>
          {['Rida','Oussama','Saida','Sana'].map(m => {
            const open = tasks.filter(t => t.assigned_to === m && t.column_name !== 'Done').length
            const done = tasks.filter(t => t.assigned_to === m && t.column_name === 'Done').length
            return (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                <Avatar name={m} size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m}</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>{open} open · {done} done</div>
                </div>
                {ADMINS.includes(m) && <Tag label="Admin" meta={{ bg: '#FFF0E8', text: C.accent }} />}
              </div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}
