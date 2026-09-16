import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import InventoryPage from './pages/InventoryPage.jsx'
import MfaChallengePage from './pages/MfaChallengePage.jsx'
import SecurityPage from './pages/SecurityPage.jsx'
import { configured } from './lib/supabase.js'

export default function App() {
  const { session, mfaRequired, loading } = useAuth()
  if (!configured) return <div className="login-page"><section className="login-panel"><h1>Gerente Virtual — Bailéu</h1><p>Configure a conexão com o banco para começar.</p><p>Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY conforme o arquivo .env.example e reinicie o aplicativo.</p></section></div>
  if (loading) return <div className="app-loader"><span className="spinner" />Carregando...</div>

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={mfaRequired ? '/mfa' : '/chat'} replace /> : <LoginPage />} />
      <Route path="/mfa" element={session ? (mfaRequired ? <MfaChallengePage /> : <Navigate to="/chat" replace />) : <Navigate to="/login" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/estoque" element={<InventoryPage />} />
        <Route path="/seguranca" element={<SecurityPage />} />
      </Route>
      <Route element={<ProtectedRoute requireAdmin />}>
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? (mfaRequired ? '/mfa' : '/chat') : '/login'} replace />} />
    </Routes>
  )
}
