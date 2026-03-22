import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../context/AuthContext'

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const onSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <header className="topbar">
          <div>
            <strong>{profile?.username ?? 'Unknown user'}</strong>
            <span>{profile?.role ?? 'no-role'}</span>
          </div>
          <button onClick={onSignOut}>Đăng xuất</button>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
