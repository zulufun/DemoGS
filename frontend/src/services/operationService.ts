import { apiClient } from '../lib/api'
import type { GateOpenLog, OperationTask } from '../types'

// ===== Operation Tasks =====
export async function listOperationTasks() {
  const response = await apiClient.get<OperationTask[]>('/api/operations/tasks')
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot load operation tasks')
  }
  
  return response.data || []
}

export async function upsertOperationTask(payload: Partial<OperationTask>) {
  if (payload.id) {
    // Update
    const response = await apiClient.put(`/api/operations/tasks/${payload.id}`, payload)
    if (!response.ok) {
      throw new Error(response.error || 'Cannot update operation task')
    }
  } else {
    // Create
    const response = await apiClient.post('/api/operations/tasks', payload)
    if (!response.ok) {
      throw new Error(response.error || 'Cannot create operation task')
    }
  }
}

export async function completeOperationTask(taskId: string, endTime: string, resultContent: string) {
  const response = await apiClient.put(`/api/operations/tasks/${taskId}`, {
    end_time: endTime,
    result_content: resultContent,
  })
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot complete operation task')
  }
}

export async function deleteOperationTask(id: string) {
  const response = await apiClient.delete(`/api/operations/tasks/${id}`)
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot delete operation task')
  }
}

// ===== Gate Open Logs =====
export async function listGateOpenLogs() {
  const response = await apiClient.get<GateOpenLog[]>('/api/gates/')
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot load gate logs')
  }
  
  return response.data || []
}

export async function upsertGateOpenLog(payload: Partial<GateOpenLog>) {
  if (payload.id) {
    // Update
    const response = await apiClient.put(`/api/gates/${payload.id}`, payload)
    if (!response.ok) {
      throw new Error(response.error || 'Cannot update gate log')
    }
  } else {
    // Create
    const response = await apiClient.post('/api/gates/', payload)
    if (!response.ok) {
      throw new Error(response.error || 'Cannot create gate log')
    }
  }
}

export async function deleteGateOpenLog(id: string) {
  const response = await apiClient.delete(`/api/gates/${id}`)
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot delete gate log')
  }
}
