import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

const C = {
  bg: '#F7F6F3', surface: '#FFFFFF', border: '#E8E5DF',
  text: '#1A1714', textMid: '#5C574F', textLight: '#9B9589',
  accent: '#D4521A', navy: '#1C2B4A', red: '#C0392B', redLight: '#FDECEA',
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email.trim(), password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Sora', system-ui, sans-serif", padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16, background: C.navy,
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 26 }}>🚀</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>
            AdTeam <span style={{ color: C.accent }}>Pro</span>
          </h1>
          <p style={{ margin: '6px 0 0', color: C.textLight, fontSize: 14 }}>
            Internal platform — sign in to continue
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: C.surface, borderRadius: 18, border: `1.5px solid ${C.border}`,
          padding: 32, boxShadow: '0 4px 24px #1A171408',
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="you@company.com"
                style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, background: C.bg, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••"
                style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, background: C.bg, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ background: C.redLight, border: `1.5px solid #F5C6C2`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: C.red }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none',
              background: loading ? '#aaa' : C.navy, color: '#fff',
              fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', letterSpacing: '-0.01em',
            }}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
            <p style={{ margin: 0, fontSize: 12, color: C.textLight, textAlign: 'center' }}>
              Contact your admin to reset your password.
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: C.textLight }}>
          AdTeam Pro © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
