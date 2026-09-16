import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [assurance, setAssurance] = useState(null)
  const [loading, setLoading] = useState(true)

  const [authError, setAuthError] = useState('')

  const refreshAssurance = useCallback(async () => {
    if (!supabase) return null
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error) throw error
    setAssurance(data)
    return data
  }, [])

  useEffect(() => {
    let active = true
    let revision = 0
    if (!supabase) { setLoading(false); return }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      revision += 1
      setSession(next)
      setProfile(null)
      setAssurance(null)
      setAuthError('')
      setLoading(Boolean(next))
      const current = revision
      // Run database work after the auth callback releases its lock.
      if (next) setTimeout(async () => {
        if (!active || current !== revision) return
        try {
          const [profileResult, assuranceResult] = await Promise.all([
            supabase.from('profiles').select('id, name:full_name, role, active').eq('id', next.user.id).single(),
            supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          ])
          const { data, error } = profileResult
          if (error || !data?.active || !data?.name?.trim() || !['admin', 'gerente'].includes(data.role)) throw new Error('Não foi possível carregar um perfil válido. Verifique seu cadastro com o administrador.')
          if (assuranceResult.error) throw assuranceResult.error
          if (active && current === revision) {
            setProfile(data)
            setAssurance(assuranceResult.data)
          }
        } catch (error) {
          if (active && current === revision) setAuthError(error.message)
        } finally {
          if (active && current === revision) setLoading(false)
        }
      }, 0)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const mfaRequired = Boolean(session && assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')
  const value = { session, profile, assurance, mfaRequired, loading, authError, refreshAssurance, signIn, signOut: () => supabase.auth.signOut() }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
