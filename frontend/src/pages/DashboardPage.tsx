import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { RealtimeAlertList } from '../components/dashboard/RealtimeAlertList'
import { ScoreBar } from '../components/dashboard/ScoreBar'
import { getLatestAlerts } from '../services/auditService'
import { getPrtgLiveSummary } from '../services/prtgService'
import type { AlertItem, PrtgLiveSummary } from '../types'

const defaultPrtgSource = {
  base_url: import.meta.env.VITE_PRTG_URL || 'http://10.1.0.2',
  username: import.meta.env.VITE_PRTG_USERNAME || 'tt6',
  passhash: import.meta.env.VITE_PRTG_PASSHASH || '1066006246',
  count: Number(import.meta.env.VITE_PRTG_COUNT || 2000),
}

export function DashboardPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [alertLoading, setAlertLoading] = useState(true)
  const [prtgLoading, setPrtgLoading] = useState(true)
  const [prtgError, setPrtgError] = useState('')
  const [prtgSummary, setPrtgSummary] = useState<PrtgLiveSummary | null>(null)

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const data = await getLatestAlerts(20)
        setAlerts(data)
      } finally {
        setAlertLoading(false)
      }
    }

    void loadAlerts()
    const intervalId = window.setInterval(() => {
      void loadAlerts()
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadPrtgLive = async () => {
      try {
        const data = await getPrtgLiveSummary(defaultPrtgSource)
        if (!mounted) return
        setPrtgSummary(data)
        setPrtgError('')
      } catch (error) {
        if (!mounted) return
        setPrtgError(error instanceof Error ? error.message : 'Không thể tải dữ liệu PRTG live')
      } finally {
        if (mounted) {
          setPrtgLoading(false)
        }
      }
    }

    void loadPrtgLive()
    const intervalId = window.setInterval(() => {
      void loadPrtgLive()
    }, 15000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const score = useMemo(() => {
    const alertPenalty = alerts.reduce((acc, item) => {
      if (item.severity === 'critical') return acc + 20
      if (item.severity === 'warning') return acc + 8
      return acc + 2
    }, 0)

    const livePenalty = prtgSummary
      ? Math.min(
          40,
          prtgSummary.status_counts.down * 12 +
            prtgSummary.status_counts.warning * 4 +
            prtgSummary.status_counts.other * 2,
        )
      : 0

    return Math.max(0, 100 - alertPenalty - livePenalty)
  }, [alerts, prtgSummary])

  const totalSensors = prtgSummary ? prtgSummary.sensors.length : 0
  const statusRows = prtgSummary
    ? [
        { key: 'up', label: 'Up', count: prtgSummary.status_counts.up, tone: 'good' },
        { key: 'warning', label: 'Warning', count: prtgSummary.status_counts.warning, tone: 'warn' },
        { key: 'down', label: 'Down', count: prtgSummary.status_counts.down, tone: 'danger' },
        { key: 'other', label: 'Other', count: prtgSummary.status_counts.other, tone: 'other' },
      ]
    : []

  const priorityRows = prtgSummary
    ? Object.entries(prtgSummary.priority_counts)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([priority, count]) => ({ priority, count }))
    : []

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Score bar, cảnh báo và PRTG live data được cập nhật định kỳ"
      />
      {alertLoading ? <p>Đang tải cảnh báo...</p> : null}
      <ScoreBar score={score} />

      <section className="panel">
        <div className="score-line">
          <h2>PRTG Live Overview</h2>
          {prtgSummary ? (
            <strong>
              {prtgSummary.source.returned_count}/{prtgSummary.source.total_count} sensors
            </strong>
          ) : null}
        </div>

        {prtgLoading && !prtgSummary ? <p>Đang tải dữ liệu PRTG live...</p> : null}
        {prtgError ? <p className="error-text">{prtgError}</p> : null}

        {prtgSummary ? (
          <>
            <p className="prtg-meta">
              Nguồn: {prtgSummary.source.server_name} | {prtgSummary.source.base_url} | Phiên bản PRTG:{' '}
              {prtgSummary.source.prtg_version || 'N/A'} | Cập nhật:{' '}
              {new Date(prtgSummary.source.fetched_at).toLocaleString('vi-VN')}
            </p>
            {prtgSummary.source.is_truncated ? (
              <p className="error-text">
                Dữ liệu đang bị cắt bớt ({prtgSummary.source.returned_count}/{prtgSummary.source.total_count}).
                Tăng VITE_PRTG_COUNT để lấy đủ sensor.
              </p>
            ) : null}

            <div className="prtg-metrics">
              <article className="prtg-metric good">
                <h3>Up</h3>
                <strong>{prtgSummary.status_counts.up}</strong>
              </article>
              <article className="prtg-metric warn">
                <h3>Warning</h3>
                <strong>{prtgSummary.status_counts.warning}</strong>
              </article>
              <article className="prtg-metric danger">
                <h3>Down</h3>
                <strong>{prtgSummary.status_counts.down}</strong>
              </article>
              <article className="prtg-metric other">
                <h3>Other</h3>
                <strong>{prtgSummary.status_counts.other}</strong>
              </article>
            </div>

            <div className="prtg-grid">
              <section className="prtg-chart-block">
                <h3>Phân bố trạng thái sensor</h3>
                <ul className="bar-list">
                  {statusRows.map((row) => {
                    const width = totalSensors > 0 ? (row.count / totalSensors) * 100 : 0
                    return (
                      <li key={row.key}>
                        <span>{row.label}</span>
                        <div className="bar-track">
                          <div
                            className={`bar-fill ${row.tone}`}
                            style={{ width: `${Math.max(width, row.count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <strong>
                          {row.count} ({totalSensors > 0 ? Math.round(width) : 0}%)
                        </strong>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section className="prtg-chart-block">
                <h3>Phân bố theo priority</h3>
                <ul className="bar-list">
                  {priorityRows.map((row) => {
                    const width = totalSensors > 0 ? (row.count / totalSensors) * 100 : 0
                    return (
                      <li key={row.priority}>
                        <span>P{row.priority}</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill priority"
                            style={{ width: `${Math.max(width, row.count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <strong>{row.count}</strong>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>

            <section className="prtg-table-wrap">
              <h3>Top sensors ưu tiên cao</h3>
              <table className="table prtg-table">
                <thead>
                  <tr>
                    <th>Sensor</th>
                    <th>Device</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Last Value</th>
                    <th>Last Up</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {prtgSummary.top_priority_sensors.map((sensor) => (
                    <tr key={sensor.objid}>
                      <td>{sensor.sensor}</td>
                      <td>{sensor.device}</td>
                      <td>{sensor.status}</td>
                      <td>P{sensor.priority}</td>
                      <td>{sensor.lastvalue || '-'}</td>
                      <td>{sensor.lastup || '-'}</td>
                      <td>{sensor.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </section>

      <RealtimeAlertList alerts={alerts} />
    </div>
  )
}
