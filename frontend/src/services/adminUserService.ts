import { apiClient } from '../lib/api'
import type { AdminUserInput, AdminUserRecord } from '../types'

export async function listUsers(): Promise<AdminUserRecord[]> {
  const response = await apiClient.get<AdminUserRecord[]>('/api/users/')
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot list users')
  }
  
  return response.data || []
}

export async function createUser(payload: AdminUserInput) {
  const response = await apiClient.post('/api/users/', {
    username: payload.username,
    email: payload.email,
    password: payload.password,
    role: payload.role || 'user',
  })
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot create user')
  }
}

export async function updateUser(userId: string, payload: Partial<AdminUserInput>) {
  const response = await apiClient.put(`/api/users/${userId}`, {
    username: payload.username,
    email: payload.email,
    password: payload.password,
  })
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot update user')
  }
}

export async function deleteUser(userId: string) {
  const response = await apiClient.delete(`/api/users/${userId}`)
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot delete user')
  }
}

