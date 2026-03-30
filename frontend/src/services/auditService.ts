import { apiClient } from '../lib/api'
import type { AlertItem, AuditLog, ElasticOverviewStats } from '../types'

type ElasticSearchResponse = {
  hits?: {
    total?: {
      value?: number
    }
    hits?: Array<{
      _id: string
      _index: string
      _source?: Record<string, unknown>
    }>
  }
  aggregations?: {
    systems?: {
      value?: number
    }
    alerts?: {
      doc_count?: number
    }
    warning?: {
      doc_count?: number
    }
    critical?: {
      doc_count?: number
    }
    daily?: {
      buckets?: Array<{
        key_as_string?: string
        doc_count?: number
        alerts?: { doc_count?: number }
        warning?: { doc_count?: number }
        critical?: { doc_count?: number }
      }>
    }
    top_hosts?: {
      buckets?: Array<{
        key?: string
        doc_count?: number
      }>
    }
  }
}

const elasticAlertFilter = {
  bool: {
    should: [
      {
        terms: {
          'winlog.level.keyword': ['warning', 'warn', 'error', 'critical', 'fatal'],
        },
      },
      {
        terms: {
          'log.level.keyword': ['warning', 'warn', 'error', 'critical', 'fatal'],
        },
      },
      {
        range: {
          'event.severity': {
            gte: 4,
          },
        },
      },
      {
        match_phrase: {
          message: 'failed',
        },
      },
      {
        match_phrase: {
          message: 'denied',
        },
      },
    ],
    minimum_should_match: 1,
  },
}

const elasticWarningFilter = {
  bool: {
    should: [
      {
        terms: {
          'winlog.level.keyword': ['warning', 'warn'],
        },
      },
      {
        terms: {
          'log.level.keyword': ['warning', 'warn'],
        },
      },
      {
        range: {
          'event.severity': {
            gte: 4,
            lte: 5,
          },
        },
      },
    ],
    minimum_should_match: 1,
  },
}

const elasticCriticalFilter = {
  bool: {
    should: [
      {
        terms: {
          'winlog.level.keyword': ['error', 'critical', 'fatal'],
        },
      },
      {
        terms: {
          'log.level.keyword': ['error', 'critical', 'fatal'],
        },
      },
      {
        range: {
          'event.severity': {
            gte: 6,
          },
        },
      },
      {
        match_phrase: {
          message: 'failed',
        },
      },
      {
        match_phrase: {
          message: 'denied',
        },
      },
    ],
    minimum_should_match: 1,
  },
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

export async function getElasticOverview7d(): Promise<ElasticOverviewStats> {
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
      size: 0,
      query: {
        bool: {
          filter: [
            {
              term: {
                'agent.type': 'winlogbeat',
              },
            },
            {
              range: {
                '@timestamp': {
                  gte: 'now-7d/d',
                  lte: 'now',
                },
              },
            },
          ],
        },
      },
      aggs: {
        systems: {
          cardinality: {
            field: 'host.name.keyword',
          },
        },
        top_hosts: {
          terms: {
            field: 'host.name.keyword',
            size: 5,
            missing: 'unknown-host',
          },
        },
        alerts: {
          filter: elasticAlertFilter,
        },
        warning: {
          filter: elasticWarningFilter,
        },
        critical: {
          filter: elasticCriticalFilter,
        },
        daily: {
          date_histogram: {
            field: '@timestamp',
            calendar_interval: 'day',
            min_doc_count: 0,
            extended_bounds: {
              min: 'now-6d/d',
              max: 'now/d',
            },
          },
          aggs: {
            alerts: {
              filter: elasticAlertFilter,
            },
            warning: {
              filter: elasticWarningFilter,
            },
            critical: {
              filter: elasticCriticalFilter,
            },
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Elastic overview query failed: ${message}`)
  }

  const payload = (await response.json()) as ElasticSearchResponse
  const aggs = payload.aggregations
  const totalEvents = payload.hits?.total?.value ?? 0
  const systems = aggs?.systems?.value ?? 0
  const alerts = aggs?.alerts?.doc_count ?? 0
  const warning = aggs?.warning?.doc_count ?? 0
  const critical = aggs?.critical?.doc_count ?? 0

  const topHosts = (aggs?.top_hosts?.buckets ?? []).map((bucket) => ({
    host: bucket.key || 'unknown-host',
    count: bucket.doc_count ?? 0,
  }))

  const daily = (aggs?.daily?.buckets ?? []).map((bucket) => ({
    date: bucket.key_as_string || new Date().toISOString(),
    total: bucket.doc_count ?? 0,
    alerts: bucket.alerts?.doc_count ?? 0,
    warning: bucket.warning?.doc_count ?? 0,
    critical: bucket.critical?.doc_count ?? 0,
  }))

  return {
    systems_count: Math.max(0, Math.round(systems)),
    total_events_7d: totalEvents,
    alerts_7d: alerts,
    warning_7d: warning,
    critical_7d: critical,
    top_hosts: topHosts,
    daily,
  }
}

export async function getLatestAlerts(limit = 20) {
  const response = await apiClient.get<AlertItem[]>(`/api/alerts/?limit=${limit}`)
  
  if (!response.ok) {
    return []
  }
  
  return response.data || []
}
