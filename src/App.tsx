import React, { useState, useEffect } from 'react'
import { blink } from './blink/client'
import Dashboard from './components/Dashboard'
import AuthWrapper from './components/AuthWrapper'
import './App.css'

interface User {
  id: string
  email: string
  displayName?: string
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading BRYTT AI Platform...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthWrapper />
  }

  return (
    <div className="min-h-screen bg-background">
      <Dashboard user={user} />
    </div>
  )
}

export default App