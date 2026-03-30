import { apiClient, buildQueryString } from '../lib/api'
import type { VertivSnapshot } from '../types'

interface VertivSnapshotOptions {
  base_url?: string
  path?: string
  username?: string
  password?: string
  verify_ssl?: boolean
  timeout_seconds?: number
}

export async function getVertivSnapshot(options: VertivSnapshotOptions = {}) {
  const query = buildQueryString(options as Record<string, unknown>)
  const endpoint = query
    ? `/api/vertiv/live/temperature-humidity?${query}`
    : '/api/vertiv/live/temperature-humidity'

  const response = await apiClient.get<VertivSnapshot>(endpoint)

  if (!response.ok || !response.data) {
    throw new Error(response.error || 'Cannot load Vertiv temperature/humidity data')
  }

  return response.data
}
