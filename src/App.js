import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import CoachDashboard from './pages/CoachDashboard'
import ClientDashboard from './pages/ClientDashboard'

const COACH_EMAIL = process.env.REACT_APP_COACH_EMAIL

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <LogoMark />
    </div>
  )

  const isCoach = session?.user?.email === COACH_EMAIL

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/*" element={
          !session ? <Navigate to="/login" /> :
          isCoach ? <CoachDashboard session={session} /> :
          <ClientDashboard session={session} />
        } />
      </Routes>
    </BrowserRouter>
  )
}

function LogoMark() {
  return (
    <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px' }}>
      fittnessimo<span style={{ color: '#c8f04a' }}>.</span>
    </div>
  )
}
