import { supabase } from '../lib/supabase'
import type { AdminUserInput, AdminUserRecord } from '../types'

const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`

async function withAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Bạn chưa đăng nhập')
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export async function listUsers(): Promise<AdminUserRecord[]> {
  const response = await fetch(endpoint, {
    headers: await withAuthHeaders(),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Không thể tải danh sách user: ${message}`)
  }

  return response.json()
}

export async function createUser(payload: AdminUserInput) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: await withAuthHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Không thể tạo user: ${message}`)
  }
}

export async function updateUser(userId: string, payload: Partial<AdminUserInput>) {
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: await withAuthHeaders(),
    body: JSON.stringify({ userId, ...payload }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Không thể cập nhật user: ${message}`)
  }
}

export async function deleteUser(userId: string) {
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: await withAuthHeaders(),
    body: JSON.stringify({ userId }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Không thể xóa user: ${message}`)
  }
}
