import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TABS = ['Clients', 'Build workout', 'Feedback']
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CopySummaryButton({ ws, fb, clientName }) {
  const [copied, setCopied] = useState(false)
  function buildSummary() {
    const date = ws.scheduled_date
      ? new Date(ws.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date(ws.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const lines = []
    lines.push(`CLIENT FEEDBACK SUMMARY`)
    lines.push(`========================`)
    lines.push(`Client: ${clientName}`)
    lines.push(`Session: ${ws.title}`)
    lines.push(`Date: ${date}`)
    if (fb.feel) lines.push(`Overall feel: ${fb.feel}`)
    lines.push(``)
    lines.push(`EXERCISE LOG`)
    lines.push(`------------`)
    ws.exercises?.forEach((ex, i) => {
      const log = fb.logged_exercises?.[i]
      lines.push(`${i + 1}. ${ex.name}`)
      lines.push(`   Target: ${ex.sets || '?'} sets x ${ex.reps || '?'} reps${ex.load && ex.load !== '-' ? ` @ ${ex.load}kg` : ''}`)
      if (log) {
        const parts = []
        if (log.load) parts.push(`kg used: ${log.load}`)
        if (log.rpe) parts.push(`RPE: ${log.rpe}`)
        if (parts.length) lines.push(`   Logged: ${parts.join(' | ')}`)
        if (log.comment) lines.push(`   Client note: "${log.comment}"`)
      } else {
        lines.push(`   Logged: not submitted`)
      }
      lines.push(``)
    })
    if (fb.note) {
      lines.push(`OVERALL CLIENT NOTE`)
      lines.push(`-------------------`)
      lines.push(`"${fb.note}"`)
      lines.push(``)
    }
    lines.push(`COACH ACTION NEEDED`)
    lines.push(`-------------------`)
    const highRPE = fb.logged_exercises?.filter(e => parseInt(e.rpe) >= 9)
    const pain = fb.logged_exercises?.filter(e => e.comment?.toLowerCase().includes('pain') || e.comment?.toLowerCase().includes('hurt'))
    const lightRPE = fb.logged_exercises?.filter(e => parseInt(e.rpe) <= 5 && e.rpe)
    if (highRPE?.length) lines.push(`- High RPE (9+) on: ${highRPE.map(e => e.name).join(', ')} — consider reducing load`)
    if (pain?.length) lines.push(`- Pain reported on: ${pain.map(e => e.name).join(', ')} — review exercise`)
    if (lightRPE?.length) lines.push(`- Low RPE (≤5) on: ${lightRPE.map(e => e.name).join(', ')} — consider increasing load`)
    if (fb.feel === '💪 Strong' || fb.feel === '🔥 PR day') lines.push(`- Client felt strong — consider progressive overload next session`)
    if (fb.feel === '😓 Tired' || fb.feel === '😣 Pain') lines.push(`- Client reported fatigue/pain — consider deload or substitution`)
    if (!highRPE?.length && !pain?.length && !lightRPE?.length && fb.feel !== '😓 Tired' && fb.feel !== '😣 Pain') {
      lines.push(`- Session appears well tolerated — maintain or progress as planned`)
    }
    return lines.join('\n')
  }
  function handleCopy() {
    navigator.clipboard.writeText(buildSummary()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #e4e2dc', paddingTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 }}>Session summary for Claude</div>
      <button onClick={handleCopy} style={{ background: copied ? '#eafbe5' : '#111', color: copied ? '#2d7a30' : '#c8f04a', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
        {copied ? '✓ Copied! Paste into Claude' : '📋 Copy session summary'}
      </button>
    </div>
  )
}

function WeekView({ sessions }) {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    const dStr = d.toISOString().split('T')[0]
    const ws = sessions.find(s => s.scheduled_date === dStr)
    const isToday = dStr === today.toISOString().split('T')[0]
    return { day: DAYS_OF_WEEK[i], date: d.getDate(), dStr, ws, isToday }
  })
  return (
    <div style={{ display: 'flex', gap: 4, margin: '12px 0', flexWrap: 'wrap' }}>
      {days.map((d, i) => (
        <div key={i} style={{ flex: 1, minWidth: 36, background: d.isToday ? '#111' : d.ws ? '#f0fde4' : '#f7f6f3', border: d.isToday ? '1px solid #333' : d.ws ? '1px solid #c8f04a' : '1px solid #e4e2dc', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: d.isToday ? '#c8f04a' : '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.day}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: d.isToday ? '#fff' : '#333', margin: '2px 0' }}>{d.date}</div>
          <div style={{ fontSize: 14 }}>{d.ws ? '★' : '·'}</div>
          {d.ws && <div style={{ fontSize: 8, color: '#666', marginTop: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{d.ws.title}</div>}
        </div>
      ))}
    </div>
  )
}

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

  // Build workout state
  const [wTitle, setWTitle] = useState('')
  const [wNote, setWNote] = useState('')
  const [wClient, setWClient] = useState('')
  const [wDate, setWDate] = useState('')
  const [assignMode, setAssignMode] = useState('single') // 'single' | 'bulk'
  const [bulkStartDate, setBulkStartDate] = useState('')
  const [bulkDays, setBulkDays] = useState([])
  const [exercises, setExercises] = useState([{ name: '', sets: '', reps: '', load: '', videoLabel: '', videoUrl: '', comment: '' }])
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function parseImport() {
    if (!importText.trim()) return
    const rawBlocks = importText.trim().split(/(?=Exercise:)/i).filter(b => b.trim())
    const parsed = rawBlocks.map(block => {
      const ex = { name: '', sets: '', reps: '', load: '', videoLabel: '', videoUrl: '', comment: '' }
      const pairs = []
      block.trim().split('\n').forEach(line => line.split('|').forEach(seg => pairs.push(seg.trim())))
      pairs.forEach(seg => {
        const lower = seg.toLowerCase()
        const isEmpty = (v) => !v || v === '-' || v === '—' || v.toLowerCase() === 'n/a' || v.toLowerCase() === 'none'
        if (lower.startsWith('exercise:')) ex.name = seg.slice(9).trim()
        else if (lower.startsWith('sets:')) { const v = seg.slice(5).trim(); if (!isEmpty(v)) ex.sets = v }
        else if (lower.startsWith('reps:')) { const v = seg.slice(5).trim(); if (!isEmpty(v)) ex.reps = v }
        else if (lower.startsWith('load:')) { const v = seg.slice(5).replace(/kg$/i,'').trim(); if (!isEmpty(v)) ex.load = v }
        else if (lower.startsWith('videolabel:')) { const v = seg.slice(11).trim(); if (!isEmpty(v)) ex.videoLabel = v }
        else if (lower.startsWith('video:')) { const v = seg.slice(6).trim(); if (!isEmpty(v)) ex.videoUrl = v }
        else if (lower.startsWith('comment:')) { const v = seg.slice(8).trim(); if (!isEmpty(v)) ex.comment = v }
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

  const load = useCallback(async () => {
    const { data: c } = await supabase.from('clients').select('*').order('created_at')
    setClients(c || [])
    const { data: s } = await supabase.from('workout_sessions').select('*').order('scheduled_date', { ascending: true, nullsFirst: false })
    setSessions(s || [])
    const { data: f } = await supabase.from('feedback').select('*, workout_sessions(title, scheduled_date, clients(name))').order('created_at', { ascending: false })
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
    const exs = exercises.filter(e => e.name)

    if (assignMode === 'bulk' && bulkStartDate && bulkDays.length > 0) {
      // Generate dates for selected days of week starting from bulkStartDate
      const start = new Date(bulkStartDate + 'T00:00:00')
      const dates = []
      for (let i = 0; i < 28; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        if (bulkDays.includes(d.getDay())) {
          dates.push(d.toISOString().split('T')[0])
        }
        if (dates.length >= bulkDays.length) break
      }
      for (const date of dates) {
        await supabase.from('workout_sessions').insert({
          client_id: wClient, title: wTitle, coach_note: wNote,
          exercises: exs, links: [], scheduled_date: date,
        })
      }
      showToast(`✓ ${dates.length} sessions assigned!`)
    } else {
      await supabase.from('workout_sessions').insert({
        client_id: wClient, title: wTitle, coach_note: wNote,
        exercises: exs, links: [], scheduled_date: wDate || null,
      })
      // Notify client
      if (client?.email) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.REACT_APP_RESEND_KEY}` },
            body: JSON.stringify({
              from: 'Fittnessimo <onboarding@resend.dev>',
              to: client.email,
              subject: `💪 New workout just dropped, ${client.name.split(' ')[0]}!`,
              html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                <h2 style="font-weight:800;margin-bottom:4px">fittnessimo<span style="color:#c8f04a">.</span></h2>
                <h3 style="margin-bottom:8px">New workout ready, ${client.name.split(' ')[0]}! 🔥</h3>
                <p style="color:#444;line-height:1.6">Session: <strong>${wTitle}</strong>${wDate ? ` — scheduled for ${new Date(wDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}.</p>
                ${wNote ? `<p style="color:#444;font-style:italic;border-left:3px solid #c8f04a;padding-left:12px;margin:16px 0">"${wNote}"</p>` : ''}
                <a href="https://fittnessimo.vercel.app" style="display:inline-block;margin-top:20px;background:#111;color:#c8f04a;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">View my workout →</a>
              </div>`
            })
          })
        } catch(e) { console.log('Email skipped') }
      }
      showToast('Workout assigned! 🎉')
    }
    setWTitle(''); setWNote(''); setWClient(''); setWDate(''); setBulkStartDate(''); setBulkDays([])
    setExercises([{ name: '', sets: '', reps: '', load: '', videoLabel: '', videoUrl: '', comment: '' }])
    load()
    setSaving(false)
  }

  async function signOut() { await supabase.auth.signOut() }
  const updateEx = (i, field, val) => { const n = [...exercises]; n[i][field] = val; setExercises(n) }
  const unreadFeedback = feedback.filter(f => !f.coach_read).length

  return (
    <div style={s.shell}>
      {toast && <div style={s.toast}>{toast}</div>}
      <div style={s.sidebar}>
        <div style={s.logo}>fittnessimo<span style={{ color: '#c8f04a' }}>.</span></div>
        <div style={s.navLabel}>Menu</div>
        {TABS.map(t => (
          <button key={t} style={{ ...s.navBtn, ...(tab === t ? s.navActive : {}) }} onClick={() => setTab(t)}>
            {t === 'Clients' && '👥'}{t === 'Build workout' && '🏋️'}{t === 'Feedback' && '💬'}
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
                          <div style={s.sectionLabel}>{c.name}'s week</div>
                          <WeekView sessions={clientSessions} />
                          <div style={{ ...s.sectionLabel, marginTop: 12 }}>All sessions</div>
                          {clientSessions.length === 0
                            ? <p style={s.empty}>No sessions yet.</p>
                            : clientSessions.map(ws => {
                              const fb = feedback.find(f => f.session_id === ws.id)
                              const isExpanded = expandedSession === ws.id
                              return (
                                <div key={ws.id}>
                                  <div style={s.sessionRow} onClick={() => setExpandedSession(isExpanded ? null : ws.id)}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 500, fontSize: 14 }}>{ws.title}</div>
                                      <div style={s.clientSub}>
                                        {ws.scheduled_date
                                          ? new Date(ws.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                                          : 'No date set'}
                                      </div>
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
                                      {ws.exercises?.map((ex, i) => {
                                        const clientLog = fb?.logged_exercises?.[i]
                                        return (
                                          <div key={i} style={s.detailExRow}>
                                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ex.name}</div>
                                            {ex.comment && <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 6 }}>💡 {ex.comment}</div>}
                                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#555' }}>
                                              <span>Sets: <strong>{ex.sets || '—'}</strong></span>
                                              <span>Reps: <strong>{ex.reps || '—'}</strong></span>
                                              <span>Load: <strong>{ex.load || '—'}</strong></span>
                                            </div>
                                            {ex.videoUrl && <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={s.videoLink}>▶ {ex.videoLabel || 'Watch'}</a>}
                                            {clientLog && (
                                              <div style={s.clientLogged}>
                                                <div style={s.microLabel}>Client logged</div>
                                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#444' }}>
                                                  {clientLog.load && <span>kg: <strong>{clientLog.load}</strong></span>}
                                                  {clientLog.rpe && <span>RPE: <strong>{clientLog.rpe}</strong></span>}
                                                  {clientLog.comment && <div style={{ width: '100%', marginTop: 4, fontStyle: 'italic', color: '#666' }}>"{clientLog.comment}"</div>}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                      {fb && <CopySummaryButton ws={ws} fb={fb} clientName={c.name} />}
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
                <button style={s.btnPrimary} onClick={addClient} disabled={addingClient}>{addingClient ? 'Adding…' : 'Add client →'}</button>
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
              <label style={s.label}>Overall coach note</label>
              <textarea value={wNote} onChange={e => setWNote(e.target.value)} placeholder="General message for the client…" rows={2} style={{ ...s.inputSm, resize: 'none' }} />

              <div style={s.divider} />
              <div style={s.sectionLabel}>Schedule</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button style={{ ...s.btnSm, ...(assignMode === 'single' ? { background: '#111', color: '#c8f04a', border: '1px solid #111' } : {}) }} onClick={() => setAssignMode('single')}>Single date</button>
                <button style={{ ...s.btnSm, ...(assignMode === 'bulk' ? { background: '#111', color: '#c8f04a', border: '1px solid #111' } : {}) }} onClick={() => setAssignMode('bulk')}>Bulk (multiple days)</button>
              </div>

              {assignMode === 'single' && (
                <div>
                  <label style={s.label}>Session date</label>
                  <input type="date" value={wDate} onChange={e => setWDate(e.target.value)} style={s.inputSm} />
                </div>
              )}

              {assignMode === 'bulk' && (
                <div>
                  <label style={s.label}>Start from</label>
                  <input type="date" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} style={{ ...s.inputSm, marginBottom: 12 }} />
                  <label style={s.label}>Repeat on days</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {DAYS_OF_WEEK.map((d, i) => (
                      <button key={i} style={{ ...s.btnSm, ...(bulkDays.includes(i) ? { background: '#c8f04a', border: '1px solid #9aba2e', color: '#111', fontWeight: 600 } : {}) }}
                        onClick={() => setBulkDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}>
                        {d}
                      </button>
                    ))}
                  </div>
                  {bulkStartDate && bulkDays.length > 0 && (
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                      Will create {bulkDays.length} session{bulkDays.length !== 1 ? 's' : ''} starting {new Date(bulkStartDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                </div>
              )}

              <div style={s.divider} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={s.sectionLabel}>Exercises</div>
                <button style={{ ...s.btnSm, background: showImport ? '#111' : 'transparent', color: showImport ? '#c8f04a' : '#333' }} onClick={() => setShowImport(!showImport)}>
                  {showImport ? '✕ Close' : '⚡ Quick import from Claude'}
                </button>
              </div>

              {showImport && (
                <div style={s.importBox}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>Paste Claude workout format</div>
                  <textarea value={importText} onChange={e => setImportText(e.target.value)}
                    placeholder={`Exercise: Romanian Deadlift\nSets: 4 | Reps: 10-12 | Load: 60kg\nVideoLabel: RDL tutorial | Video: https://youtube.com/...\nComment: Drive through heels`}
                    rows={8} style={{ ...s.exInput, width: '100%', resize: 'vertical', marginTop: 4, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
                  <button style={{ ...s.btnPrimary, marginTop: 10 }} onClick={parseImport} disabled={!importText.trim()}>⚡ Import exercises →</button>
                </div>
              )}

              {exercises.map((ex, i) => (
                <div key={i} style={s.exBlock}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>Exercise {i + 1}</span>
                    <button style={s.btnIcon} onClick={() => setExercises(exercises.filter((_, j) => j !== i))}>✕ Remove</button>
                  </div>
                  <input value={ex.name} onChange={e => updateEx(i, 'name', e.target.value)} placeholder="Exercise name" style={{ ...s.exInput, marginBottom: 8, width: '100%' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div><div style={s.exLabel}>Sets</div><input value={ex.sets} onChange={e => updateEx(i, 'sets', e.target.value)} placeholder="3" style={{ ...s.exInput, textAlign: 'center' }} /></div>
                    <div><div style={s.exLabel}>Reps</div><input value={ex.reps} onChange={e => updateEx(i, 'reps', e.target.value)} placeholder="10" style={{ ...s.exInput, textAlign: 'center' }} /></div>
                    <div><div style={s.exLabel}>Load (kg)</div><input value={ex.load} onChange={e => updateEx(i, 'load', e.target.value)} placeholder="60" style={{ ...s.exInput, textAlign: 'center' }} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div><div style={s.exLabel}>Video label</div><input value={ex.videoLabel} onChange={e => updateEx(i, 'videoLabel', e.target.value)} placeholder="RDL tutorial" style={s.exInput} /></div>
                    <div><div style={s.exLabel}>Video URL</div><input value={ex.videoUrl} onChange={e => updateEx(i, 'videoUrl', e.target.value)} placeholder="https://youtube.com/…" style={s.exInput} /></div>
                  </div>
                  <div>
                    <div style={s.exLabel}>Coach cue (shown to client under exercise name)</div>
                    <textarea value={ex.comment} onChange={e => updateEx(i, 'comment', e.target.value)} placeholder="e.g. Drive through your heels, slow 3-sec eccentric" rows={2} style={{ ...s.exInput, resize: 'none', width: '100%' }} />
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
            {feedback.length === 0 && <p style={s.empty}>No feedback yet.</p>}
            {feedback.map(f => (
              <div key={f.id} style={{ ...s.card, marginBottom: 12, borderLeft: !f.coach_read ? '3px solid #c8f04a' : '3px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{f.workout_sessions?.clients?.name || 'Client'}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{f.workout_sessions?.title} · {new Date(f.created_at).toLocaleDateString()}</div>
                  </div>
                  {!f.coach_read && <button style={s.btnSm} onClick={async () => { await supabase.from('feedback').update({ coach_read: true }).eq('id', f.id); load() }}>Mark read</button>}
                </div>
                {f.feel && <div style={{ marginBottom: 8 }}><span style={s.feelPill}>{f.feel}</span></div>}
                {f.note && <p style={{ fontSize: 14, lineHeight: 1.6, color: '#333' }}>"{f.note}"</p>}
                {f.logged_exercises?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={s.sectionLabel}>Logged results</div>
                    {f.logged_exercises.map((ex, i) => (
                      <div key={i} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid #f0ede6' }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{ex.name}</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#888' }}>
                          {ex.load && <span>{ex.load} kg</span>}
                          {ex.rpe && <span>RPE {ex.rpe}</span>}
                        </div>
                        {ex.comment && <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 4 }}>"{ex.comment}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
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
  main: { flex: 1, padding: '2rem 2.5rem' },
  h1: { fontWeight: 700, fontSize: 24, letterSpacing: '-0.5px', marginBottom: '1.5rem' },
  grid2: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' },
  card: { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1rem' },
  cardTitle: { fontWeight: 600, fontSize: 16, marginBottom: '1rem' },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 },
  microLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bbb', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 5, display: 'block' },
  inputSm: { marginBottom: 12 },
  btnPrimary: { background: '#111', color: '#c8f04a', padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none', display: 'block', width: '100%' },
  btnSm: { background: 'transparent', border: '1px solid #e4e2dc', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#333', fontFamily: 'inherit' },
  btnIcon: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 12 },
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
