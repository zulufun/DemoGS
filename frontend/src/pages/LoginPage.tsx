import { LoginForm } from '../components/auth/LoginForm'

export function LoginPage() {
  return (
    <div className="auth-page">
      <div className="hero-copy">
        <h2>Hệ thống giám sát tích hợp đa nguồn</h2>
        <p>
          Hệ sinh thái hỗ trợ trực giám sát
        </p>
      </div>
      <LoginForm />
    </div>
  )
}
