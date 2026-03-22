import { NavLink } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

interface MenuSection {
  title: string
  items: Array<{ to: string; label: string; adminOnly?: boolean }>
}

export function Sidebar() {
  const { isAdmin } = useAuth()
  const [openMonitoring, setOpenMonitoring] = useState(true)
  const [openOperations, setOpenOperations] = useState(true)
  const [openAccounts, setOpenAccounts] = useState(true)

  const sections = useMemo<MenuSection[]>(
    () => [
      {
        title: 'Cấu hình giám sát',
        items: [
          { to: '/monitoring/prtg', label: 'PRTG', adminOnly: true },
          // { to: '/monitoring/prtg', label: 'PRTG' },
          { to: '/monitoring/audit-log', label: 'Auditlog' },
        ],
      },
      {
        title: 'Điều hành trực',
        items: [
          { to: '/operations/tasks', label: 'Quản lý ra vào' },
          { to: '/operations/gate-logs', label: 'Nhật kí mở cổng' },
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
        <h2>Hệ sinh thái</h2>
        <p>XXXXxxxxxXXXXXXX</p>
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

        <button className="menu-toggle" onClick={() => setOpenOperations((v) => !v)}>
          {sections[2].title}
        </button>
        {openOperations ? (
          <div className="submenu">
            {sections[2].items.map((item) => (
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
