import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TABS = ['Clients', 'Build workout', 'Feedback']

export default function CoachDashboard({ session }) {
  const [tab, setTab] = useState('Clients')
  const [clients, setClients] = useState([])
  const [sessions, setSessions] = useState([])
  const [feedback, setFeedback] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Workout builder state
  const [wTitle, setWTitle] = useState('')
  const [wNote, setWNote] = useState('')
  const [wClient, setWClient] = useState('')
  const [exercises, setExercises] = useState([{ name: '', sets: '', reps: '', load: '' }])
  const [links, setLinks] = useState([{ label: '', url: '' }])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    const { data: c } = await supabase.from('clients').select('*').order('created_at')
    setClients(c || [])
    const { data: s } = await supabase.from('workout_sessions').select('*').order('created_at', { ascending: false })
    setSessions(s || [])
    const { data: f } = await supabase.from('feedback').select('*, workout_sessions(title, clients(name))').order('created_at', { ascending: false })
    setFeedback(f || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function addClient() {
    if (!newClientEmail || !newClientName) return
    setAddingClient(true)
    const { error } = await supabase.from('clients').insert({ email: newClientEmail, name: newClientName })
    if (!error) { showToast('Client added!'); setNewClientEmail(''); setNewClientName(''); load() }
    setAddingClient(false)
  }

  async function saveWorkout() {
    if (!wTitle || !wClient) return
    setSaving(true)
    const { data: ws, error } = await supabase.from('workout_sessions').insert({
      client_id: wClient,
      title: wTitle,
      coach_note: wNote,
      exercises: exercises.filter(e => e.name),
      links: links.filter(l => l.url),
    }).select().single()
    if (!error) {
      showToast('Workout assigned!')
      setWTitle(''); setWNote(''); setWClient('')
      setExercises([{ name: '', sets: '', reps: '', load: '' }])
      setLinks([{ label: '', url: '' }])
      load()
    }
    setSaving(false)
  }

  async function signOut() { await supabase.auth.signOut() }

  const unreadFeedback = feedback.filter(f => !f.coach_read).length

  return (
    <div style={s.shell}>
      {toast && <div style={s.toast}>{toast}</div>}
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.logo}>fittnessimo<span style={{ color: '#c8f04a' }}>.</span></div>
        <div style={s.navLabel}>Menu</div>
        {TABS.map(t => (
          <button key={t} style={{ ...s.navBtn, ...(tab === t ? s.navActive : {}) }} onClick={() => setTab(t)}>
            {t === 'Clients' && '👥'}
            {t === 'Build workout' && '🏋️'}
            {t === 'Feedback' && '💬'}
            <span style={{ marginLeft: 8 }}>{t}</span>
            {t === 'Feedback' && unreadFeedback > 0 && <span style={s.badge}>{unreadFeedback}</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={s.signOutBtn} onClick={signOut}>Sign out</button>
      </div>

      {/* Main */}
      <div style={s.main}>

        {/* CLIENTS TAB */}
        {tab === 'Clients' && (
          <div>
            <h1 style={s.h1}>Clients</h1>
            <div style={s.grid2}>
              <div>
                {clients.length === 0 && <p style={s.empty}>No clients yet. Add one →</p>}
                {clients.map(c => {
                  const clientSessions = sessions.filter(ws => ws.client_id === c.id)
                  return (
                    <div key={c.id} style={s.clientCard}>
                      <div style={s.avatar}>{c.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={s.clientName}>{c.name}</div>
                        <div style={s.clientSub}>{c.email} · {clientSessions.length} session{clientSessions.length !== 1 ? 's' : ''}</div>
                      </div>
                      <button style={s.btnSm} onClick={() => { setSelectedClient(selectedClient?.id === c.id ? null : c) }}>
                        {selectedClient?.id === c.id ? 'Close' : 'Sessions'}
                      </button>
                    </div>
                  )
                })}

                {selectedClient && (
                  <div style={s.sessionList}>
                    <div style={s.sectionLabel}>{selectedClient.name}'s sessions</div>
                    {sessions.filter(ws => ws.client_id === selectedClient.id).length === 0
                      ? <p style={s.empty}>No sessions assigned yet.</p>
                      : sessions.filter(ws => ws.client_id === selectedClient.id).map(ws => {
                        const fb = feedback.find(f => f.session_id === ws.id)
                        return (
                          <div key={ws.id} style={s.sessionRow}>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 14 }}>{ws.title}</div>
                              <div style={s.clientSub}>{new Date(ws.created_at).toLocaleDateString()}</div>
                            </div>
                            {fb
                              ? <span style={s.tagGreen}>Logged ✓</span>
                              : <span style={s.tagAmber}>Pending</span>}
                          </div>
                        )
                      })
                    }
                  </div>
                )}
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>Add new client</div>
                <label style={s.label}>Name</label>
                <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Sara Rodriguez" style={s.inputSm} />
                <label style={s.label}>Email</label>
                <input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="sara@email.com" style={s.inputSm} />
                <button style={s.btnPrimary} onClick={addClient} disabled={addingClient}>
                  {addingClient ? 'Adding…' : 'Add client →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BUILD WORKOUT TAB */}
        {tab === 'Build workout' && (
          <div style={{ maxWidth: 680 }}>
            <h1 style={s.h1}>Build workout</h1>
            <div style={s.card}>
              <div style={s.sectionLabel}>Session details</div>
              <label style={s.label}>Assign to</label>
              <select value={wClient} onChange={e => setWClient(e.target.value)} style={s.inputSm}>
                <option value="">Choose a client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label style={s.label}>Session title</label>
              <input value={wTitle} onChange={e => setWTitle(e.target.value)} placeholder="e.g. Lower body A" style={s.inputSm} />
              <label style={s.label}>Coach note</label>
              <textarea value={wNote} onChange={e => setWNote(e.target.value)} placeholder="Cue or message for the client…" rows={2} style={{ ...s.inputSm, resize: 'none' }} />

              <div style={s.divider} />
              <div style={s.sectionLabel}>Exercises</div>
              <div style={s.exHead}>
                <span style={s.exLabel}>Exercise</span>
                <span style={s.exLabel}>Sets</span>
                <span style={s.exLabel}>Reps</span>
                <span style={s.exLabel}>Load</span>
                <span />
              </div>
              {exercises.map((ex, i) => (
                <div key={i} style={s.exRow}>
                  <input value={ex.name} onChange={e => { const n=[...exercises]; n[i].name=e.target.value; setExercises(n) }} placeholder="Exercise" style={s.exInput} />
                  <input value={ex.sets} onChange={e => { const n=[...exercises]; n[i].sets=e.target.value; setExercises(n) }} placeholder="3" style={{ ...s.exInput, textAlign: 'center' }} />
                  <input value={ex.reps} onChange={e => { const n=[...exercises]; n[i].reps=e.target.value; setExercises(n) }} placeholder="10" style={{ ...s.exInput, textAlign: 'center' }} />
                  <input value={ex.load} onChange={e => { const n=[...exercises]; n[i].load=e.target.value; setExercises(n) }} placeholder="kg" style={{ ...s.exInput, textAlign: 'center' }} />
                  <button style={s.btnIcon} onClick={() => setExercises(exercises.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button style={s.btnSm} onClick={() => setExercises([...exercises, { name: '', sets: '', reps: '', load: '' }])}>+ Add exercise</button>

              <div style={s.divider} />
              <div style={s.sectionLabel}>Video / instructional links</div>
              {links.map((lk, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <input value={lk.label} onChange={e => { const n=[...links]; n[i].label=e.target.value; setLinks(n) }} placeholder="Label (e.g. RDL tutorial)" style={s.exInput} />
                  <input value={lk.url} onChange={e => { const n=[...links]; n[i].url=e.target.value; setLinks(n) }} placeholder="https://youtube.com/…" style={s.exInput} />
                  <button style={s.btnIcon} onClick={() => setLinks(links.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button style={s.btnSm} onClick={() => setLinks([...links, { label: '', url: '' }])}>+ Add link</button>

              <div style={s.divider} />
              <button style={s.btnPrimary} onClick={saveWorkout} disabled={saving || !wTitle || !wClient}>
                {saving ? 'Assigning…' : 'Assign to client →'}
              </button>
            </div>
          </div>
        )}

        {/* FEEDBACK TAB */}
        {tab === 'Feedback' && (
          <div>
            <h1 style={s.h1}>Client feedback</h1>
            {feedback.length === 0 && <p style={s.empty}>No feedback yet — clients will appear here after they log a session.</p>}
            {feedback.map(f => (
              <FeedbackCard key={f.id} f={f} onRead={async () => {
                await supabase.from('feedback').update({ coach_read: true }).eq('id', f.id)
                load()
              }} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

function FeedbackCard({ f, onRead }) {
  return (
    <div style={{ ...s.card, marginBottom: 12, borderLeft: !f.coach_read ? '3px solid #c8f04a' : '3px solid transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{f.workout_sessions?.clients?.name || 'Client'}</div>
          <div style={{ fontSize: 13, color: '#888580' }}>{f.workout_sessions?.title} · {new Date(f.created_at).toLocaleDateString()}</div>
        </div>
        {!f.coach_read && <button style={s.btnSm} onClick={onRead}>Mark read</button>}
      </div>
      {f.feel && <div style={{ marginBottom: 8 }}><span style={s.feelPill}>{f.feel}</span></div>}
      {f.note && <p style={{ fontSize: 14, lineHeight: 1.6, color: '#333' }}>"{f.note}"</p>}
      {f.logged_exercises && f.logged_exercises.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={s.sectionLabel}>Logged results</div>
          {f.logged_exercises.map((ex, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0ede6', display: 'flex', gap: 16 }}>
              <span style={{ flex: 1, fontWeight: 500 }}>{ex.name}</span>
              <span style={{ color: '#888580' }}>{ex.sets} sets · {ex.reps} reps · {ex.load}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  shell: { display: 'flex', minHeight: '100vh', background: '#f7f6f3' },
  sidebar: {
    width: 220, background: '#111111', padding: '1.5rem 1rem',
    display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 0, height: '100vh'
  },
  logo: { fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', color: '#fff', marginBottom: '1.5rem' },
  navLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: '#555', textTransform: 'uppercase', marginBottom: 6 },
  navBtn: {
    display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 8,
    background: 'transparent', color: '#aaa', fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left'
  },
  navActive: { background: '#222', color: '#fff' },
  badge: { marginLeft: 'auto', background: '#c8f04a', color: '#111', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 7px' },
  signOutBtn: { background: 'transparent', color: '#555', fontSize: 13, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left' },
  main: { flex: 1, padding: '2rem 2.5rem', maxWidth: 960 },
  h1: { fontWeight: 700, fontSize: 24, letterSpacing: '-0.5px', marginBottom: '1.5rem' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  card: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1rem' },
  cardTitle: { fontWeight: 600, fontSize: 16, marginBottom: '1rem' },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 5, display: 'block' },
  inputSm: { marginBottom: 12 },
  btnPrimary: { background: '#111', color: '#c8f04a', padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none', display: 'block', width: '100%' },
  btnSm: { background: 'transparent', border: '1px solid #e4e2dc', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#333' },
  btnIcon: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 16, padding: '0 4px' },
  divider: { border: 'none', borderTop: '1px solid #f0ede6', margin: '1.25rem 0' },
  exHead: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 28px', gap: 8, marginBottom: 6 },
  exLabel: { fontSize: 11, color: '#aaa', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' },
  exRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 28px', gap: 8, marginBottom: 8, alignItems: 'center' },
  exInput: { padding: '8px 10px', border: '1px solid #e4e2dc', borderRadius: 8, fontSize: 13, background: '#fafaf8', color: '#111', width: '100%' },
  clientCard: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 12, padding: '1rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#111', flexShrink: 0 },
  clientName: { fontWeight: 500, fontSize: 15 },
  clientSub: { fontSize: 12, color: '#888580', marginTop: 2 },
  sessionList: { background: '#fafaf8', border: '1px solid #e4e2dc', borderRadius: 12, padding: '1rem', marginBottom: 10 },
  sessionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0ede6' },
  tagGreen: { fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#eafbe5', color: '#2d7a30', fontWeight: 500 },
  tagAmber: { fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#fef3dc', color: '#9a6800', fontWeight: 500 },
  empty: { color: '#aaa', fontSize: 14, padding: '1rem 0' },
  toast: { position: 'fixed', bottom: 24, right: 24, background: '#111', color: '#c8f04a', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 999 },
  feelPill: { background: '#f0ede6', padding: '3px 10px', borderRadius: 20, fontSize: 13 },
}
