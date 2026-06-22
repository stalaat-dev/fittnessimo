import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>fittnessimo<span style={{ color: '#c8f04a' }}>.</span></div>
        <p style={styles.sub}>Your coaching platform</p>

        {sent ? (
          <div style={styles.sentBox}>
            <div style={styles.sentIcon}>✉️</div>
            <p style={styles.sentTitle}>Check your email</p>
            <p style={styles.sentSub}>We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={styles.input}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111111',
    padding: '1rem',
  },
  card: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 400,
    textAlign: 'center',
  },
  logo: {
    fontWeight: 800,
    fontSize: 28,
    letterSpacing: '-1px',
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: '#888580',
    marginBottom: '2rem',
  },
  form: { textAlign: 'left' },
  label: { fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: '#555250' },
  input: { marginBottom: 14 },
  btn: {
    width: '100%',
    padding: '12px',
    background: '#111111',
    color: '#c8f04a',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: '-0.2px',
    cursor: 'pointer',
    border: 'none',
    marginTop: 4,
  },
  error: { color: '#d94f4f', fontSize: 13, marginBottom: 10 },
  sentBox: { padding: '1rem 0' },
  sentIcon: { fontSize: 36, marginBottom: 12 },
  sentTitle: { fontWeight: 600, fontSize: 18, marginBottom: 8 },
  sentSub: { fontSize: 14, color: '#888580', lineHeight: 1.6 },
}
