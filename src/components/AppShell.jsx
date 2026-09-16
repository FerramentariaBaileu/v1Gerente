import { Bot, Boxes, LogOut, MessageSquare, Settings, ShieldCheck } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function AppShell({ children }) {
  const { profile, signOut } = useAuth()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><Bot size={22} /></div><div><strong>Gerente Virtual</strong><small>Bailéu</small></div></div>
        <nav>
          <NavLink to="/chat"><MessageSquare size={19} />Chat</NavLink>
          <NavLink to="/estoque"><Boxes size={19} />Estoque</NavLink>
          <NavLink to="/seguranca"><ShieldCheck size={19} />Segurança</NavLink>
          {profile?.role === 'admin' && <NavLink to="/admin"><Settings size={19} />Administração</NavLink>}
        </nav>
        <div className="sidebar-user"><div className="avatar">{profile?.name?.charAt(0)?.toUpperCase()}</div><div><strong>{profile?.name}</strong><small>{profile?.role}</small></div><button title="Sair" onClick={signOut}><LogOut size={18} /></button></div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
