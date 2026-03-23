import { apiClient } from '../lib/api'
import type { AlertItem, AuditLog } from '../types'

type ElasticSearchResponse = {
  hits?: {
    hits?: Array<{
      _id: string
      _index: string
      _source?: Record<string, unknown>
    }>
  }
}

function mapElasticSeverity(source: Record<string, unknown>) {
  const level = String(
    source?.['winlog.level'] ??
      source?.['log.level'] ??
      source?.['event.severity'] ??
      source?.['event.outcome'] ??
      '',
  ).toLowerCase()

  if (level.includes('critical') || level.includes('fatal') || level.includes('error') || level.includes('fail')) {
    return 'critical' as const
  }

  if (level.includes('warn')) {
    return 'warning' as const
  }

  const message = String(source.message ?? '').toLowerCase()
  if (message.includes('error') || message.includes('failed') || message.includes('denied')) {
    return 'critical' as const
  }

  if (message.includes('warning') || message.includes('retry')) {
    return 'warning' as const
  }

  return 'info' as const
}

function mapElasticHitsToAuditLogs(payload: ElasticSearchResponse) {
  const hits = payload.hits?.hits ?? []

  return hits.map((item): AuditLog => {
    const source = item._source ?? {}
    const host = (source.host as { name?: string } | undefined)?.name ?? String(source['host.name'] ?? 'windows-host')
    const provider =
      (source.event as { provider?: string } | undefined)?.provider ?? String(source['event.provider'] ?? 'winlogbeat')
    const eventCode =
      (source.event as { code?: string } | undefined)?.code ?? String(source['event.code'] ?? '')
    const message = String(source.message ?? '')

    return {
      id: item._id,
      source: `elastic:${host}`,
      severity: mapElasticSeverity(source),
      message: `${provider}${eventCode ? ` (${eventCode})` : ''}: ${message}`,
      payload: {
        index: item._index,
        raw: source,
      },
      created_at: String(source['@timestamp'] ?? new Date().toISOString()),
    }
  })
}

export async function getAuditLogs(limit = 100) {
  const response = await apiClient.get<AuditLog[]>(`/api/audit/?limit=${limit}`)
  
  if (!response.ok) {
    return []
  }
  
  return response.data || []
}

async function getElasticAuditLogsDirect(limit = 100) {
  const elasticUrl = import.meta.env.VITE_ELASTICSEARCH_URL ?? 'http://127.0.0.1:9200'
  const elasticUser = import.meta.env.VITE_ELASTICSEARCH_USERNAME ?? 'elastic'
  const elasticPassword = import.meta.env.VITE_ELASTICSEARCH_PASSWORD ?? 'changeme'

  const auth = btoa(`${elasticUser}:${elasticPassword}`)
  const response = await fetch(`${elasticUrl}/logs-*/_search`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      size: limit,
      sort: [{ '@timestamp': 'desc' }],
      query: {
        bool: {
          filter: [{ term: { 'agent.type': 'winlogbeat' } }],
        },
      },
      _source: [
        '@timestamp',
        'message',
        'host.name',
        'agent.type',
        'event.provider',
        'event.code',
        'event.outcome',
        'winlog.channel',
        'winlog.level',
        'log.level',
        'event.severity',
      ],
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Direct Elastic query failed: ${message}`)
  }

  const payload = (await response.json()) as ElasticSearchResponse
  return mapElasticHitsToAuditLogs(payload)
}

export async function getUnifiedAuditLogs(limit = 100) {
  const [dbResult, elasticResult] = await Promise.allSettled([
    getAuditLogs(limit),
    getElasticAuditLogsDirect(limit),
  ])

  const dbLogs = dbResult.status === 'fulfilled' ? dbResult.value : []
  let elasticLogs = elasticResult.status === 'fulfilled' ? elasticResult.value : []
  let elasticError =
    elasticResult.status === 'rejected' ? String(elasticResult.reason ?? 'Elastic query failed') : ''

  const diagnostics: AuditLog[] = []
  if (elasticError) {
    diagnostics.push({
      id: `elastic-error-${Date.now()}`,
      source: 'system:elastic',
      severity: 'warning',
      message: `Cannot load logs from Elasticsearch. Details: ${elasticError}`,
      payload: null,
      created_at: new Date().toISOString(),
    })
  }

  return [...diagnostics, ...dbLogs, ...elasticLogs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}

export async function getLatestAlerts(limit = 20) {
  const response = await apiClient.get<AlertItem[]>(`/api/alerts/?limit=${limit}`)
  
  if (!response.ok) {
    return []
  }
  
  return response.data || []
}
