// Shared UI primitives — exact same styling as original app

export const C = {
  bg: '#F7F6F3', surface: '#FFFFFF', border: '#E8E5DF', borderLight: '#F0EDE8',
  text: '#1A1714', textMid: '#5C574F', textLight: '#9B9589',
  accent: '#D4521A', accentLight: '#FBF0EB', navy: '#1C2B4A',
  green: '#1E7B4B', greenLight: '#EBF7F1', yellow: '#B07D1A', yellowLight: '#FDF6E3',
  red: '#C0392B', redLight: '#FDECEA', purple: '#6B3FA0', purpleLight: '#F3EEF9',
  blue: '#1A5FB4', blueLight: '#EEF4FD',
}

export const STATUS_META = {
  'Idea':                   { bg: '#F0EDE8', text: '#9B9589' },
  'Approved':               { bg: C.greenLight, text: C.green },
  'In production':          { bg: C.blueLight, text: C.blue },
  'Ready for ads':          { bg: C.purpleLight, text: C.purple },
  'Tested':                 { bg: C.yellowLight, text: C.yellow },
  'Winner':                 { bg: '#FFF0E8', text: C.accent },
  'Pending':                { bg: '#F0EDE8', text: '#9B9589' },
  'Rejected':               { bg: C.redLight, text: C.red },
  'In creative production': { bg: C.blueLight, text: C.blue },
  'Testing':                { bg: C.yellowLight, text: C.yellow },
  'Scaling':                { bg: C.purpleLight, text: C.purple },
  'Killed':                 { bg: '#F0EDE8', text: '#9B9589' },
  'To do':                  { bg: '#F0EDE8', text: '#9B9589' },
  'In progress':            { bg: C.blueLight, text: C.blue },
  'Ready':                  { bg: C.greenLight, text: C.green },
  'Backlog':                { bg: '#F0EDE8', text: '#9B9589' },
  'Review':                 { bg: C.yellowLight, text: C.yellow },
  'Done':                   { bg: C.greenLight, text: C.green },
  'Requested':              { bg: C.blueLight, text: C.blue },
  'Received':               { bg: C.greenLight, text: C.green },
  'Sale':                   { bg: C.yellowLight, text: C.yellow },
  'Adjustment':             { bg: C.purpleLight, text: C.purple },
}

export const MEMBER_COLORS = {
  Rida:    { bg: '#FBF0EB', text: C.accent,  dot: C.accent },
  Oussama: { bg: C.blueLight,   text: C.blue,    dot: C.blue },
  Saida:   { bg: C.purpleLight, text: C.purple,  dot: C.purple },
  Sana:    { bg: C.greenLight,  text: C.green,   dot: C.green },
}

export const PRIORITY_META = {
  Low:    { color: C.textLight, bg: '#F0EDE8' },
  Medium: { color: C.blue,   bg: C.blueLight },
  High:   { color: C.yellow, bg: C.yellowLight },
  Urgent: { color: C.red,    bg: C.redLight },
}

const IS = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

export function Tag({ label, meta }) {
  const m = meta || STATUS_META[label] || { bg: '#F0EDE8', text: '#9B9589' }
  return (
    <span style={{ background: m.bg, color: m.text, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {label}
    </span>
  )
}

export function Avatar({ name, size = 28 }) {
  const mc = MEMBER_COLORS[name] || { bg: '#F0EDE8', text: '#9B9589', dot: '#9B9589' }
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: mc.bg, color: mc.text, fontSize: size * 0.38, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${mc.dot}33` }}>
      {name?.[0]?.toUpperCase()}
    </span>
  )
}

export function Card({ children, style }) {
  return <div style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${C.border}`, ...style }}>{children}</div>
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1A171488', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(2px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.surface, borderRadius: 18, width: '100%', maxWidth: wide ? 720 : 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px #1A171444' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1.5px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: C.surface, zIndex: 1, borderRadius: '18px 18px 0 0' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: C.borderLight, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: C.textMid }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

