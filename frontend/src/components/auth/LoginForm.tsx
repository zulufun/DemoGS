import { useState } from 'react'
import type { FormEventHandler } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function LoginForm() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signIn(username, password)
      navigate('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Đăng nhập thất bại'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="login-form panel" onSubmit={onSubmit}>
      <h1>Đăng nhập</h1>
      <p>Truy cập dashboard giám sát hệ thống Trung tâm dữ liệu.</p>

      <label>
        Tên đăng nhập
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          type="text"
          required
          autoComplete="username"
          placeholder="admin"
        />
      </label>

      <label>
        Mật khẩu
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          required
          autoComplete="current-password"
        />
      </label>

      {error ? <p className="error-text">{error}</p> : null}

      <button disabled={loading} type="submit">
        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  )
}
