import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function ProtectedRoute({ requireAdmin = false }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="app-loader"><span className="spinner" />Carregando...</div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <div className="fatal-card">Seu usuário não possui um perfil válido. Fale com um administrador.</div>
  if (requireAdmin && profile.role !== 'admin') return <Navigate to="/chat" replace />
  return <Outlet />
}
