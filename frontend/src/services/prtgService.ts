import { apiClient } from '../lib/api'
import { buildQueryString } from '../lib/api'
import type { PrtgLiveSummary, PrtgServer } from '../types'

export async function getPrtgServers() {
  const response = await apiClient.get<PrtgServer[]>('/api/prtg/')
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot load PRTG servers')
  }
  
  return response.data || []
}

export async function upsertPrtgServer(server: Partial<PrtgServer>) {
  // If server has an id, it's an update, otherwise it's a create
  if (server.id) {
    const response = await apiClient.put(`/api/prtg/${server.id}`, server)
    if (!response.ok) {
      throw new Error(response.error || 'Cannot update PRTG server')
    }
  } else {
    const response = await apiClient.post('/api/prtg/', server)
    if (!response.ok) {
      throw new Error(response.error || 'Cannot create PRTG server')
    }
  }
}

export async function deletePrtgServer(id: string) {
  const response = await apiClient.delete(`/api/prtg/${id}`)
  
  if (!response.ok) {
    throw new Error(response.error || 'Cannot delete PRTG server')
  }
}

export async function syncPrtgNow(serverId?: string) {
  void serverId
  // Note: This would require a separate endpoint in the backend to trigger PRTG sync
  // For now, this is a placeholder that needs implementation in the backend
  throw new Error('PRTG sync not yet implemented in Python backend')
}

interface PrtgLiveSummaryOptions {
  server_id?: string
  base_url?: string
  username?: string
  passhash?: string
  api_token?: string
  count?: number
}

export async function getPrtgLiveSummary(options: PrtgLiveSummaryOptions = {}) {
  const query = buildQueryString(options as Record<string, unknown>)
  const endpoint = query ? `/api/prtg/live/summary?${query}` : '/api/prtg/live/summary'
  const response = await apiClient.get<PrtgLiveSummary>(endpoint)

  if (!response.ok || !response.data) {
    throw new Error(response.error || 'Cannot load live PRTG data')
  }

  return response.data
}

