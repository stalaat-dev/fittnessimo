import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function ClientDashboard({ session }) {
  const [clientData, setClientData] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [tab, setTab] = useState('today')
  const [logged, setLogged] = useState({})
  const [feel, setFeel] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    const email = session.user.email
    const { data: c } = await supabase.from('clients').select('*').eq('email', email).single()
    if (!c) return
    setClientData(c)
    const { data: s } = await supabase
      .from('workout_sessions')
      .select('*, feedback(*)')
      .eq('client_id', c.id)
      .order('created_at', { ascending: false })
    setSessions(s || [])
    if (s && s.length > 0) {
      const latest = s[0]
      setActiveSession(latest)
      if (latest.exercises) {
        const init = {}
        latest.exercises.forEach((ex, i) => {
          init[i] = { sets: ex.sets || '', reps: ex.reps || '', load: '', rpe: '', comment: '' }
        })
        setLogged(init)
      }
      if (latest.feedback && latest.feedback.length > 0) setSubmitted(true)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  async function submitSession() {
    if (!activeSession) return
    setSubmitting(true)
    const loggedExercises = activeSession.exercises?.map((ex, i) => ({
      name: ex.name,
      sets: logged[i]?.sets || '',
      reps: logged[i]?.reps || '',
      load: logged[i]?.load || '',
      rpe: logged[i]?.rpe || '',
      comment: logged[i]?.comment || '',
    }))
    const { error } = await supabase.from('feedback').insert({
      session_id: activeSession.id,
      client_id: clientData.id,
      feel,
      note,
      logged_exercises: loggedExercises,
    })
    if (!error) { showToast('Session logged! 🎉'); setSubmitted(true); load() }
    setSubmitting(false)
  }

  async function signOut() { await supabase.auth.signOut() }

  const updateLog = (i, field, val) => {
    setLogged(l => ({ ...l, [i]: { ...l[i], [field]: val } }))
  }

  if (!clientData) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 20 }}>fittnessimo<span style={{ color: '#c8f04a' }}>.</span></div>
      <p style={{ color: '#888', fontSize: 14 }}>Your coach will add you shortly — check back soon!</p>
      <button onClick={signOut} style={{ color: '#aaa', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
    </div>
  )

  const FEELS = ['💪 Strong', '😓 Tired', '😣 Pain', '✅ Solid', '🔥 PR day']

  return (
    <div style={s.shell}>
      {toast && <div style={s.toast}>{toast}</div>}
      <div style={s.header}>
        <div style={s.logo}>fittnessimo<span style={{ color: '#c8f04a' }}>.</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={s.greeting}>Hi, {clientData.name.split(' ')[0]} 👋</div>
          <button style={s.signOutBtn} onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div style={s.tabBar}>
        <button style={{ ...s.tabBtn, ...(tab === 'today' ? s.tabActive : {}) }} onClick={() => setTab('today')}>Today's session</button>
        <button style={{ ...s.tabBtn, ...(tab === 'history' ? s.tabActive : {}) }} onClick={() => setTab('history')}>History</button>
      </div>

      <div style={s.main}>

        {/* TODAY TAB */}
        {tab === 'today' && (
          <div style={{ maxWidth: 620, margin: '0 auto' }}>
            {!activeSession ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div>
                <p style={{ fontWeight: 600, fontSize: 18 }}>No session yet</p>
                <p style={{ color: '#888', fontSize: 14, marginTop: 6 }}>Your coach hasn't assigned a session yet. Check back soon!</p>
              </div>
            ) : (
              <>
                <div style={s.sessionHeader}>
                  <div>
                    <div style={s.sessionTitle}>{activeSession.title}</div>
                    <div style={s.sessionDate}>{new Date(activeSession.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                  </div>
                  {submitted && <span style={s.tagGreen}>Logged ✓</span>}
                </div>

                {activeSession.coach_note && (
                  <div style={s.noteBox}>
                    <div style={s.microLabel}>Coach note</div>
                    <p style={{ fontSize: 14, lineHeight: 1.6, fontStyle: 'italic', color: '#444', margin: 0 }}>"{activeSession.coach_note}"</p>
                  </div>
                )}

                {/* Exercises */}
                {activeSession.exercises?.map((ex, i) => (
                  <div key={i} style={s.exCard}>
                    {/* Exercise name + video */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{ex.name}</div>
                      {ex.videoUrl && (
                        <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={s.videoLink}>▶ {ex.videoLabel || 'Watch'}</a>
                      )}
                    </div>

                    {/* Target row */}
                    <div style={s.targetRow}>
                      <span style={s.microLabel}>Target</span>
                      <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#555' }}>
                        <span>{ex.sets} sets</span>
                        <span>{ex.reps} reps</span>
                        {ex.load && <span>{ex.load} kg</span>}
                      </div>
                    </div>

                    {/* Log inputs */}
                    <div style={s.logGrid}>
                      <div>
                        <div style={s.microLabel}>Sets done</div>
                        <input style={s.logInput} value={logged[i]?.sets ?? ''} onChange={e => updateLog(i, 'sets', e.target.value)} disabled={submitted} placeholder={ex.sets} />
                      </div>
                      <div>
                        <div style={s.microLabel}>Reps done</div>
                        <input style={s.logInput} value={logged[i]?.reps ?? ''} onChange={e => updateLog(i, 'reps', e.target.value)} disabled={submitted} placeholder={ex.reps} />
                      </div>
                      <div>
                        <div style={s.microLabel}>kg used</div>
                        <input style={s.logInput} value={logged[i]?.load ?? ''} onChange={e => updateLog(i, 'load', e.target.value)} disabled={submitted} placeholder={ex.load || '—'} />
                      </div>
                      <div>
                        <div style={s.microLabel}>RPE (1–10)</div>
                        <input style={s.logInput} value={logged[i]?.rpe ?? ''} onChange={e => updateLog(i, 'rpe', e.target.value)} disabled={submitted} placeholder="8" />
                      </div>
                    </div>

                    {/* Per-exercise comment */}
                    <div style={{ marginTop: 10 }}>
                      <div style={s.microLabel}>Notes for this exercise</div>
                      <textarea
                        style={s.commentBox}
                        rows={2}
                        placeholder="Felt heavy, had to drop weight, pain, PR…"
                        value={logged[i]?.comment ?? ''}
                        onChange={e => updateLog(i, 'comment', e.target.value)}
                        disabled={submitted}
                      />
                    </div>
                  </div>
                ))}

                {/* Overall feedback */}
                {!submitted && (
                  <div style={s.card}>
                    <div style={s.sectionLabel}>Overall session feedback</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                      {FEELS.map(f => (
                        <button key={f} style={{ ...s.feelBtn, ...(feel === f ? s.feelActive : {}) }} onClick={() => setFeel(f === feel ? '' : f)}>{f}</button>
                      ))}
                    </div>
                    <textarea
                      style={{ ...s.commentBox, width: '100%' }}
                      rows={3}
                      placeholder="Any general notes for your coach? Overall energy, how it went…"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                    <button style={s.btnPrimary} onClick={submitSession} disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit session →'}
                    </button>
                  </div>
                )}

                {submitted && (
                  <div style={{ ...s.card, textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                    <p style={{ fontWeight: 600 }}>Session logged!</p>
                    <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Your coach can see your results. Great work!</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div style={{ maxWidth: 620, margin: '0 auto' }}>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: '1rem' }}>Session history</h2>
            {sessions.length === 0 && <p style={{ color: '#aaa', fontSize: 14 }}>No sessions yet.</p>}
            {sessions.map(ws => {
              const fb = ws.feedback?.[0]
              return (
                <div key={ws.id} style={s.historyCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: fb ? 10 : 0 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{ws.title}</div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{new Date(ws.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                    {fb ? <span style={s.tagGreen}>Logged ✓</span> : <span style={s.tagAmber}>Not logged</span>}
                  </div>
                  {fb && (
                    <div style={{ borderTop: '1px solid #f0ede6', paddingTop: 10 }}>
                      {fb.feel && <span style={s.feelPill}>{fb.feel}</span>}
                      {fb.note && <p style={{ fontSize: 13, color: '#555', marginTop: 8, fontStyle: 'italic' }}>"{fb.note}"</p>}
                      {fb.logged_exercises?.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          {fb.logged_exercises.map((ex, i) => (
                            <div key={i} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid #f8f6f2' }}>
                              <div style={{ fontWeight: 500, marginBottom: 3 }}>{ex.name}</div>
                              <div style={{ color: '#888', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span>{ex.sets} sets · {ex.reps} reps{ex.load ? ` · ${ex.load}kg` : ''}{ex.rpe ? ` · RPE ${ex.rpe}` : ''}</span>
                              </div>
                              {ex.comment && <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 3 }}>"{ex.comment}"</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  shell: { minHeight: '100vh', background: '#f7f6f3', display: 'flex', flexDirection: 'column' },
  header: { background: '#111', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.5px' },
  greeting: { color: '#fff', fontSize: 14, fontWeight: 500 },
  signOutBtn: { background: 'transparent', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer' },
  tabBar: { background: '#fff', borderBottom: '1px solid #e4e2dc', padding: '0 1.5rem', display: 'flex', gap: 4 },
  tabBtn: { padding: '14px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 14, cursor: 'pointer', color: '#888', fontFamily: 'inherit' },
  tabActive: { color: '#111', borderBottomColor: '#111', fontWeight: 500 },
  main: { flex: 1, padding: '1.5rem' },
  sessionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sessionTitle: { fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px' },
  sessionDate: { fontSize: 13, color: '#888', marginTop: 3 },
  noteBox: { background: '#fff', border: '1px solid #e4e2dc', borderLeft: '3px solid #c8f04a', borderRadius: 10, padding: '1rem', marginBottom: 14 },
  microLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aaa', marginBottom: 5 },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 },
  exCard: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 14, padding: '1.25rem', marginBottom: 12 },
  targetRow: { background: '#f7f6f3', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 },
  logGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 },
  logInput: { padding: '9px 8px', border: '1px solid #e4e2dc', borderRadius: 8, fontSize: 14, textAlign: 'center', background: '#fafaf8', color: '#111', width: '100%', fontFamily: 'inherit' },
  commentBox: { width: '100%', padding: '10px 12px', border: '1px solid #e4e2dc', borderRadius: 8, background: '#fafaf8', color: '#111', fontSize: 13, fontFamily: 'inherit', resize: 'none' },
  videoLink: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: '1px solid #e4e2dc', borderRadius: 20, fontSize: 12, color: '#333', background: '#f7f6f3', textDecoration: 'none', flexShrink: 0 },
  card: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 14 },
  feelBtn: { background: '#f7f6f3', border: '1px solid #e4e2dc', borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  feelActive: { background: '#c8f04a', borderColor: '#9aba2e', color: '#111' },
  feelPill: { background: '#f0ede6', padding: '3px 10px', borderRadius: 20, fontSize: 12 },
  btnPrimary: { background: '#111', color: '#c8f04a', padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none', display: 'block', width: '100%', marginTop: 12, fontFamily: 'inherit' },
  tagGreen: { fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#eafbe5', color: '#2d7a30', fontWeight: 500, flexShrink: 0 },
  tagAmber: { fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#fef3dc', color: '#9a6800', fontWeight: 500, flexShrink: 0 },
  emptyState: { textAlign: 'center', padding: '4rem 2rem', color: '#333' },
  historyCard: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 12 },
  toast: { position: 'fixed', bottom: 24, right: 24, background: '#111', color: '#c8f04a', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 999 },
}
