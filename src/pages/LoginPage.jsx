import { useState } from 'react'
import { Bot, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try { await signIn(form.email.trim(), form.password) }
    catch (err) { setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente novamente.') }
    finally { setBusy(false) }
  }

  return <div className="login-page"><div className="login-panel">
    <div className="login-brand"><div className="brand-icon large"><Bot size={30} /></div><h1>Gerente Virtual</h1><p>Assistente interno Bailéu</p></div>
    <form onSubmit={submit}>
      <label>E-mail<div className="input-icon"><Mail size={18} /><input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@baileu.com.br" /></div></label>
      <label>Senha<div className="input-icon"><LockKeyhole size={18} /><input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Sua senha" /></div></label>
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="primary full" disabled={busy}>{busy ? <><span className="spinner small" />Entrando...</> : 'Entrar'}</button>
    </form>
    <small className="login-foot">Acesso exclusivo para usuários autorizados</small>
  </div></div>
}
