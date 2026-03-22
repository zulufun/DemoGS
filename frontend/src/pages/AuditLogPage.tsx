import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { getAuditLogs } from '../services/auditService'
import type { AuditLog } from '../types'

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [severity, setSeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all')

  useEffect(() => {
    void (async () => {
      const data = await getAuditLogs(200)
      setLogs(data)
    })()
  }, [])

  const filtered = useMemo(
    () => logs.filter((item) => severity === 'all' || item.severity === severity),
    [logs, severity],
  )

  return (
    <div>
      <PageHeader
        title="Auditlog"
        subtitle="Lưu dữ liệu từ API PRTG để kiểm lỗi và phục vụ dashboard"
      />

      <section className="panel">
        <label>
          Lọc mức độ
          <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
            <option value="all">Tất cả</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>

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
            {filtered.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                <td>{log.severity}</td>
                <td>{log.message}</td>
                <td>{log.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
