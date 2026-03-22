import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AdminRoute() {
  const { user, isAdmin, loading, profileLoading } = useAuth()

  if (loading || (user && profileLoading)) {
    return <div className="loading">Đang tải...</div>
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
