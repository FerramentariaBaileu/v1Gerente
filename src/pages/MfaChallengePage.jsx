import { useEffect, useState } from 'react'
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function MfaChallengePage() {
  const { refreshAssurance, signOut } = useAuth()
  const navigate = useNavigate()
  const [factor, setFactor] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.mfa.listFactors().then(({ data, error: loadError }) => {
      if (!mounted) return
      if (loadError) setError('Não foi possível carregar o segundo fator.')
      else {
        const verified = [...(data?.totp ?? []), ...(data?.phone ?? [])].find((item) => item.status === 'verified')
        setFactor(verified ?? null)
        if (!verified) setError('Nenhum segundo fator válido foi encontrado. Saia e peça ajuda ao administrador.')
      }
      setBusy(false)
    })
    return () => { mounted = false }
  }, [])

  async function verify(event) {
    event.preventDefault()
    if (!factor || code.trim().length < 6) return
    setBusy(true); setError('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: code.trim() })
      if (verifyError) throw verifyError
      await refreshAssurance()
      navigate('/chat', { replace: true })
    } catch {
      setError('Código inválido ou expirado. Confira o aplicativo autenticador e tente novamente.')
      setCode('')
    } finally { setBusy(false) }
  }

  return <div className="login-page"><div className="login-panel">
    <div className="login-brand"><div className="brand-icon large"><ShieldCheck size={30} /></div><h1>Verificação em duas etapas</h1><p>Digite o código exibido no seu aplicativo autenticador.</p></div>
    {busy && !factor ? <div className="mfa-loading"><span className="spinner" />Carregando...</div> : <form onSubmit={verify}>
      <label>Código de 6 dígitos<div className="input-icon"><KeyRound size={18} /><input inputMode="numeric" autoComplete="one-time-code" minLength="6" maxLength="10" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" /></div></label>
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="primary full" disabled={busy || !factor || code.length < 6}>{busy ? <><span className="spinner small" />Verificando...</> : 'Confirmar código'}</button>
    </form>}
    <button className="text-button full" type="button" onClick={signOut}><LogOut size={16} />Sair desta conta</button>
  </div></div>
}