export function FL({ label, children, half }) {
  return (
    <div style={{ marginBottom: 14, ...(half ? { flex: 1 } : {}) }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
      {children}
    </div>
  )
}

export function Inp(props) { return <input style={IS} {...props} /> }
export function Sel({ children, ...p }) { return <select style={{ ...IS, cursor: 'pointer' }} {...p}>{children}</select> }
export function TA(props) { return <textarea style={{ ...IS, minHeight: 72, resize: 'vertical' }} {...props} /> }
export function Row({ children }) { return <div style={{ display: 'flex', gap: 12 }}>{children}</div> }

export function Btn({ onClick, children, variant = 'primary', sm, disabled, style: s, type = 'button' }) {
  const vs = {
    primary: { bg: C.text,    color: '#fff',    border: 'none' },
    ghost:   { bg: 'transparent', color: C.textMid, border: `1.5px solid ${C.border}` },
    danger:  { bg: C.redLight,  color: C.red,    border: `1.5px solid #F5C6C2` },
    success: { bg: C.greenLight, color: C.green, border: `1.5px solid #BBE8D0` },
    accent:  { bg: C.accent,   color: '#fff',    border: 'none' },
  }
  const v = vs[variant] || vs.primary
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      background: v.bg, color: v.color, border: v.border, borderRadius: 8,
      padding: sm ? '5px 12px' : '9px 18px', fontSize: sm ? 12 : 13.5,
      fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
      display: 'inline-flex', alignItems: 'center', gap: 5, ...s,
    }}>{children}</button>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>{title}</h2>
        {subtitle && <p style={{ margin: '3px 0 0', color: C.textLight, fontSize: 13 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function THead({ cols }) {
  return (
    <thead>
      <tr style={{ background: C.bg }}>
        {cols.map(c => <th key={c} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1.5px solid ${C.border}`, whiteSpace: 'nowrap' }}>{c}</th>)}
      </tr>
    </thead>
  )
}

export function TR({ children, alt }) {
  return <tr style={{ borderBottom: `1px solid ${C.borderLight}`, background: alt ? C.bg : C.surface }}>{children}</tr>
}

export function TD({ children, style: s }) {
  return <td style={{ padding: '13px 14px', fontSize: 13.5, color: C.text, verticalAlign: 'middle', ...s }}>{children}</td>
}

export function FilterBar({ children }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
}

export function FilterSel({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...IS, width: 'auto', fontSize: 12.5, padding: '7px 11px', fontWeight: 600 }}>
      <option value="">{placeholder || 'All'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function DriveLink({ href, label }) {
  if (!href) return <span style={{ color: C.textLight }}>—</span>
  return (
    <a href={href} target="_blank" rel="noreferrer"
      style={{ color: C.blue, fontSize: 12.5, textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, background: C.blueLight, padding: '3px 9px', borderRadius: 6 }}>
      📁 {label || 'Open'}
    </a>
  )
}

export function StatCard({ icon, label, value, color, sub }) {
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: color || C.text, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{sub}</div>}
    </Card>
  )
}

export function EmptyRow({ cols, msg }) {
  return <tr><td colSpan={cols} style={{ padding: '40px 20px', textAlign: 'center', color: C.textLight, fontSize: 14 }}>{msg || 'No data yet'}</td></tr>
}

export function LoadingRow({ cols }) {
  return <tr><td colSpan={cols} style={{ padding: '40px 20px', textAlign: 'center', color: C.textLight, fontSize: 14 }}>Loading…</td></tr>
}

export function ErrorBanner({ message }) {
  return (
    <div style={{ background: '#FDECEA', border: '1.5px solid #F5C6C2', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#C0392B', fontSize: 13 }}>
      ⚠️ {message}
    </div>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
      <div style={{ width: 32, height: 32, border: `3px solid #E8E5DF`, borderTopColor: '#D4521A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
