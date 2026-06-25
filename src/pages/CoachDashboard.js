import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TABS = ['Clients', 'Build workout', 'Feedback']

export default function CoachDashboard({ session }) {
  const [tab, setTab] = useState('Clients')
  const [clients, setClients] = useState([])
  const [sessions, setSessions] = useState([])
  const [feedback, setFeedback] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [expandedSession, setExpandedSession] = useState(null)
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Workout builder state
  const [wTitle, setWTitle] = useState('')
  const [wNote, setWNote] = useState('')
  const [wClient, setWClient] = useState('')
  const [exercises, setExercises] = useState([{ name: '', sets: '', reps: '', load: '', videoLabel: '', videoUrl: '', comment: '' }])
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  function parseImport() {
    if (!importText.trim()) return
    const blocks = importText.trim().split(/\n\s*\n/)
    const parsed = blocks.map(block => {
      const ex = { name: '', sets: '', reps: '', load: '', videoLabel: '', videoUrl: '', comment: '' }
      // Split every line by | to get all key:value pairs
      const pairs = []
      block.trim().split('\n').forEach(line => {
        line.split('|').forEach(seg => pairs.push(seg.trim()))
      })
      pairs.forEach(seg => {
        const lower = seg.toLowerCase()
        if (lower.startsWith('exercise:')) ex.name = seg.slice(9).trim()
        else if (lower.startsWith('sets:')) ex.sets = seg.slice(5).trim()
        else if (lower.startsWith('reps:')) ex.reps = seg.slice(5).trim()
        else if (lower.startsWith('load:')) ex.load = seg.slice(5).replace(/kg$/i,'').trim()
        else if (lower.startsWith('videolabel:')) ex.videoLabel = seg.slice(11).trim()
        else if (lower.startsWith('video:')) ex.videoUrl = seg.slice(6).trim()
        else if (lower.startsWith('comment:')) ex.comment = seg.slice(8).trim()
      })
      return ex
    }).filter(e => e.name)
    if (parsed.length > 0) {
      setExercises(parsed)
      setImportText('')
      setShowImport(false)
      showToast(`✓ ${parsed.length} exercises imported!`)
    }
  }

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
    const { error } = await supabase.from('clients').insert({ email: newClientEmail.toLowerCase().trim(), name: newClientName })
    if (!error) { showToast('Client added!'); setNewClientEmail(''); setNewClientName(''); load() }
    setAddingClient(false)
  }

  async function saveWorkout() {
    if (!wTitle || !wClient) return
    setSaving(true)
    const client = clients.find(c => c.id === wClient)
    const { error } = await supabase.from('workout_sessions').insert({
      client_id: wClient,
      title: wTitle,
      coach_note: wNote,
      exercises: exercises.filter(e => e.name),
      links: [],
    })
    if (!error) {
      // Send notification email via Supabase edge function workaround — use fetch to resend
      if (client?.email) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.REACT_APP_RESEND_KEY}`
            },
            body: JSON.stringify({
              from: 'Fittnessimo <onboarding@resend.dev>',
              to: client.email,
              subject: `💪 New workout just dropped, ${client.name.split(' ')[0]}!`,
              html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                <h2 style="font-size:22px;font-weight:800;margin-bottom:4px">fittnessimo<span style="color:#c8f04a">.</span></h2>
                <p style="color:#888;font-size:13px;margin-bottom:24px">Your coaching platform</p>
                <h3 style="font-size:18px;margin-bottom:8px">New workout ready, ${client.name.split(' ')[0]}! 🔥</h3>
                <p style="color:#444;line-height:1.6">Your coach just uploaded a new session for you: <strong>${wTitle}</strong>.</p>
                ${wNote ? `<p style="color:#444;font-style:italic;border-left:3px solid #c8f04a;padding-left:12px;margin:16px 0">"${wNote}"</p>` : ''}
                <a href="https://fittnessimo.vercel.app" style="display:inline-block;margin-top:20px;background:#111;color:#c8f04a;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">View my workout →</a>
                <p style="color:#bbb;font-size:12px;margin-top:32px">You're receiving this because your coach added you to Fittnessimo.</p>
              </div>`
            })
          })
        } catch(e) { console.log('Email notification skipped') }
      }
      showToast('Workout assigned! 🎉')
      setWTitle(''); setWNote(''); setWClient('')
      setExercises([{ name: '', sets: '', reps: '', load: '', videoLabel: '', videoUrl: '', comment: '' }])
      load()
    }
    setSaving(false)
  }

  async function signOut() { await supabase.auth.signOut() }

  const unreadFeedback = feedback.filter(f => !f.coach_read).length

  const updateEx = (i, field, val) => {
    const n = [...exercises]
    n[i][field] = val
    setExercises(n)
  }

  return (
    <div style={s.shell}>
      {toast && <div style={s.toast}>{toast}</div>}
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
                  const isSelected = selectedClient?.id === c.id
                  return (
                    <div key={c.id}>
                      <div style={s.clientCard}>
                        <div style={s.avatar}>{c.name.charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                          <div style={s.clientName}>{c.name}</div>
                          <div style={s.clientSub}>{c.email} · {clientSessions.length} session{clientSessions.length !== 1 ? 's' : ''}</div>
                        </div>
                        <button style={s.btnSm} onClick={() => { setSelectedClient(isSelected ? null : c); setExpandedSession(null) }}>
                          {isSelected ? 'Close' : 'Sessions'}
                        </button>
                      </div>

                      {isSelected && (
                        <div style={s.sessionList}>
                          <div style={s.sectionLabel}>{c.name}'s sessions</div>
                          {clientSessions.length === 0
                            ? <p style={s.empty}>No sessions assigned yet.</p>
                            : clientSessions.map(ws => {
                              const fb = feedback.find(f => f.session_id === ws.id)
                              const isExpanded = expandedSession === ws.id
                              return (
                                <div key={ws.id}>
                                  <div style={s.sessionRow} onClick={() => setExpandedSession(isExpanded ? null : ws.id)}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 500, fontSize: 14 }}>{ws.title}</div>
                                      <div style={s.clientSub}>{new Date(ws.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {fb ? <span style={s.tagGreen}>Logged ✓</span> : <span style={s.tagAmber}>Pending</span>}
                                      <span style={{ color: '#aaa', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div style={s.sessionDetail}>
                                      {ws.coach_note && (
                                        <div style={s.noteBox}>
                                          <div style={s.microLabel}>Coach note</div>
                                          <p style={{ fontSize: 13, fontStyle: 'italic', color: '#444', margin: 0 }}>"{ws.coach_note}"</p>
                                        </div>
                                      )}
                                      <div style={s.microLabel}>Exercises</div>
                                      {ws.exercises?.map((ex, i) => (
                                        <div key={i} style={s.detailExRow}>
                                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ex.name}</div>
                                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#555' }}>
                                            <span>Sets: <strong>{ex.sets || '—'}</strong></span>
                                            <span>Reps: <strong>{ex.reps || '—'}</strong></span>
                                            <span>Load: <strong>{ex.load || '—'}</strong></span>
                                          </div>
                                          {ex.videoUrl && (
                                            <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={s.videoLink}>▶ {ex.videoLabel || 'Watch video'}</a>
                                          )}
                                          {/* Show client's logged data if available */}
                                          {fb && fb.logged_exercises?.[i] && (
                                            <div style={s.clientLogged}>
                                              <div style={s.microLabel}>Client logged</div>
                                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#444' }}>
                                                <span>Sets: <strong>{fb.logged_exercises[i].sets || '—'}</strong></span>
                                                <span>Reps: <strong>{fb.logged_exercises[i].reps || '—'}</strong></span>
                                                <span>kg: <strong>{fb.logged_exercises[i].load || '—'}</strong></span>
                                                {fb.logged_exercises[i].rpe && <span>RPE: <strong>{fb.logged_exercises[i].rpe}</strong></span>}
                                                {fb.logged_exercises[i].comment && <div style={{ width: '100%', marginTop: 4, fontStyle: 'italic', color: '#666' }}>"{fb.logged_exercises[i].comment}"</div>}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          }
                        </div>
                      )}
                    </div>
                  )
                })}
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
          <div style={{ maxWidth: 720 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={s.sectionLabel}>Exercises</div>
                <button style={{ ...s.btnSm, background: showImport ? '#111' : 'transparent', color: showImport ? '#c8f04a' : '#333' }} onClick={() => setShowImport(!showImport)}>
                  {showImport ? '✕ Close import' : '⚡ Quick import from Claude'}
                </button>
              </div>

              {showImport && (
                <div style={s.importBox}>
                  <div style={s.microLabel}>Paste your Claude-generated workout below</div>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder={`Exercise: Romanian Deadlift\nSets: 4 | Reps: 10-12 | Load: 60kg\nVideoLabel: RDL tutorial | Video: https://youtube.com/...\nComment: Drive through heels\n\nExercise: Hip Thrust\nSets: 3 | Reps: 12 | Load: 80kg\nComment: Full extension at top`}
                    rows={10}
                    style={{ ...s.exInput, width: '100%', resize: 'vertical', marginTop: 8, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
                  />
                  <button style={{ ...s.btnPrimary, marginTop: 10 }} onClick={parseImport} disabled={!importText.trim()}>
                    ⚡ Import exercises →
                  </button>
                </div>
              )}

              {exercises.map((ex, i) => (
                <div key={i} style={s.exBlock}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>Exercise {i + 1}</span>
                    <button style={s.btnIcon} onClick={() => setExercises(exercises.filter((_, j) => j !== i))}>✕ Remove</button>
                  </div>
                  <input value={ex.name} onChange={e => updateEx(i, 'name', e.target.value)} placeholder="Exercise name (e.g. Romanian Deadlift)" style={{ ...s.exInput, marginBottom: 8, width: '100%' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={s.exLabel}>Sets</div>
                      <input value={ex.sets} onChange={e => updateEx(i, 'sets', e.target.value)} placeholder="3" style={{ ...s.exInput, textAlign: 'center' }} />
                    </div>
                    <div>
                      <div style={s.exLabel}>Reps</div>
                      <input value={ex.reps} onChange={e => updateEx(i, 'reps', e.target.value)} placeholder="10" style={{ ...s.exInput, textAlign: 'center' }} />
                    </div>
                    <div>
                      <div style={s.exLabel}>Load (kg)</div>
                      <input value={ex.load} onChange={e => updateEx(i, 'load', e.target.value)} placeholder="60" style={{ ...s.exInput, textAlign: 'center' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={s.exLabel}>Video label</div>
                      <input value={ex.videoLabel} onChange={e => updateEx(i, 'videoLabel', e.target.value)} placeholder="e.g. RDL tutorial" style={s.exInput} />
                    </div>
                    <div>
                      <div style={s.exLabel}>Video URL</div>
                      <input value={ex.videoUrl} onChange={e => updateEx(i, 'videoUrl', e.target.value)} placeholder="https://youtube.com/…" style={s.exInput} />
                    </div>
                  </div>
                </div>
              ))}

              <button style={s.btnSm} onClick={() => setExercises([...exercises, { name: '', sets: '', reps: '', load: '', videoLabel: '', videoUrl: '', comment: '' }])}>+ Add exercise</button>

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
            <div key={i} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid #f0ede6' }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{ex.name}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#888580' }}>
                <span>{ex.sets} sets</span>
                <span>{ex.reps} reps</span>
                {ex.load && <span>{ex.load} kg</span>}
                {ex.rpe && <span>RPE {ex.rpe}</span>}
              </div>
              {ex.comment && <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 4 }}>"{ex.comment}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  shell: { display: 'flex', minHeight: '100vh', background: '#f7f6f3' },
  sidebar: { width: 220, background: '#111111', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 0, height: '100vh' },
  logo: { fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', color: '#fff', marginBottom: '1.5rem' },
  navLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: '#555', textTransform: 'uppercase', marginBottom: 6 },
  navBtn: { display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'transparent', color: '#aaa', fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' },
  navActive: { background: '#222', color: '#fff' },
  badge: { marginLeft: 'auto', background: '#c8f04a', color: '#111', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 7px' },
  signOutBtn: { background: 'transparent', color: '#555', fontSize: 13, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left' },
  main: { flex: 1, padding: '2rem 2.5rem', maxWidth: 980 },
  h1: { fontWeight: 700, fontSize: 24, letterSpacing: '-0.5px', marginBottom: '1.5rem' },
  grid2: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' },
  card: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1rem' },
  cardTitle: { fontWeight: 600, fontSize: 16, marginBottom: '1rem' },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 },
  microLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bbb', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 5, display: 'block' },
  inputSm: { marginBottom: 12 },
  btnPrimary: { background: '#111', color: '#c8f04a', padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none', display: 'block', width: '100%' },
  btnSm: { background: 'transparent', border: '1px solid #e4e2dc', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#333' },
  btnIcon: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 12, padding: '0 4px' },
  divider: { border: 'none', borderTop: '1px solid #f0ede6', margin: '1.25rem 0' },
  exLabel: { fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  exInput: { padding: '8px 10px', border: '1px solid #e4e2dc', borderRadius: 8, fontSize: 13, background: '#fafaf8', color: '#111', width: '100%' },
  exBlock: { background: '#fafaf8', border: '1px solid #e4e2dc', borderRadius: 12, padding: '1rem', marginBottom: 10 },
  importBox: { background: '#111', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 14 },
  clientCard: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 12, padding: '1rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#111', flexShrink: 0 },
  clientName: { fontWeight: 500, fontSize: 15 },
  clientSub: { fontSize: 12, color: '#888580', marginTop: 2 },
  sessionList: { background: '#fafaf8', border: '1px solid #e4e2dc', borderRadius: 12, padding: '1rem', marginBottom: 10 },
  sessionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0ede6', cursor: 'pointer' },
  sessionDetail: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 10, padding: '1rem', marginBottom: 8 },
  detailExRow: { background: '#fafaf8', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #f0ede6' },
  clientLogged: { marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e4e2dc' },
  noteBox: { background: '#fffdf5', border: '1px solid #f0ede6', borderLeft: '3px solid #c8f04a', borderRadius: 8, padding: '10px 12px', marginBottom: 12 },
  videoLink: { display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: '#555', textDecoration: 'none', background: '#f0ede6', padding: '3px 10px', borderRadius: 20 },
  tagGreen: { fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#eafbe5', color: '#2d7a30', fontWeight: 500 },
  tagAmber: { fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#fef3dc', color: '#9a6800', fontWeight: 500 },
  empty: { color: '#aaa', fontSize: 14, padding: '1rem 0' },
  toast: { position: 'fixed', bottom: 24, right: 24, background: '#111', color: '#c8f04a', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 999 },
  feelPill: { background: '#f0ede6', padding: '3px 10px', borderRadius: 20, fontSize: 13 },
}
