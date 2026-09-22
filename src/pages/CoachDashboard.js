import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TABS = ['Clients', 'Build workout', 'Calendar', 'Feedback']
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getSessionStatus(ws, today) {
  const hasLogged = ws.feedback && ws.feedback.length > 0
  if (hasLogged) return 'logged'
  if (!ws.scheduled_date) return 'unscheduled'
  const todayStr = today.toISOString().split('T')[0]
  if (ws.scheduled_date === todayStr) return 'today'
  if (ws.scheduled_date < todayStr) return 'missed'
  return 'upcoming'
}

function CopySummaryButton({ ws, fb, clientName }) {
  const [copied, setCopied] = useState(false)
  function buildSummary() {
    const date = ws.scheduled_date
      ? new Date(ws.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
      : new Date(ws.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
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
      lines.push(`${i+1}. ${ex.name}`)
      lines.push(`   Target: ${ex.sets||'?'} sets x ${ex.reps||'?'} reps${ex.load && ex.load!=='-' ? ` @ ${ex.load}kg` : ''}`)
      if (log) {
        const parts = []
        if (log.load) parts.push(`kg used: ${log.load}`)
        if (log.rpe) parts.push(`RPE: ${log.rpe}`)
        if (parts.length) lines.push(`   Logged: ${parts.join(' | ')}`)
        if (log.comment) lines.push(`   Client note: "${log.comment}"`)
      } else lines.push(`   Logged: not submitted`)
      lines.push(``)
    })
    if (fb.note) { lines.push(`OVERALL CLIENT NOTE`); lines.push(`-------------------`); lines.push(`"${fb.note}"`); lines.push(``) }
    lines.push(`COACH ACTION NEEDED`)
    lines.push(`-------------------`)
    const highRPE = fb.logged_exercises?.filter(e => parseInt(e.rpe) >= 9)
    const pain = fb.logged_exercises?.filter(e => e.comment?.toLowerCase().includes('pain') || e.comment?.toLowerCase().includes('hurt'))
    const lightRPE = fb.logged_exercises?.filter(e => parseInt(e.rpe) <= 5 && e.rpe)
    if (highRPE?.length) lines.push(`- High RPE (9+) on: ${highRPE.map(e => e.name).join(', ')}`)
    if (pain?.length) lines.push(`- Pain reported on: ${pain.map(e => e.name).join(', ')}`)
    if (lightRPE?.length) lines.push(`- Low RPE (5 or under) on: ${lightRPE.map(e => e.name).join(', ')}`)
    if (fb.feel === '💪 Strong' || fb.feel === '🔥 PR day') lines.push(`- Client felt strong, consider progressive overload`)
    if (fb.feel === '😓 Tired' || fb.feel === '😣 Pain') lines.push(`- Client reported fatigue/pain, consider deload or substitution`)
    if (!highRPE?.length && !pain?.length && !lightRPE?.length) lines.push(`- Session appears well tolerated`)
    return lines.join('\n')
  }
  function handleCopy() {
    navigator.clipboard.writeText(buildSummary()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }
  return (
    <div style={{ marginTop:16, borderTop:'1px solid #e4e2dc', paddingTop:14 }}>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'#aaa', marginBottom:10 }}>Session summary for Claude</div>
      <button onClick={handleCopy} style={{ background: copied ? '#eafbe5' : '#111', color: copied ? '#2d7a30' : '#c8f04a', border:'none', borderRadius:10, padding:'10px 18px', fontWeight:600, fontSize:13, cursor:'pointer', width:'100%', fontFamily:'inherit' }}>
        {copied ? '✓ Copied! Paste into Claude' : '📋 Copy session summary'}
      </button>
    </div>
  )
}

