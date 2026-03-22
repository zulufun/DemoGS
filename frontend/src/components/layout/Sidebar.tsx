import { NavLink } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

interface MenuSection {
  title: string
  items: Array<{ to: string; label: string; adminOnly?: boolean }>
}

export function Sidebar() {
  const { profile } = useAuth()
  const [openMonitoring, setOpenMonitoring] = useState(true)
  const [openAccounts, setOpenAccounts] = useState(true)

  const isAdmin = profile?.role === 'admin'

  const sections = useMemo<MenuSection[]>(
    () => [
      {
        title: 'Cấu hình giám sát',
        items: [
          { to: '/monitoring/prtg', label: 'PRTG', adminOnly: true },
          { to: '/monitoring/audit-log', label: 'Auditlog' },
        ],
      },
      {
        title: 'Tài khoản',
        items: [
          { to: '/accounts/users', label: 'User', adminOnly: true },
          { to: '/accounts/change-password', label: 'ChangePassword' },
        ],
      },
    ],
    [],
  )

  return (
    <aside className="sidebar">
      <div className="brand">
        <h2>PRTG Monitor</h2>
        <p>Supabase + Realtime</p>
      </div>

      <nav>
        <NavLink to="/dashboard" className="menu-link">
          Dashboard
        </NavLink>

        <button className="menu-toggle" onClick={() => setOpenMonitoring((v) => !v)}>
          {sections[0].title}
        </button>
        {openMonitoring ? (
          <div className="submenu">
            {sections[0].items
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <NavLink key={item.to} to={item.to} className="menu-link sub">
                  {item.label}
                </NavLink>
              ))}
          </div>
        ) : null}

        <button className="menu-toggle" onClick={() => setOpenAccounts((v) => !v)}>
          {sections[1].title}
        </button>
        {openAccounts ? (
          <div className="submenu">
            {sections[1].items
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <NavLink key={item.to} to={item.to} className="menu-link sub">
                  {item.label}
                </NavLink>
              ))}
          </div>
        ) : null}
      </nav>
    </aside>
  )
}
