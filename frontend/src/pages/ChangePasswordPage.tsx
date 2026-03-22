import { useState } from 'react'
import type { FormEventHandler } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { supabase } from '../lib/supabase'

export function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const onSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('Mật khẩu cần ít nhất 8 ký tự')
      return
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage('Đổi mật khẩu thành công')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div>
      <PageHeader
        title="Tài khoản / ChangePassword"
        subtitle="Giao diện thay đổi mật khẩu cho người dùng hiện tại"
      />

      <form className="panel form-grid" onSubmit={onSubmit}>
        <label>
          Mật khẩu mới
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label>
          Xác nhận mật khẩu
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>

        <button type="submit">Cập nhật mật khẩu</button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p>{message}</p> : null}
    </div>
  )
}
