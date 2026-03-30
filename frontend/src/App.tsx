import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { MonitoringPrtgPage } from './pages/MonitoringPrtgPage'
import { PaloAltoLogsPage } from './pages/PaloAltoLogsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { UsersPage } from './pages/UsersPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OperationsTaskPage } from './pages/OperationsTaskPage'
import { GateLogPage } from './pages/GateLogPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AdminRoute } from './routes/AdminRoute'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/monitoring/audit-log" element={<AuditLogPage />} />
              <Route path="/monitoring/paloalto" element={<PaloAltoLogsPage />} />
              <Route path="/operations/tasks" element={<OperationsTaskPage />} />
              <Route path="/operations/gate-logs" element={<GateLogPage />} />
              <Route path="/accounts/change-password" element={<ChangePasswordPage />} />

              <Route element={<AdminRoute />}>
                <Route path="/monitoring/prtg" element={<MonitoringPrtgPage />} />
                <Route path="/accounts/users" element={<UsersPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