function ExerciseLogDetail({ ws, fb }) {
  return (
    <div>
      {ws.exercises?.map((ex, i) => {
        const log = fb?.logged_exercises?.[i]
        return (
          <div key={i} style={{ background:'#fafaf8', borderRadius:8, padding:'10px 12px', marginBottom:8, border:'1px solid #f0ede6' }}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>{ex.name}</div>
            {ex.comment && <div style={{ fontSize:12, color:'#888', fontStyle:'italic', marginBottom:6 }}>💡 {ex.comment}</div>}
            <div style={{ fontSize:13, color:'#555', marginBottom: log ? 8 : 0 }}>
              Target: <strong>{ex.sets||'?'}×{ex.reps||'?'}{ex.load && ex.load!=='-' ? ` @ ${ex.load}kg` : ''}</strong>
            </div>
            {log ? (
              <div style={{ borderTop:'1px dashed #e4e2dc', paddingTop:8 }}>
                <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'#bbb', marginBottom:4 }}>Client logged</div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:13, color:'#333' }}>
                  {log.load && <span>kg: <strong>{log.load}</strong></span>}
                  {log.rpe && <span>RPE: <strong>{log.rpe}</strong></span>}
                </div>
                {log.comment && <p style={{ fontSize:12, color:'#666', fontStyle:'italic', marginTop:4 }}>"{log.comment}"</p>}
              </div>
            ) : (
              <div style={{ fontSize:12, color:'#bbb', fontStyle:'italic' }}>Not logged yet</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Edit workout modal
function EditWorkoutModal({ ws, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(ws.title || '')
  const [date, setDate] = useState(ws.scheduled_date || '')
  const [coachNote, setCoachNote] = useState(ws.coach_note || '')
  const [exercises, setExercises] = useState(ws.exercises ? JSON.parse(JSON.stringify(ws.exercises)) : [])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateEx = (i, field, val) => { const n=[...exercises]; n[i][field]=val; setExercises(n) }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('workout_sessions').update({
      title, scheduled_date: date || null, coach_note: coachNote, exercises
    }).eq('id', ws.id)
    if (!error) onSave()
    setSaving(false)
  }

  async function handleDelete() {
    await supabase.from('workout_sessions').delete().eq('id', ws.id)
    onDelete(ws)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'1.5rem', width:'100%', maxWidth:680, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <div style={{ fontWeight:700, fontSize:18 }}>Edit workout</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#aaa' }}>✕</button>
        </div>

        <div style={m.sectionLabel}>Session details</div>
        <label style={m.label}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={m.input} />
        <label style={m.label}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={m.input} />
        <label style={m.label}>Coach note</label>
        <textarea value={coachNote} onChange={e => setCoachNote(e.target.value)} rows={2} style={{ ...m.input, resize:'none' }} />

        <div style={{ borderTop:'1px solid #f0ede6', margin:'1rem 0' }} />
        <div style={m.sectionLabel}>Exercises</div>

        {exercises.map((ex, i) => (
          <div key={i} style={{ background:'#fafaf8', border:'1px solid #e4e2dc', borderRadius:12, padding:'1rem', marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontWeight:600, fontSize:13, color:'#555' }}>Exercise {i+1}</span>
              <button style={{ background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:12 }} onClick={() => setExercises(exercises.filter((_,j)=>j!==i))}>✕ Remove</button>
            </div>
            <input value={ex.name||''} onChange={e => updateEx(i,'name',e.target.value)} placeholder="Exercise name" style={{ ...m.input, marginBottom:8, width:'100%' }} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
              <div><div style={m.exLabel}>Sets</div><input value={ex.sets||''} onChange={e => updateEx(i,'sets',e.target.value)} placeholder="3" style={{ ...m.input, textAlign:'center' }} /></div>
              <div><div style={m.exLabel}>Reps</div><input value={ex.reps||''} onChange={e => updateEx(i,'reps',e.target.value)} placeholder="10" style={{ ...m.input, textAlign:'center' }} /></div>
              <div><div style={m.exLabel}>Load (kg)</div><input value={ex.load||''} onChange={e => updateEx(i,'load',e.target.value)} placeholder="60" style={{ ...m.input, textAlign:'center' }} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div><div style={m.exLabel}>Video label</div><input value={ex.videoLabel||''} onChange={e => updateEx(i,'videoLabel',e.target.value)} placeholder="Tutorial" style={m.input} /></div>
              <div><div style={m.exLabel}>Video URL</div><input value={ex.videoUrl||''} onChange={e => updateEx(i,'videoUrl',e.target.value)} placeholder="https://youtube.com/…" style={m.input} /></div>
            </div>
            <div style={m.exLabel}>Coach cue</div>
            <textarea value={ex.comment||''} onChange={e => updateEx(i,'comment',e.target.value)} placeholder="Coaching tip for client…" rows={2} style={{ ...m.input, resize:'none', width:'100%' }} />
          </div>
        ))}

        <button style={{ background:'transparent', border:'1px solid #e4e2dc', borderRadius:8, padding:'6px 14px', fontSize:13, cursor:'pointer', marginBottom:'1rem', fontFamily:'inherit' }}
          onClick={() => setExercises([...exercises, { name:'', sets:'', reps:'', load:'', videoLabel:'', videoUrl:'', comment:'' }])}>
          + Add exercise
        </button>

        <div style={{ display:'flex', gap:10, marginBottom:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, background:'#111', color:'#c8f04a', border:'none', borderRadius:10, padding:'12px', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
            {saving ? 'Saving…' : 'Save changes →'}
          </button>
          <button onClick={onClose} style={{ background:'transparent', border:'1px solid #e4e2dc', borderRadius:10, padding:'12px 20px', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        </div>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ width:'100%', background:'transparent', border:'1px solid #f5c6c6', borderRadius:10, padding:'10px', fontSize:13, cursor:'pointer', color:'#c0392b', fontFamily:'inherit' }}>
            🗑️ Delete this workout
          </button>
        ) : (
          <div style={{ background:'#fdecea', border:'1px solid #f5c6c6', borderRadius:10, padding:'12px', display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:13, color:'#c0392b', flex:1 }}>Delete this workout permanently?</span>
            <button onClick={handleDelete} style={{ background:'#c0392b', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Delete</button>
            <button onClick={() => setConfirmDelete(false)} style={{ background:'transparent', border:'1px solid #e4e2dc', borderRadius:8, padding:'6px 14px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

const m = {
  sectionLabel: { fontSize:11, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'#aaa', marginBottom:10 },
  label: { fontSize:13, fontWeight:500, color:'#555', marginBottom:5, display:'block', marginTop:8 },
  input: { padding:'8px 10px', border:'1px solid #e4e2dc', borderRadius:8, fontSize:13, background:'#fafaf8', color:'#111', width:'100%', marginBottom:4, fontFamily:'inherit' },
  exLabel: { fontSize:10, color:'#aaa', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 },
}

export default function CoachDashboard({ session }) {
  const [tab, setTab] = useState('Clients')
  const [clients, setClients] = useState([])
  const [sessions, setSessions] = useState([])
  const [feedback, setFeedback] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [expandedSession, setExpandedSession] = useState(null)
  const [editingSession, setEditingSession] = useState(null)
  const [expandedFeedback, setExpandedFeedback] = useState(null)
  const [expandedCalDay, setExpandedCalDay] = useState(null)
  const [undoSession, setUndoSession] = useState(null)
  const [undoTimer, setUndoTimer] = useState(null)
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [calMonth, setCalMonth] = useState(new Date())
  const [calSelectedDay, setCalSelectedDay] = useState(null)
  const today = new Date()

  // Build workout state
  const [wTitle, setWTitle] = useState('')
  const [wNote, setWNote] = useState('')
  const [wClient, setWClient] = useState('')
  const [wDate, setWDate] = useState('')
  const [assignMode, setAssignMode] = useState('single')
  const [bulkStartDate, setBulkStartDate] = useState('')
  const [bulkDays, setBulkDays] = useState([])
  const [exercises, setExercises] = useState([{ name:'', sets:'', reps:'', load:'', videoLabel:'', videoUrl:'', comment:'' }])
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function parseImport() {
    if (!importText.trim()) return
    const rawBlocks = importText.trim().split(/(?=Exercise:)/i).filter(b => b.trim())
    const parsed = rawBlocks.map(block => {
      const ex = { name:'', sets:'', reps:'', load:'', videoLabel:'', videoUrl:'', comment:'' }
      const pairs = []
      block.trim().split('\n').forEach(line => line.split('|').forEach(seg => pairs.push(seg.trim())))
      pairs.forEach(seg => {
        const lower = seg.toLowerCase()
        const isEmpty = (v) => !v || v==='-' || v==='—' || v.toLowerCase()==='n/a' || v.toLowerCase()==='none'
        if (lower.startsWith('exercise:')) ex.name = seg.slice(9).trim()
        else if (lower.startsWith('sets:')) { const v=seg.slice(5).trim(); if (!isEmpty(v)) ex.sets=v }
        else if (lower.startsWith('reps:')) { const v=seg.slice(5).trim(); if (!isEmpty(v)) ex.reps=v }
        else if (lower.startsWith('load:')) { const v=seg.slice(5).replace(/kg$/i,'').trim(); if (!isEmpty(v)) ex.load=v }
        else if (lower.startsWith('videolabel:')) { const v=seg.slice(11).trim(); if (!isEmpty(v)) ex.videoLabel=v }
        else if (lower.startsWith('video:')) { const v=seg.slice(6).trim(); if (!isEmpty(v)) ex.videoUrl=v }
        else if (lower.startsWith('comment:')) { const v=seg.slice(8).trim(); if (!isEmpty(v)) ex.comment=v }
      })
      return ex
    }).filter(e => e.name)
    if (parsed.length > 0) { setExercises(parsed); setImportText(''); setShowImport(false); showToast(`✓ ${parsed.length} exercises imported!`) }
  }

  const load = useCallback(async () => {
    const { data: c } = await supabase.from('clients').select('*').order('created_at')
    setClients(c || [])
    const { data: s } = await supabase.from('workout_sessions').select('*, feedback(*)').order('scheduled_date', { ascending:true, nullsFirst:false })
    setSessions(s || [])
    const { data: f } = await supabase.from('feedback').select('*, workout_sessions(title, scheduled_date, exercises, clients(name))').order('created_at', { ascending:false })
    setFeedback(f || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function addClient() {
    if (!newClientEmail || !newClientName) return
    setAddingClient(true)
    const { error } = await supabase.from('clients').insert({ email:newClientEmail.toLowerCase().trim(), name:newClientName })
    if (!error) { showToast('Client added!'); setNewClientEmail(''); setNewClientName(''); load() }
    setAddingClient(false)
  }

  async function saveWorkout() {
    if (!wTitle || !wClient) return
    setSaving(true)
    const client = clients.find(c => c.id === wClient)
    const exs = exercises.filter(e => e.name)
    if (assignMode === 'bulk' && bulkStartDate && bulkDays.length > 0) {
      const start = new Date(bulkStartDate + 'T00:00:00')
      const dates = []
      for (let i = 0; i < 28 && dates.length < bulkDays.length; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i)
        if (bulkDays.includes(d.getDay())) dates.push(d.toISOString().split('T')[0])
      }
      for (const date of dates) {
        await supabase.from('workout_sessions').insert({ client_id:wClient, title:wTitle, coach_note:wNote, exercises:exs, links:[], scheduled_date:date })
      }
      showToast(`✓ ${dates.length} sessions assigned!`)
    } else {
      await supabase.from('workout_sessions').insert({ client_id:wClient, title:wTitle, coach_note:wNote, exercises:exs, links:[], scheduled_date:wDate||null })
      if (client?.email) {
        try {
          await fetch('https://api.resend.com/emails', {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.REACT_APP_RESEND_KEY}` },
            body: JSON.stringify({
              from:'Fittnessimo <onboarding@resend.dev>',
              to: client.email,
              subject:`💪 New workout just dropped, ${client.name.split(' ')[0]}!`,
              html:`<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px"><h2 style="font-weight:800">fittnessimo<span style="color:#c8f04a">.</span></h2><h3>New workout ready, ${client.name.split(' ')[0]}! 🔥</h3><p style="color:#444">Session: <strong>${wTitle}</strong>${wDate ? ` on ${new Date(wDate+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}` : ''}.</p>${wNote?`<p style="border-left:3px solid #c8f04a;padding-left:12px;font-style:italic">"${wNote}"</p>`:''}<a href="https://fittnessimo.vercel.app" style="display:inline-block;margin-top:20px;background:#111;color:#c8f04a;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">View my workout →</a></div>`
            })
          })
        } catch(e) {}
      }
      showToast('Workout assigned! 🎉')
    }
    setWTitle(''); setWNote(''); setWClient(''); setWDate(''); setBulkStartDate(''); setBulkDays([])
    setExercises([{ name:'', sets:'', reps:'', load:'', videoLabel:'', videoUrl:'', comment:'' }])
    load(); setSaving(false)
  }

  function handleDeletedSession(ws) {
    setEditingSession(null)
    setUndoSession(ws)
    showToast('Workout deleted')
    load()
    const timer = setTimeout(() => { setUndoSession(null) }, 6000)
    setUndoTimer(timer)
  }

  async function handleUndo() {
    if (!undoSession) return
    clearTimeout(undoTimer)
    const { exercises, feedback, ...wsData } = undoSession
    await supabase.from('workout_sessions').insert({ ...wsData, id: undefined })
    setUndoSession(null)
    showToast('Workout restored!')
    load()
  }

  async function signOut() { await supabase.auth.signOut() }
  const updateEx = (i, field, val) => { const n=[...exercises]; n[i][field]=val; setExercises(n) }
  const unreadFeedback = feedback.filter(f => !f.coach_read).length

  // Get existing session dates for a given client (to highlight in date picker)
  const clientSessionDates = wClient
    ? sessions.filter(ws => ws.client_id === wClient && ws.scheduled_date).map(ws => ws.scheduled_date)
    : []

  // Build month calendar
  function buildMonthCal() {
    const year = calMonth.getFullYear()
    const month = calMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month+1, 0).getDate()
    const todayStr = today.toISOString().split('T')[0]
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const daySessions = sessions.filter(ws => ws.scheduled_date === dStr)
      cells.push({ d, dStr, daySessions, isToday: dStr === todayStr })
    }
    return cells
  }

  const monthCells = buildMonthCal()
  const calDaySessions = calSelectedDay ? sessions.filter(ws => ws.scheduled_date === calSelectedDay) : []
  const todayStr = today.toISOString().split('T')[0]
  const todaySessions = sessions.filter(ws => ws.scheduled_date === todayStr)

  return (
    <div style={s.shell}>
      {toast && <div style={s.toast}>{toast}</div>}
      {editingSession && (
        <EditWorkoutModal
          ws={editingSession}
          onClose={() => setEditingSession(null)}
          onSave={() => { setEditingSession(null); showToast('Workout updated!'); load() }}
          onDelete={handleDeletedSession}
        />
      )}
      {undoSession && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#333', color:'#fff', padding:'12px 20px', borderRadius:12, fontSize:14, zIndex:1001, display:'flex', alignItems:'center', gap:12, boxShadow:'0 4px 20px rgba(0,0,0,0.3)' }}>
          <span>Workout deleted</span>
          <button onClick={handleUndo} style={{ background:'#c8f04a', color:'#111', border:'none', borderRadius:8, padding:'5px 14px', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Undo</button>
        </div>
      )}

      <div style={s.sidebar}>
        <div style={s.logo}>fittnessimo<span style={{ color:'#c8f04a' }}>.</span></div>
        <div style={s.navLabel}>Menu</div>
        {TABS.map(t => (
          <button key={t} style={{ ...s.navBtn, ...(tab===t ? s.navActive : {}) }} onClick={() => setTab(t)}>
            {t==='Clients'&&'👥'}{t==='Build workout'&&'🏋️'}{t==='Calendar'&&'📅'}{t==='Feedback'&&'💬'}
            <span style={{ marginLeft:8 }}>{t}</span>
            {t==='Feedback' && unreadFeedback > 0 && <span style={s.badge}>{unreadFeedback}</span>}
          </button>
        ))}
        <div style={{ flex:1 }} />
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
                        <div style={{ flex:1 }}>
                          <div style={s.clientName}>{c.name}</div>
                          <div style={s.clientSub}>{c.email} · {clientSessions.length} session{clientSessions.length!==1?'s':''}</div>
                        </div>
                        <button style={s.btnSm} onClick={() => { setSelectedClient(isSelected?null:c); setExpandedSession(null) }}>
                          {isSelected ? 'Close' : 'Sessions'}
                        </button>
                      </div>
                      {isSelected && (
                        <div style={s.sessionList}>
                          <div style={s.sectionLabel}>All sessions</div>
                          {clientSessions.length === 0
                            ? <p style={s.empty}>No sessions yet.</p>
                            : clientSessions.map(ws => {
                              const fb = feedback.find(f => f.session_id === ws.id)
                              const isExpanded = expandedSession === ws.id
                              const status = getSessionStatus(ws, today)
                              return (
                                <div key={ws.id}>
                                  <div style={s.sessionRow} onClick={() => setExpandedSession(isExpanded?null:ws.id)}>
                                    <div style={{ flex:1 }}>
                                      <div style={{ fontWeight:500, fontSize:14 }}>{ws.title}</div>
                                      <div style={s.clientSub}>{ws.scheduled_date ? new Date(ws.scheduled_date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) : 'No date'}</div>
                                    </div>
                                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                      {status==='logged'?<span style={s.tagGreen}>Done ✓</span>:status==='missed'?<span style={s.tagRed}>Missed</span>:status==='today'?<span style={s.tagAmber}>Today</span>:<span style={s.tagGrey}>Upcoming</span>}
                                      <button style={{ ...s.btnSm, fontSize:11, padding:'3px 8px' }} onClick={e => { e.stopPropagation(); setEditingSession(ws) }}>✏️ Edit</button>
                                      <span style={{ color:'#aaa', fontSize:12 }}>{isExpanded?'▲':'▼'}</span>
                                    </div>
                                  </div>
                                  {isExpanded && (
                                    <div style={s.sessionDetail}>
                                      {ws.coach_note && (
                                        <div style={s.noteBox}>
                                          <div style={s.microLabel}>Coach note</div>
                                          <p style={{ fontSize:13, fontStyle:'italic', color:'#444', margin:0 }}>"{ws.coach_note}"</p>
                                        </div>
                                      )}
                                      <ExerciseLogDetail ws={ws} fb={fb} />
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
                <button style={s.btnPrimary} onClick={addClient} disabled={addingClient}>{addingClient?'Adding…':'Add client →'}</button>
              </div>
            </div>
          </div>
        )}

        {/* BUILD WORKOUT TAB */}
        {tab === 'Build workout' && (
          <div style={{ maxWidth:720 }}>
            <h1 style={s.h1}>Build workout</h1>
            <div style={s.card}>
              <div style={s.sectionLabel}>Session details</div>
              <label style={s.label}>Assign to</label>
              <select value={wClient} onChange={e => { setWClient(e.target.value); setWDate('') }} style={s.inputSm}>
                <option value="">Choose a client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label style={s.label}>Session title</label>
              <input value={wTitle} onChange={e => setWTitle(e.target.value)} placeholder="e.g. Lower body A" style={s.inputSm} />
              <label style={s.label}>Overall coach note</label>
              <textarea value={wNote} onChange={e => setWNote(e.target.value)} placeholder="General message for the client…" rows={2} style={{ ...s.inputSm, resize:'none' }} />

              <div style={s.divider} />
              <div style={s.sectionLabel}>Schedule</div>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                <button style={{ ...s.btnSm, ...(assignMode==='single'?{background:'#111',color:'#c8f04a',border:'1px solid #111'}:{}) }} onClick={() => setAssignMode('single')}>Single date</button>
                <button style={{ ...s.btnSm, ...(assignMode==='bulk'?{background:'#111',color:'#c8f04a',border:'1px solid #111'}:{}) }} onClick={() => setAssignMode('bulk')}>Bulk (multiple days)</button>
              </div>

              {assignMode === 'single' && (
                <div>
                  <label style={s.label}>Session date</label>
                  <input type="date" value={wDate} onChange={e => setWDate(e.target.value)} style={s.inputSm} />
                  {/* Existing sessions for selected client */}
                  {wClient && clientSessionDates.length > 0 && (
                    <div style={{ marginTop:4, marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#aaa', marginBottom:8 }}>Already scheduled for this client</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {clientSessionDates.sort().map((d, i) => {
                          const conflict = wDate && (d === wDate || Math.abs(new Date(d) - new Date(wDate)) === 86400000)
                          return (
                            <span key={i} style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background: conflict ? '#fdecea' : '#f0fde4', color: conflict ? '#c0392b' : '#2d7a30', fontWeight:500, border: conflict ? '1px solid #f5c6c6' : '1px solid #c8f04a' }}>
                              {conflict ? '⚠️ ' : '★ '}
                              {new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
                            </span>
                          )
                        })}
                      </div>
                      {wDate && clientSessionDates.includes(wDate) && (
                        <div style={{ fontSize:12, color:'#c0392b', marginTop:8, fontWeight:500 }}>⚠️ This client already has a session on this date.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {assignMode === 'bulk' && (
                <div>
                  <label style={s.label}>Start from</label>
                  <input type="date" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} style={{ ...s.inputSm, marginBottom:12 }} />
                  <label style={s.label}>Repeat on days</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                    {DAYS_OF_WEEK.map((d,i) => (
                      <button key={i} style={{ ...s.btnSm, ...(bulkDays.includes(i)?{background:'#c8f04a',border:'1px solid #9aba2e',color:'#111',fontWeight:600}:{}) }}
                        onClick={() => setBulkDays(prev => prev.includes(i)?prev.filter(x=>x!==i):[...prev,i].sort())}>{d}</button>
                    ))}
                  </div>
                  {bulkStartDate && bulkDays.length > 0 && <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>Will create {bulkDays.length} session{bulkDays.length!==1?'s':''}</div>}
                  {wClient && clientSessionDates.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#aaa', marginBottom:8 }}>Already scheduled for this client</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {clientSessionDates.sort().map((d, i) => (
                          <span key={i} style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:'#f0fde4', color:'#2d7a30', fontWeight:500, border:'1px solid #c8f04a' }}>
                            ★ {new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={s.divider} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={s.sectionLabel}>Exercises</div>
                <button style={{ ...s.btnSm, background:showImport?'#111':'transparent', color:showImport?'#c8f04a':'#333' }} onClick={() => setShowImport(!showImport)}>
                  {showImport?'✕ Close':'⚡ Quick import from Claude'}
                </button>
              </div>

              {showImport && (
                <div style={s.importBox}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'#888', marginBottom:8 }}>Paste Claude workout format</div>
                  <textarea value={importText} onChange={e => setImportText(e.target.value)}
                    placeholder={`Exercise: Romanian Deadlift\nSets: 4 | Reps: 10-12 | Load: 60kg\nVideoLabel: RDL tutorial | Video: https://youtube.com/...\nComment: Drive through heels`}
                    rows={8} style={{ ...s.exInput, width:'100%', resize:'vertical', marginTop:4, fontFamily:'monospace', fontSize:12, lineHeight:1.6 }} />
                  <button style={{ ...s.btnPrimary, marginTop:10 }} onClick={parseImport} disabled={!importText.trim()}>⚡ Import exercises →</button>
                </div>
              )}

              {exercises.map((ex, i) => (
                <div key={i} style={s.exBlock}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <span style={{ fontWeight:600, fontSize:13, color:'#555' }}>Exercise {i+1}</span>
                    <button style={s.btnIcon} onClick={() => setExercises(exercises.filter((_,j)=>j!==i))}>✕ Remove</button>
                  </div>
                  <input value={ex.name} onChange={e => updateEx(i,'name',e.target.value)} placeholder="Exercise name" style={{ ...s.exInput, marginBottom:8, width:'100%' }} />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                    <div><div style={s.exLabel}>Sets</div><input value={ex.sets} onChange={e => updateEx(i,'sets',e.target.value)} placeholder="3" style={{ ...s.exInput, textAlign:'center' }} /></div>
                    <div><div style={s.exLabel}>Reps</div><input value={ex.reps} onChange={e => updateEx(i,'reps',e.target.value)} placeholder="10" style={{ ...s.exInput, textAlign:'center' }} /></div>
                    <div><div style={s.exLabel}>Load (kg)</div><input value={ex.load} onChange={e => updateEx(i,'load',e.target.value)} placeholder="60" style={{ ...s.exInput, textAlign:'center' }} /></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    <div><div style={s.exLabel}>Video label</div><input value={ex.videoLabel} onChange={e => updateEx(i,'videoLabel',e.target.value)} placeholder="RDL tutorial" style={s.exInput} /></div>
                    <div><div style={s.exLabel}>Video URL</div><input value={ex.videoUrl} onChange={e => updateEx(i,'videoUrl',e.target.value)} placeholder="https://youtube.com/…" style={s.exInput} /></div>
                  </div>
                  <div>
                    <div style={s.exLabel}>Coach cue</div>
                    <textarea value={ex.comment} onChange={e => updateEx(i,'comment',e.target.value)} placeholder="e.g. Drive through heels, slow 3-sec eccentric" rows={2} style={{ ...s.exInput, resize:'none', width:'100%' }} />
                  </div>
                </div>
              ))}

              <button style={s.btnSm} onClick={() => setExercises([...exercises,{name:'',sets:'',reps:'',load:'',videoLabel:'',videoUrl:'',comment:''}])}>+ Add exercise</button>
              <div style={s.divider} />
              <button style={s.btnPrimary} onClick={saveWorkout} disabled={saving||!wTitle||!wClient}>{saving?'Assigning…':'Assign to client →'}</button>
            </div>
          </div>
        )}

        {/* CALENDAR TAB */}
        {tab === 'Calendar' && (
          <div>
            <h1 style={s.h1}>Calendar</h1>
            <div style={s.grid2}>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <button style={s.btnSm} onClick={() => setCalMonth(m => { const n=new Date(m); n.setMonth(n.getMonth()-1); return n })}>← Prev</button>
                  <div style={{ fontWeight:700, fontSize:18 }}>{calMonth.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div>
                  <button style={s.btnSm} onClick={() => setCalMonth(m => { const n=new Date(m); n.setMonth(n.getMonth()+1); return n })}>Next →</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:6 }}>
                  {DAYS_OF_WEEK.map(d => <div key={d} style={{ fontSize:11, fontWeight:600, color:'#aaa', textAlign:'center', padding:'4px 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d.slice(0,1)}</div>)}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                  {monthCells.map((cell, i) => {
                    if (!cell) return <div key={i} />
                    const hasSessions = cell.daySessions.length > 0
                    const allDone = hasSessions && cell.daySessions.every(ws => ws.feedback && ws.feedback.length > 0)
                    const someDone = hasSessions && cell.daySessions.some(ws => ws.feedback && ws.feedback.length > 0)
                    const isSelected = calSelectedDay === cell.dStr
                    return (
                      <div key={i}
                        style={{ minHeight:56, borderRadius:10, background: isSelected?'#111':cell.isToday?'#f0fde4':hasSessions?'#fff':'#f7f6f3', border: isSelected?'1px solid #c8f04a':hasSessions?'1px solid #e4e2dc':'1px solid transparent', cursor:hasSessions?'pointer':'default', padding:'6px 4px', textAlign:'center' }}
                        onClick={() => hasSessions && setCalSelectedDay(isSelected?null:cell.dStr)}
                      >
                        <div style={{ fontSize:13, fontWeight:600, color:isSelected?'#fff':cell.isToday?'#2d7a30':'#333', marginBottom:2 }}>{cell.d}</div>
                        {hasSessions && (
                          <>
                            <div style={{ fontSize:12, color:allDone?'#2d7a30':someDone?'#9a6800':'#888' }}>★</div>
                            <div style={{ fontSize:8, color:isSelected?'#aaa':'#888', lineHeight:1.2 }}>{cell.daySessions.length}s</div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display:'flex', gap:16, marginTop:14, flexWrap:'wrap', fontSize:12, color:'#888' }}>
                  <span><span style={{ color:'#2d7a30' }}>★</span> All done</span>
                  <span><span style={{ color:'#9a6800' }}>★</span> Partial</span>
                  <span><span style={{ color:'#888' }}>★</span> Pending</span>
                </div>
              </div>

              {/* Right panel: today's sessions always shown, selected day on click */}
              <div>
                {/* Today's sessions - always visible, collapsible */}
                {todaySessions.length > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:10, color:'#2d7a30' }}>Today 📅</div>
                    {todaySessions.map(ws => {
                      const fb = feedback.find(f => f.session_id === ws.id)
                      const client = clients.find(c => c.id === ws.client_id)
                      const isExpanded = expandedCalDay === `today-${ws.id}`
                      return (
                        <div key={ws.id} style={{ ...s.card, marginBottom:8, padding:'0.875rem 1rem' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={() => setExpandedCalDay(isExpanded?null:`today-${ws.id}`)}>
                            <div>
                              <div style={{ fontWeight:600, fontSize:14 }}>{client?.name}</div>
                              <div style={{ fontSize:12, color:'#888' }}>{ws.title}</div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              {fb ? <span style={s.tagGreen}>Done ✓</span> : <span style={s.tagAmber}>Pending</span>}
                              <span style={{ color:'#aaa', fontSize:12 }}>{isExpanded?'▲':'▼'}</span>
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ marginTop:12, borderTop:'1px solid #f0ede6', paddingTop:12 }}>
                              <ExerciseLogDetail ws={ws} fb={fb} />
                              {fb && client && <CopySummaryButton ws={ws} fb={fb} clientName={client.name} />}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Selected day detail */}
                {calSelectedDay && calSelectedDay !== todayStr && (
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>
                      {new Date(calSelectedDay+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
                    </div>
                    {calDaySessions.map(ws => {
                      const fb = feedback.find(f => f.session_id === ws.id)
                      const client = clients.find(c => c.id === ws.client_id)
                      const status = getSessionStatus(ws, today)
                      const isExpanded = expandedCalDay === ws.id
                      return (
                        <div key={ws.id} style={{ ...s.card, marginBottom:8, padding:'0.875rem 1rem' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={() => setExpandedCalDay(isExpanded?null:ws.id)}>
                            <div>
                              <div style={{ fontWeight:600, fontSize:14 }}>{client?.name}</div>
                              <div style={{ fontSize:12, color:'#888' }}>{ws.title}</div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              {status==='logged'?<span style={s.tagGreen}>Done ✓</span>:status==='missed'?<span style={s.tagRed}>Missed</span>:<span style={s.tagGrey}>Upcoming</span>}
                              <button style={{ ...s.btnSm, fontSize:11, padding:'3px 8px' }} onClick={e => { e.stopPropagation(); setEditingSession(ws) }}>✏️</button>
                              <span style={{ color:'#aaa', fontSize:12 }}>{isExpanded?'▲':'▼'}</span>
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ marginTop:12, borderTop:'1px solid #f0ede6', paddingTop:12 }}>
                              <ExerciseLogDetail ws={ws} fb={fb} />
                              {fb && client && <CopySummaryButton ws={ws} fb={fb} clientName={client.name} />}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {!calSelectedDay && todaySessions.length === 0 && (
                  <div style={{ color:'#aaa', fontSize:14, paddingTop:'2rem', textAlign:'center' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
                    No sessions today. Click a ★ day to see sessions.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK TAB */}
        {tab === 'Feedback' && (
          <div>
            <h1 style={s.h1}>Client feedback</h1>
            {feedback.length === 0 && <p style={s.empty}>No feedback yet.</p>}
            {feedback.map(f => {
              const isExpanded = expandedFeedback === f.id
              return (
                <div key={f.id} style={{ ...s.card, marginBottom:10, borderLeft: !f.coach_read ? '3px solid #c8f04a' : '3px solid transparent', padding:'0.875rem 1.25rem' }}>
                  {/* Collapsed header — always visible */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={() => setExpandedFeedback(isExpanded?null:f.id)}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontWeight:600, fontSize:15 }}>{f.workout_sessions?.clients?.name || 'Client'}</div>
                        {!f.coach_read && <span style={{ fontSize:10, background:'#c8f04a', color:'#111', fontWeight:700, padding:'2px 7px', borderRadius:20 }}>NEW</span>}
                      </div>
                      <div style={{ fontSize:13, color:'#888', marginTop:2 }}>
                        {f.workout_sessions?.title}
                        {f.workout_sessions?.scheduled_date ? ` · ${new Date(f.workout_sessions.scheduled_date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}` : ''}
                        {f.feel ? ` · ${f.feel}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {!f.coach_read && <button style={{ ...s.btnSm, fontSize:11, padding:'3px 8px' }} onClick={async e => { e.stopPropagation(); await supabase.from('feedback').update({coach_read:true}).eq('id',f.id); load() }}>Mark read</button>}
                      <span style={{ color:'#aaa', fontSize:12 }}>{isExpanded?'▲':'▼'}</span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ marginTop:14, borderTop:'1px solid #f0ede6', paddingTop:14 }}>
                      {f.note && <p style={{ fontSize:14, lineHeight:1.6, color:'#333', marginBottom:12 }}>"{f.note}"</p>}
                      {f.logged_exercises?.length > 0 && (
                        <div>
                          <div style={s.sectionLabel}>Exercise results</div>
                          {f.logged_exercises.map((ex, i) => {
                            const target = f.workout_sessions?.exercises?.[i]
                            return (
                              <div key={i} style={{ background:'#fafaf8', borderRadius:8, padding:'10px 12px', marginBottom:8, border:'1px solid #f0ede6' }}>
                                <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>{ex.name}</div>
                                {target && <div style={{ fontSize:12, color:'#aaa', marginBottom:6 }}>Target: {target.sets}×{target.reps}{target.load && target.load!=='-' ? ` @ ${target.load}kg` : ''}</div>}
                                <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:13, color:'#333' }}>
                                  {ex.load && <span>kg used: <strong>{ex.load}</strong></span>}
                                  {ex.rpe && <span>RPE: <strong>{ex.rpe}</strong></span>}
                                </div>
                                {ex.comment && <p style={{ fontSize:12, color:'#666', fontStyle:'italic', marginTop:4 }}>"{ex.comment}"</p>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {f.workout_sessions && <CopySummaryButton ws={f.workout_sessions} fb={f} clientName={f.workout_sessions?.clients?.name || 'Client'} />}
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
  shell: { display:'flex', minHeight:'100vh', background:'#f7f6f3' },
  sidebar: { width:220, background:'#111111', padding:'1.5rem 1rem', display:'flex', flexDirection:'column', gap:4, position:'sticky', top:0, height:'100vh' },
  logo: { fontWeight:800, fontSize:20, letterSpacing:'-0.5px', color:'#fff', marginBottom:'1.5rem' },
  navLabel: { fontSize:10, fontWeight:600, letterSpacing:'0.08em', color:'#555', textTransform:'uppercase', marginBottom:6 },
  navBtn: { display:'flex', alignItems:'center', padding:'10px 12px', borderRadius:8, background:'transparent', color:'#aaa', fontSize:14, fontWeight:500, cursor:'pointer', border:'none', width:'100%', textAlign:'left' },
  navActive: { background:'#222', color:'#fff' },
  badge: { marginLeft:'auto', background:'#c8f04a', color:'#111', fontSize:11, fontWeight:700, borderRadius:20, padding:'1px 7px' },
  signOutBtn: { background:'transparent', color:'#555', fontSize:13, padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer', textAlign:'left' },
  main: { flex:1, padding:'2rem 2.5rem' },
  h1: { fontWeight:700, fontSize:24, letterSpacing:'-0.5px', marginBottom:'1.5rem' },
  grid2: { display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:'1.5rem' },
  card: { background:'#fff', border:'1px solid #e4e2dc', borderRadius:16, padding:'1.25rem 1.5rem', marginBottom:'1rem' },
  cardTitle: { fontWeight:600, fontSize:16, marginBottom:'1rem' },
  sectionLabel: { fontSize:11, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'#aaa', marginBottom:10 },
  microLabel: { fontSize:10, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'#bbb', marginBottom:4 },
  label: { fontSize:13, fontWeight:500, color:'#555', marginBottom:5, display:'block' },
  inputSm: { marginBottom:12 },
  btnPrimary: { background:'#111', color:'#c8f04a', padding:'11px 20px', borderRadius:10, fontWeight:600, fontSize:14, cursor:'pointer', border:'none', display:'block', width:'100%' },
  btnSm: { background:'transparent', border:'1px solid #e4e2dc', borderRadius:8, padding:'6px 12px', fontSize:13, cursor:'pointer', color:'#333', fontFamily:'inherit' },
  btnIcon: { background:'transparent', border:'none', cursor:'pointer', color:'#aaa', fontSize:12 },
  divider: { border:'none', borderTop:'1px solid #f0ede6', margin:'1.25rem 0' },
  exLabel: { fontSize:10, color:'#aaa', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 },
  exInput: { padding:'8px 10px', border:'1px solid #e4e2dc', borderRadius:8, fontSize:13, background:'#fafaf8', color:'#111', width:'100%' },
  exBlock: { background:'#fafaf8', border:'1px solid #e4e2dc', borderRadius:12, padding:'1rem', marginBottom:10 },
  importBox: { background:'#111', borderRadius:12, padding:'1rem 1.25rem', marginBottom:14 },
  clientCard: { background:'#fff', border:'1px solid #e4e2dc', borderRadius:12, padding:'1rem', marginBottom:8, display:'flex', alignItems:'center', gap:12 },
  avatar: { width:40, height:40, borderRadius:'50%', background:'#c8f04a', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, color:'#111', flexShrink:0 },
  clientName: { fontWeight:500, fontSize:15 },
  clientSub: { fontSize:12, color:'#888580', marginTop:2 },
  sessionList: { background:'#fafaf8', border:'1px solid #e4e2dc', borderRadius:12, padding:'1rem', marginBottom:10 },
  sessionRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f0ede6', cursor:'pointer' },
  sessionDetail: { background:'#fff', border:'1px solid #e4e2dc', borderRadius:10, padding:'1rem', marginBottom:8 },
  noteBox: { background:'#fffdf5', border:'1px solid #f0ede6', borderLeft:'3px solid #c8f04a', borderRadius:8, padding:'10px 12px', marginBottom:12 },
  tagGreen: { fontSize:12, padding:'3px 10px', borderRadius:20, background:'#eafbe5', color:'#2d7a30', fontWeight:500, flexShrink:0 },
  tagAmber: { fontSize:12, padding:'3px 10px', borderRadius:20, background:'#fef3dc', color:'#9a6800', fontWeight:500, flexShrink:0 },
  tagRed: { fontSize:12, padding:'3px 10px', borderRadius:20, background:'#fdecea', color:'#c0392b', fontWeight:500, flexShrink:0 },
  tagGrey: { fontSize:12, padding:'3px 10px', borderRadius:20, background:'#f0ede6', color:'#555', fontWeight:500, flexShrink:0 },
  empty: { color:'#aaa', fontSize:14, padding:'1rem 0' },
  toast: { position:'fixed', bottom:24, right:24, background:'#111', color:'#c8f04a', padding:'10px 20px', borderRadius:10, fontSize:14, fontWeight:500, zIndex:999 },
  feelPill: { background:'#f0ede6', padding:'3px 10px', borderRadius:20, fontSize:13 },
}
