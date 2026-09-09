import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(user) {
    if (!user) { setProfile(null); return }
    const { data, error } = await supabase.from('profiles').select('id, name, role').eq('id', user.id).single()
    if (error) throw new Error('Não foi possível carregar seu perfil. Verifique o cadastro na tabela profiles.')
    if (!['admin', 'gerente'].includes(data.role)) throw new Error('Perfil sem permissão válida.')
    setProfile(data)
  }

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      try { await loadProfile(data.session?.user) } finally { if (active) setLoading(false) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      Promise.resolve(loadProfile(next?.user)).catch(() => setProfile(null)).finally(() => setLoading(false))
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const value = useMemo(() => ({ session, profile, loading, signIn, signOut: () => supabase.auth.signOut() }), [session, profile, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
