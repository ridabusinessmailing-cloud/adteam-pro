import { useState } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { C, Card, Tag, Avatar, PageHeader, FilterSel, PRIORITY_META } from '../components/ui.jsx'

const TEAM = ['Rida', 'Oussama', 'Saida', 'Sana']
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

export default function CalendarView() {
  const { userName } = useAuth()
  const { rows: tasks } = useRealtimeTable('tasks')

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [fMember, setFM]  = useState(userName)
  const [selected, setSel] = useState(null)

  const firstDay     = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const monthName    = new Date(year, month).toLocaleString('default', { month: 'long' })
  const todayDay     = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : null

  const events = []
  tasks.filter(t => t.deadline && (fMember === 'All' || t.assigned_to === fMember)).forEach(t => {
    const d = new Date(t.deadline + 'T00:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      events.push({ day: d.getDate(), label: t.title, color: PRIORITY_META[t.priority]?.color || C.textLight, person: t.assigned_to, detail: t })
    }
  })

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedEvents = selected ? events.filter(e => e.day === selected) : []

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setMonth(0);  setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <div>
      <PageHeader title="📅 Calendar" subtitle="Deadlines, schedules and launch dates"
        action={<FilterSel value={fMember} onChange={setFM} options={['All', ...TEAM]} placeholder="All members" />} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prev} style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>‹</button>
        <span style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{monthName} {year}</span>
        <button onClick={next} style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>›</button>
      </div>

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `1.5px solid ${C.border}` }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ padding: 10, textAlign: 'center', fontSize: 11, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {cells.map((day, i) => {
            const dayEvents = day ? events.filter(e => e.day === day) : []
            const isToday   = day === todayDay
            const isSel     = day === selected
            return (
              <div key={i} onClick={() => day && setSel(isSel ? null : day)}
                style={{ minHeight: 86, padding: '8px 6px', borderRight: (i+1)%7 !== 0 ? `1px solid ${C.borderLight}` : 'none', borderBottom: `1px solid ${C.borderLight}`, background: isSel ? C.accentLight : isToday ? C.yellowLight : C.surface, cursor: day ? 'pointer' : 'default' }}>
                {day && (
                  <>
                    <div style={{ fontWeight: isToday ? 900 : 500, fontSize: 13, color: isToday ? C.accent : C.textMid, marginBottom: 4 }}>{day}</div>
                    {dayEvents.slice(0,3).map((e, j) => (
                      <div key={j} style={{ background: e.color+'22', borderLeft: `3px solid ${e.color}`, borderRadius: '0 5px 5px 0', padding: '2px 5px', fontSize: 10.5, color: e.color, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</div>
                    ))}
                    {dayEvents.length > 3 && <div style={{ fontSize: 10, color: C.textLight }}>+{dayEvents.length-3} more</div>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {selected && selectedEvents.length > 0 && (
        <Card style={{ marginTop: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>{monthName} {selected} — {selectedEvents.length} event{selectedEvents.length > 1 ? 's' : ''}</h3>
          {selectedEvents.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.borderLight}` }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{e.label}</div>
                <div style={{ fontSize: 11.5, color: C.textLight }}>{e.detail?.description?.slice(0, 60)}</div>
              </div>
              <Avatar name={e.person} size={26} />
              <Tag label={e.detail?.priority} meta={PRIORITY_META[e.detail?.priority]} />
            </div>
          ))}
        </Card>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        {PRIORITIES.map(p => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMid }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: PRIORITY_META[p].color }} />
            {p}
          </div>
        ))}
      </div>
    </div>
  )
}
