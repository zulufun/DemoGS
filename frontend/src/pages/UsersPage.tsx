import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { createUser, deleteUser, listUsers, updateUser } from '../services/adminUserService'
import type { AdminUserRecord, UserRole } from '../types'

const defaultForm = {
  id: '',
  email: '',
  password: '',
  username: '',
  role: 'user' as UserRole,
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [form, setForm] = useState(defaultForm)
  const [status, setStatus] = useState('')

  const loadUsers = async () => {
    const data = await listUsers()
    setUsers(data)
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()

    if (form.id) {
      await updateUser(form.id, {
        email: form.email,
        password: form.password || undefined,
        username: form.username,
        role: form.role,
      })
      setStatus('Đã cập nhật user')
    } else {
      await createUser({
        email: form.email,
        password: form.password,
        username: form.username,
        role: form.role,
      })
      setStatus('Đã tạo user')
    }

    setForm(defaultForm)
    await loadUsers()
  }

  const handleEdit = (user: AdminUserRecord) => {
    setForm({
      id: user.id,
      email: user.email,
      password: '',
      username: user.username,
      role: user.role,
    })
  }

  const handleDelete = async (userId: string) => {
    await deleteUser(userId)
    setStatus('Đã xóa user')
    await loadUsers()
  }

  return (
    <div>
      <PageHeader
        title="Tài khoản / User"
        subtitle="Admin có quyền thêm sửa xóa user đăng nhập hệ thống"
      />

      <form className="panel form-grid" onSubmit={handleSave}>
        <label>
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
        </label>

        <label>
          Username
          <input
            required
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
          />
        </label>

        <label>
          Mật khẩu
          <input
            type="password"
            placeholder={form.id ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'}
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required={!form.id}
          />
        </label>

        <label>
          Vai trò
          <select
            value={form.role}
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>

        <button type="submit">{form.id ? 'Cập nhật user' : 'Tạo user'}</button>
      </form>

      {status ? <p>{status}</p> : null}

      <section className="panel">
        <h2>Danh sách tài khoản</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.username}</td>
                <td>{user.role}</td>
                <td>{new Date(user.created_at).toLocaleString('vi-VN')}</td>
                <td className="actions">
                  <button onClick={() => handleEdit(user)}>Sửa</button>
                  <button onClick={() => handleDelete(user.id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
