import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <div className="app-loader"><span className="spinner" />Carregando...</div>

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/chat" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/chat" element={<ChatPage />} />
      </Route>
      <Route element={<ProtectedRoute requireAdmin />}>
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? '/chat' : '/login'} replace />} />
    </Routes>
  )
}
