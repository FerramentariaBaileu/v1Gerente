import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react'
import AppShell from '../components/AppShell.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function SecurityPage() {
  const { assurance, refreshAssurance } = useAuth()
  const [factors, setFactors] = useState([])
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [confirmRemoval, setConfirmRemoval] = useState('')
  const [busy, setBusy] = useState(true)

  const loadFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw error
    setFactors(data?.all ?? [])
  }, [])

  useEffect(() => {
    let mounted = true
    loadFactors().catch(() => { if (mounted) setFeedback({ ok: false, text: 'Não foi possível carregar as opções de segurança.' }) })
      .finally(() => { if (mounted) setBusy(false) })
    return () => { mounted = false }
  }, [loadFactors])

  async function startEnrollment() {
    setBusy(true); setFeedback(null); setConfirmRemoval('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Gerente Virtual Bailéu' })
      if (error) throw error
      setEnrollment(data)
      setCode('')
    } catch { setFeedback({ ok: false, text: 'Não foi possível iniciar a ativação do segundo fator.' }) }
    finally { setBusy(false) }
  }

  async function confirmEnrollment(event) {
    event.preventDefault(); setBusy(true); setFeedback(null)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollment.id })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: enrollment.id, challengeId: challenge.id, code: code.trim() })
      if (verifyError) throw verifyError
      await Promise.all([refreshAssurance(), loadFactors()])
      setEnrollment(null); setCode('')
      setFeedback({ ok: true, text: 'Autenticação em duas etapas ativada com sucesso.' })
    } catch { setFeedback({ ok: false, text: 'O código não foi aceito. Gere um código novo no aplicativo e tente novamente.' }) }
    finally { setBusy(false) }
  }

  async function cancelEnrollment() {
    if (!enrollment) return
    setBusy(true)
    await supabase.auth.mfa.unenroll({ factorId: enrollment.id }).catch(() => {})
    setEnrollment(null); setCode(''); setBusy(false)
  }

  async function removeFactor(factorId) {
    if (confirmRemoval !== factorId) { setConfirmRemoval(factorId); setFeedback(null); return }
    setBusy(true); setFeedback(null)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      await supabase.auth.refreshSession()
      await Promise.all([refreshAssurance(), loadFactors()])
      setConfirmRemoval('')
      setFeedback({ ok: true, text: 'Segundo fator removido.' })
    } catch { setFeedback({ ok: false, text: 'Não foi possível remover o segundo fator. Entre novamente com MFA e tente de novo.' }) }
    finally { setBusy(false) }
  }

  const verified = factors.filter((factor) => factor.status === 'verified')
  return <AppShell><section className="security-page">
    <header className="page-header"><div><h1>Segurança da conta</h1><p>Proteja seu acesso com um código temporário além da senha.</p></div><ShieldCheck aria-hidden="true" /></header>
    {feedback && <div className={`feedback ${feedback.ok ? 'success' : 'failure'}`} role="status">{feedback.ok ? <CheckCircle2 size={18} /> : <ShieldOff size={18} />}{feedback.text}</div>}
    <div className="security-card">
      <div className="security-status"><div><strong>Autenticação em duas etapas</strong><p>Aplicativo autenticador (TOTP)</p></div><span className={`status-pill ${verified.length ? 'enabled' : ''}`}>{verified.length ? 'Ativa' : 'Não ativada'}</span></div>
      <p className="muted">Depois de ativar, cada novo login exigirá um código de 6 dígitos. Cadastre também um segundo dispositivo de reserva antes de depender deste recurso.</p>
      {busy && !enrollment ? <div className="mfa-loading"><span className="spinner small" />Atualizando...</div> : null}
      {!busy && !enrollment && !verified.length ? <button className="primary" onClick={startEnrollment}><ShieldCheck size={18} />Ativar segundo fator</button> : null}
      {enrollment ? <form className="enrollment" onSubmit={confirmEnrollment}>
        <div className="qr-wrap"><img src={enrollment.totp.qr_code} alt="QR Code para cadastrar o Gerente Virtual no aplicativo autenticador" /><div><strong>1. Leia o QR Code</strong><p className="muted">Use Google Authenticator, Microsoft Authenticator, Authy, 1Password ou equivalente.</p><details><summary>Não consegue ler o QR Code?</summary><code>{enrollment.totp.secret}</code></details></div></div>
        <label>2. Confirme o primeiro código<div className="input-icon"><KeyRound size={18} /><input inputMode="numeric" autoComplete="one-time-code" minLength="6" maxLength="10" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" /></div></label>
        <div className="button-row"><button className="primary" disabled={busy || code.length < 6}>{busy ? 'Verificando...' : 'Confirmar ativação'}</button><button className="secondary" type="button" disabled={busy} onClick={cancelEnrollment}>Cancelar</button></div>
      </form> : null}
      {verified.map((factor) => <div className="factor-row" key={factor.id}><div><strong>{factor.friendly_name || 'Aplicativo autenticador'}</strong><small>Fator verificado · sessão atual {assurance?.currentLevel === 'aal2' ? 'AAL2' : 'AAL1'}</small></div><button className={confirmRemoval === factor.id ? 'danger-button' : 'secondary'} disabled={busy} onClick={() => removeFactor(factor.id)}>{confirmRemoval === factor.id ? 'Confirmar remoção' : 'Remover'}</button></div>)}
      {confirmRemoval && <p className="warning-text">A remoção reduz a proteção da conta. Clique novamente em “Confirmar remoção” para concluir.</p>}
    </div>
  </section></AppShell>
}
