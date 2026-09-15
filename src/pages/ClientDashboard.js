import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getSessionStatus(ws, today) {
  const scheduled = ws.scheduled_date ? new Date(ws.scheduled_date + 'T00:00:00') : null
  const hasLogged = ws.feedback && ws.feedback.length > 0
  if (hasLogged) return 'logged'
  if (!scheduled) return 'unscheduled'
  const todayStr = today.toISOString().split('T')[0]
  const schedStr = ws.scheduled_date
  if (schedStr === todayStr) return 'today'
  if (schedStr < todayStr) return 'missed'
  return 'upcoming'
}

function statusLabel(status) {
  if (status === 'logged') return { label: 'Done ✓', color: '#2d7a30', bg: '#eafbe5' }
  if (status === 'today') return { label: 'Do today 💪', color: '#9a6800', bg: '#fef3dc' }
  if (status === 'missed') return { label: 'Missed', color: '#c0392b', bg: '#fdecea' }
  if (status === 'upcoming') return { label: 'Upcoming', color: '#555', bg: '#f0ede6' }
  return { label: 'Session', color: '#555', bg: '#f0ede6' }
}

export default function ClientDashboard({ session }) {
  const [clientData, setClientData] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [logged, setLogged] = useState({})
  const [feel, setFeel] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState('session')
  const today = new Date()

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const saveToLocal = (sessionId, data) => {
    try { localStorage.setItem(`fittnessimo_log_${sessionId}`, JSON.stringify(data)) } catch(e) {}
  }
  const loadFromLocal = (sessionId) => {
    try { const d = localStorage.getItem(`fittnessimo_log_${sessionId}`); return d ? JSON.parse(d) : null } catch(e) { return null }
  }
  const clearLocal = (sessionId) => {
    try { localStorage.removeItem(`fittnessimo_log_${sessionId}`) } catch(e) {}
  }

  const updateLog = (i, field, val, sessionId) => {
    setLogged(l => {
      const updated = { ...l, [i]: { ...l[i], [field]: val } }
      saveToLocal(sessionId, updated)
      return updated
    })
  }

  const initSessionLog = useCallback((ws) => {
    const hasLogged = ws.feedback && ws.feedback.length > 0
    if (hasLogged) {
      setSubmitted(true)
      const fb = ws.feedback[0]
      if (fb.logged_exercises) {
        const init = {}
        fb.logged_exercises.forEach((ex, i) => { init[i] = ex })
        setLogged(init)
      }
      setFeel(fb.feel || '')
      setNote(fb.note || '')
    } else {
      setSubmitted(false)
      const saved = loadFromLocal(ws.id)
      if (saved) {
        setLogged(saved)
      } else if (ws.exercises) {
        const init = {}
        ws.exercises.forEach((_, i) => { init[i] = { load: '', rpe: '', comment: '' } })
        setLogged(init)
      }
      setFeel('')
      setNote('')
    }
  }, [])

  const load = useCallback(async () => {
    const email = session.user.email
    const { data: c } = await supabase.from('clients').select('*').eq('email', email).single()
    if (!c) return
    setClientData(c)
    const { data: s } = await supabase
      .from('workout_sessions')
      .select('*, feedback(*)')
      .eq('client_id', c.id)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
    if (!s || s.length === 0) { setSessions([]); return }
    setSessions(s)
    // Find today's session or closest upcoming
    const todayStr = today.toISOString().split('T')[0]
    let idx = s.findIndex(ws => ws.scheduled_date === todayStr)
    if (idx === -1) idx = s.findIndex(ws => ws.scheduled_date > todayStr)
    if (idx === -1) idx = s.length - 1
    setActiveIdx(idx)
    initSessionLog(s[idx])
  }, [session, initSessionLog])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (sessions.length > 0 && sessions[activeIdx]) {
      initSessionLog(sessions[activeIdx])
    }
  }, [activeIdx, sessions, initSessionLog])

  async function submitSession() {
    const ws = sessions[activeIdx]
    if (!ws) return
    setSubmitting(true)
    const loggedExercises = ws.exercises?.map((ex, i) => ({
      name: ex.name,
      sets: ex.sets || '',
      reps: ex.reps || '',
      load: logged[i]?.load || '',
      rpe: logged[i]?.rpe || '',
      comment: logged[i]?.comment || '',
    }))
    const { error } = await supabase.from('feedback').insert({
      session_id: ws.id,
      client_id: clientData.id,
      feel, note,
      logged_exercises: loggedExercises,
    })
    if (!error) {
      clearLocal(ws.id)
      showToast('Session logged! 🎉')
      setSubmitted(true)
      load()
    }
    setSubmitting(false)
  }

  async function signOut() { await supabase.auth.signOut() }

  // Build week strip for current week
  function buildWeekStrip() {
    const todayStr = today.toISOString().split('T')[0]
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      const dStr = d.toISOString().split('T')[0]
      const hasSession = sessions.some(ws => ws.scheduled_date === dStr)
      const isToday = dStr === todayStr
      const sessionOnDay = sessions.find(ws => ws.scheduled_date === dStr)
      const status = sessionOnDay ? getSessionStatus(sessionOnDay, today) : null
      return { day: DAYS[i], date: d.getDate(), dStr, hasSession, isToday, status, sessionOnDay }
    })
  }

  const FEELS = ['💪 Strong', '😓 Tired', '😣 Pain', '✅ Solid', '🔥 PR day']
  const activeSession = sessions[activeIdx]
  const todayStr = today.toISOString().split('T')[0]
  const todaySession = sessions.find(ws => ws.scheduled_date === todayStr)
  const isRestDay = !todaySession
  const weekStrip = buildWeekStrip()

  if (!clientData) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 20 }}>fittnessimo<span style={{ color: '#c8f04a' }}>.</span></div>
      <p style={{ color: '#888', fontSize: 14 }}>Your coach will add you shortly!</p>
      <button onClick={signOut} style={{ color: '#aaa', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
    </div>
  )

  return (
    <div style={s.shell}>
      {toast && <div style={s.toast}>{toast}</div>}

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>fittnessimo<span style={{ color: '#c8f04a' }}>.</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={s.greeting}>Hi, {clientData.name.split(' ')[0]} 👋</div>
          <button style={s.signOutBtn} onClick={signOut}>Sign out</button>
        </div>
      </div>

      {/* Week strip */}
      <div style={s.weekStrip}>
        {weekStrip.map((d, i) => (
          <div
            key={i}
            style={{
              ...s.dayCell,
              ...(d.isToday ? s.dayCellToday : {}),
              ...(d.sessionOnDay && d.sessionOnDay === activeSession ? s.dayCellActive : {}),
              cursor: d.hasSession ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (d.sessionOnDay) {
                const idx = sessions.indexOf(d.sessionOnDay)
                if (idx !== -1) setActiveIdx(idx)
              }
            }}
          >
            <div style={s.dayLabel}>{d.day}</div>
            <div style={s.dayNum}>{d.date}</div>
            <div style={s.dayDot}>
              {d.hasSession ? (
                <span style={{
                  fontSize: 14,
                  color: d.status === 'logged' ? '#2d7a30' :
                         d.status === 'today' ? '#c8f04a' :
                         d.status === 'missed' ? '#c0392b' : '#888'
                }}>★</span>
              ) : (
                <span style={{ fontSize: 10, color: '#ddd' }}>·</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        <button style={{ ...s.tabBtn, ...(tab === 'session' ? s.tabActive : {}) }} onClick={() => setTab('session')}>Session</button>
        <button style={{ ...s.tabBtn, ...(tab === 'history' ? s.tabActive : {}) }} onClick={() => setTab('history')}>History</button>
      </div>

      <div style={s.main}>
        {tab === 'session' && (
          <div style={{ maxWidth: 620, margin: '0 auto' }}>

            {/* Rest day — today has no session */}
            {isRestDay && !activeSession && (
              <div style={s.restDay}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🙌</div>
                <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Rest day</div>
                <div style={{ color: '#888', fontSize: 15 }}>No session scheduled today. Recovery is part of the program!</div>
              </div>
            )}

            {/* Show selected session */}
            {activeSession && (() => {
              const status = getSessionStatus(activeSession, today)
              const statusInfo = statusLabel(status)
              const isRestDaySelected = activeSession.scheduled_date !== todayStr && status !== 'today'

              return (
                <>
                  <div style={s.sessionHeader}>
                    <div>
                      <div style={s.sessionTitle}>{activeSession.title}</div>
                      <div style={s.sessionDate}>
                        {activeSession.scheduled_date
                          ? new Date(activeSession.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                          : 'No date set'}
                      </div>
                    </div>
                    <span style={{ ...s.statusBadge, background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
                  </div>

                  {/* Navigation arrows */}
                  <div style={s.sessionNav}>
                    <button style={s.navArrow} onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))} disabled={activeIdx === 0}>← Prev</button>
                    <span style={{ fontSize: 13, color: '#888' }}>{activeIdx + 1} of {sessions.length}</span>
                    <button style={s.navArrow} onClick={() => setActiveIdx(Math.min(sessions.length - 1, activeIdx + 1))} disabled={activeIdx === sessions.length - 1}>Next →</button>
                  </div>

                  {/* Rest day selected (not today's session) */}
                  {status === 'upcoming' && activeSession.scheduled_date !== todayStr && (
                    <div style={{ ...s.restDay, padding: '1.5rem', marginBottom: 14 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>Upcoming session</div>
                      <div style={{ color: '#888', fontSize: 14, marginTop: 4 }}>This session is scheduled for a future date. Come back then!</div>
                    </div>
                  )}

                  {activeSession.coach_note && (
                    <div style={s.noteBox}>
                      <div style={s.microLabel}>Coach note</div>
                      <p style={{ fontSize: 14, lineHeight: 1.6, fontStyle: 'italic', color: '#444', margin: 0 }}>"{activeSession.coach_note}"</p>
                    </div>
                  )}

                  {/* Exercises */}
                  {(status === 'today' || status === 'logged' || status === 'missed') && activeSession.exercises?.map((ex, i) => (
                    <div key={i} style={s.exCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{ex.name}</div>
                        {ex.videoUrl && <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={s.videoLink}>▶ {ex.videoLabel || 'Watch'}</a>}
                      </div>
                      {ex.comment && <div style={s.coachCue}><span style={{ marginRight: 5 }}>💡</span>{ex.comment}</div>}
                      <div style={s.targetRow}>
                        <span style={s.microLabel}>Target</span>
                        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#555' }}>
                          <span>{ex.sets} sets</span>
                          <span>{ex.reps} reps</span>
                          {ex.load && ex.load !== '-' && <span>{ex.load} kg</span>}
                        </div>
                      </div>
                      <div style={s.logGrid}>
                        <div>
                          <div style={s.microLabel}>kg used</div>
                          <input style={s.logInput} value={logged[i]?.load ?? ''} onChange={e => !submitted && updateLog(i, 'load', e.target.value, activeSession.id)} readOnly={submitted} placeholder="—" />
                        </div>
                        <div>
                          <div style={s.microLabel}>RPE (1–10)</div>
                          <input style={s.logInput} value={logged[i]?.rpe ?? ''} onChange={e => !submitted && updateLog(i, 'rpe', e.target.value, activeSession.id)} readOnly={submitted} placeholder="8" />
                        </div>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <div style={s.microLabel}>Your notes</div>
                        <textarea style={{ ...s.commentBox, background: submitted ? '#f7f6f3' : '#fafaf8' }} rows={2} placeholder="Notes, pain, PR…" value={logged[i]?.comment ?? ''} onChange={e => !submitted && updateLog(i, 'comment', e.target.value, activeSession.id)} readOnly={submitted} />
                      </div>
                    </div>
                  ))}

                  {/* Submit */}
                  {status === 'today' && !submitted && (
                    <div style={s.card}>
                      <div style={s.sectionLabel}>How did it go?</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {FEELS.map(f => <button key={f} style={{ ...s.feelBtn, ...(feel === f ? s.feelActive : {}) }} onClick={() => setFeel(f === feel ? '' : f)}>{f}</button>)}
                      </div>
                      <textarea style={{ ...s.commentBox, width: '100%' }} rows={3} placeholder="General notes for your coach…" value={note} onChange={e => setNote(e.target.value)} />
                      <button style={s.btnPrimary} onClick={submitSession} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit session →'}</button>
                    </div>
                  )}

                  {submitted && status === 'logged' && (
                    <div style={{ ...s.card, textAlign: 'center', padding: '1.5rem' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                      <p style={{ fontWeight: 600 }}>Session logged!</p>
                      <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Your coach can see your results. Great work!</p>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {tab === 'history' && (
          <div style={{ maxWidth: 620, margin: '0 auto' }}>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: '1rem' }}>Session history</h2>
            {sessions.length === 0 && <p style={{ color: '#aaa', fontSize: 14 }}>No sessions yet.</p>}
            {[...sessions].reverse().map(ws => {
              const fb = ws.feedback?.[0]
              const status = getSessionStatus(ws, today)
              const statusInfo = statusLabel(status)
              return (
                <div key={ws.id} style={s.historyCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: fb ? 10 : 0 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{ws.title}</div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                        {ws.scheduled_date ? new Date(ws.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No date'}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: statusInfo.bg, color: statusInfo.color, fontWeight: 500, flexShrink: 0 }}>{statusInfo.label}</span>
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
                                {ex.load && <span>{ex.load}kg</span>}
                                {ex.rpe && <span>RPE {ex.rpe}</span>}
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
  weekStrip: { background: '#111', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 12px', borderBottom: '1px solid #222' },
  dayCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 10px', borderRadius: 10, minWidth: 38 },
  dayCellToday: { background: '#1e1e1e' },
  dayCellActive: { background: '#222', outline: '1px solid #c8f04a' },
  dayLabel: { fontSize: 10, color: '#666', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 3 },
  dayNum: { fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 3 },
  dayDot: { height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tabBar: { background: '#fff', borderBottom: '1px solid #e4e2dc', padding: '0 1.5rem', display: 'flex', gap: 4 },
  tabBtn: { padding: '12px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 14, cursor: 'pointer', color: '#888', fontFamily: 'inherit' },
  tabActive: { color: '#111', borderBottomColor: '#111', fontWeight: 500 },
  main: { flex: 1, padding: '1.5rem' },
  sessionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sessionTitle: { fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px' },
  sessionDate: { fontSize: 13, color: '#888', marginTop: 3 },
  statusBadge: { fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600, flexShrink: 0 },
  sessionNav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e4e2dc', borderRadius: 10, padding: '8px 14px', marginBottom: 14 },
  navArrow: { background: 'transparent', border: 'none', fontSize: 13, color: '#555', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, padding: '4px 8px' },
  noteBox: { background: '#fff', border: '1px solid #e4e2dc', borderLeft: '3px solid #c8f04a', borderRadius: 10, padding: '1rem', marginBottom: 14 },
  microLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aaa', marginBottom: 5 },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 },
  exCard: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 14, padding: '1.25rem', marginBottom: 12 },
  coachCue: { fontSize: 13, color: '#555', fontStyle: 'italic', background: '#fffdf0', border: '1px solid #f0e8c0', borderRadius: 8, padding: '8px 10px', marginBottom: 12, lineHeight: 1.5 },
  targetRow: { background: '#f7f6f3', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 },
  logGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  logInput: { padding: '9px 8px', border: '1px solid #e4e2dc', borderRadius: 8, fontSize: 14, textAlign: 'center', background: '#fafaf8', color: '#111', width: '100%', fontFamily: 'inherit' },
  commentBox: { width: '100%', padding: '10px 12px', border: '1px solid #e4e2dc', borderRadius: 8, background: '#fafaf8', color: '#111', fontSize: 13, fontFamily: 'inherit', resize: 'none' },
  videoLink: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: '1px solid #e4e2dc', borderRadius: 20, fontSize: 12, color: '#333', background: '#f7f6f3', textDecoration: 'none', flexShrink: 0 },
  card: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 14 },
  feelBtn: { background: '#f7f6f3', border: '1px solid #e4e2dc', borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  feelActive: { background: '#c8f04a', borderColor: '#9aba2e', color: '#111' },
  feelPill: { background: '#f0ede6', padding: '3px 10px', borderRadius: 20, fontSize: 12 },
  btnPrimary: { background: '#111', color: '#c8f04a', padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none', display: 'block', width: '100%', marginTop: 12, fontFamily: 'inherit' },
  restDay: { textAlign: 'center', padding: '3rem 2rem', color: '#333', background: '#fff', border: '1px solid #e4e2dc', borderRadius: 16, marginBottom: 14 },
  historyCard: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 12 },
  toast: { position: 'fixed', bottom: 24, right: 24, background: '#111', color: '#c8f04a', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 999 },
}
