import { apiClient } from '../lib/api'

export interface LogCountResponse {
  status: string
  index_pattern: string
  total_logs: number
  message: string
}

export interface ServerLog {
  name: string
  count: number
}

export interface LogsByServerResponse {
  status: string
  servers: ServerLog[]
}

export interface ActionLog {
  action: string
  count: number
}

export interface LogsByActionResponse {
  status: string
  actions: ActionLog[]
}

export const paloaltoService = {
  async getLogsCount(): Promise<LogCountResponse> {
    const response = await apiClient.get<LogCountResponse>('/paloalto/logs/count')
    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Failed to fetch log count')
    }
    return response.data
  },

  async getLogsByServer(): Promise<LogsByServerResponse> {
    const response = await apiClient.get<LogsByServerResponse>('/paloalto/logs/by-server')
    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Failed to fetch logs by server')
    }
    return response.data
  },

  async getLogsByAction(): Promise<LogsByActionResponse> {
    const response = await apiClient.get<LogsByActionResponse>('/paloalto/logs/by-action')
    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Failed to fetch logs by action')
    }
    return response.data
  },
}
