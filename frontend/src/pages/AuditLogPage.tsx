import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { getUnifiedAuditLogs } from '../services/auditService'
import type { AuditLog } from '../types'

function toDateStart(value: string) {
  return value ? new Date(`${value}T00:00:00`) : null
}

function toDateEnd(value: string) {
  return value ? new Date(`${value}T23:59:59.999`) : null
}

function getAgentType(log: AuditLog) {
  const rawPayload = (log.payload as { raw?: Record<string, unknown> } | null)?.raw
  const payloadAgent = rawPayload?.agent as { type?: string } | undefined
  const directAgent = rawPayload?.['agent.type']

  if (typeof payloadAgent?.type === 'string' && payloadAgent.type) {
    return payloadAgent.type
  }

  if (typeof directAgent === 'string' && directAgent) {
    return directAgent
  }

  if (log.source.toLowerCase().includes('prtg')) {
    return 'prtg'
  }

  return 'unknown'
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [severity, setSeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all')
  const [agentType, setAgentType] = useState<'all' | string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    void (async () => {
      const data = await getUnifiedAuditLogs(200)
      setLogs(data)
    })()
  }, [])

  const agentTypeOptions = useMemo(() => {
    const values = new Set<string>()
    logs.forEach((item) => values.add(getAgentType(item)))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [logs])

  const filtered = useMemo(() => {
    const from = toDateStart(fromDate)
    const to = toDateEnd(toDate)

    return logs.filter((item) => {
      const itemDate = new Date(item.created_at)

      if (severity !== 'all' && item.severity !== severity) {
        return false
      }

      if (agentType !== 'all' && getAgentType(item) !== agentType) {
        return false
      }

      if (from && itemDate < from) {
        return false
      }

      if (to && itemDate > to) {
        return false
      }

      return true
    })
  }, [logs, severity, agentType, fromDate, toDate])

  useEffect(() => {
    setPage(1)
  }, [severity, agentType, fromDate, toDate, pageSize])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / pageSize))
  }, [filtered.length, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }, [filtered, page, pageSize])

  const startItem = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, filtered.length)

  return (
    <div>
      <PageHeader
        title="Auditlog"
        subtitle="Log for debugging, monitoring and auditing purposes. Logs are sourced from both the application database and Elasticsearch, providing a comprehensive view of system events."
      />

      <section className="panel">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label>
            Lọc mức độ
            <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
              <option value="all">Tất cả</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label>
            Lọc theo agent.type
            <select value={agentType} onChange={(event) => setAgentType(event.target.value)}>
              <option value="all">Tất cả</option>
              {agentTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            Từ ngày
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>

          <label>
            Đến ngày
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>

          <label>
            Số dòng / trang
            <select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span>
            Hiển thị {startItem}-{endItem} / {filtered.length} log
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              Trước
            </button>
            <span>
              Trang {page}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
            >
              Sau
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Mức độ</th>
              <th>Nội dung</th>
              <th>Nguồn</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((log) => (
              <tr key={`${log.source}-${log.id}`}>
                <td>{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                <td>{log.severity}</td>
                <td>{log.message}</td>
                <td>{log.source}</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={4}>Không có dữ liệu phù hợp bộ lọc.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
