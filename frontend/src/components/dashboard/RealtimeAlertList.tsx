import type { AlertItem } from '../../types'

interface RealtimeAlertListProps {
  alerts: AlertItem[]
}

export function RealtimeAlertList({ alerts }: RealtimeAlertListProps) {
  if (alerts.length === 0) {
    return (
      <section className="panel">
        <h2>Cảnh báo realtime</h2>
        <p>Chưa có cảnh báo mới.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <h2>Cảnh báo realtime</h2>
      <ul className="alert-list">
        {alerts.map((alert) => (
          <li key={alert.id} className={`alert-item ${alert.severity}`}>
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.description ?? 'Không có mô tả'}</p>
            </div>
            <div className="meta">
              <span>{alert.severity}</span>
              <small>{new Date(alert.created_at).toLocaleString('vi-VN')}</small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
