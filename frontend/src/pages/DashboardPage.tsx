import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { RealtimeAlertList } from '../components/dashboard/RealtimeAlertList'
import { ScoreBar } from '../components/dashboard/ScoreBar'
import { getElasticOverview7d, getLatestAlerts } from '../services/auditService'
import { getPrtgLiveSummary } from '../services/prtgService'
import { getVertivSnapshot } from '../services/vertivService'
import type { AlertItem, ElasticOverviewStats, PrtgLiveSummary, VertivSnapshot } from '../types'

const prtgBaseUrl = import.meta.env.VITE_PRTG_URL?.trim() || undefined
const prtgUsername = import.meta.env.VITE_PRTG_USERNAME?.trim() || undefined
const prtgPasshash = import.meta.env.VITE_PRTG_PASSHASH?.trim() || undefined
const prtgCount = Number(import.meta.env.VITE_PRTG_COUNT || 1000)

const defaultPrtgSource = {
  base_url: prtgBaseUrl,
  username: prtgUsername,
  passhash: prtgPasshash,
  count: Number.isFinite(prtgCount) ? prtgCount : 1000,
}

const vertivBaseUrl = import.meta.env.VITE_VERTIV_BASE_URL?.trim() || undefined
const vertivUsername = import.meta.env.VITE_VERTIV_USERNAME?.trim() || undefined
const vertivPassword = import.meta.env.VITE_VERTIV_PASSWORD?.trim() || undefined

const defaultVertivSource = {
  base_url: vertivBaseUrl,
  username: vertivUsername,
  password: vertivPassword,
}

export function DashboardPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [alertLoading, setAlertLoading] = useState(true)
  const [prtgLoading, setPrtgLoading] = useState(true)
  const [prtgError, setPrtgError] = useState('')
  const [prtgSummary, setPrtgSummary] = useState<PrtgLiveSummary | null>(null)
  const [elasticLoading, setElasticLoading] = useState(true)
  const [elasticError, setElasticError] = useState('')
  const [elasticOverview, setElasticOverview] = useState<ElasticOverviewStats | null>(null)
  const [vertivLoading, setVertivLoading] = useState(true)
  const [vertivError, setVertivError] = useState('')
  const [vertivSnapshot, setVertivSnapshot] = useState<VertivSnapshot | null>(null)

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

    const loadVertivLive = async () => {
      try {
        const data = await getVertivSnapshot(defaultVertivSource)
        if (!mounted) return
        setVertivSnapshot(data)
        setVertivError('')
      } catch (error) {
        if (!mounted) return
        setVertivError(error instanceof Error ? error.message : 'Khong the tai du lieu Vertiv')
      } finally {
        if (mounted) {
          setVertivLoading(false)
        }
      }
    }

    void loadVertivLive()
    const intervalId = window.setInterval(() => {
      void loadVertivLive()
    }, 30000)

    return () => {
      mounted = false
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

  useEffect(() => {
    let mounted = true

    const loadElasticOverview = async () => {
      try {
        const data = await getElasticOverview7d()
        if (!mounted) return
        setElasticOverview(data)
        setElasticError('')
      } catch (error) {
        if (!mounted) return
        setElasticError(error instanceof Error ? error.message : 'Không thể tải thống kê Elastic 7 ngày')
      } finally {
        if (mounted) {
          setElasticLoading(false)
        }
      }
    }

    void loadElasticOverview()
    const intervalId = window.setInterval(() => {
      void loadElasticOverview()
    }, 30000)

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

    const elasticPenalty = elasticOverview
      ? Math.min(40, elasticOverview.critical_7d * 0.3 + elasticOverview.warning_7d * 0.1)
      : 0

    return Math.max(0, Math.round(100 - alertPenalty - livePenalty - elasticPenalty))
  }, [alerts, prtgSummary, elasticOverview])

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

  const unifiedSeverityRows = useMemo(() => {
    const prtgCritical = prtgSummary?.status_counts.down ?? 0
    const prtgWarning = prtgSummary?.status_counts.warning ?? 0
    const prtgInfo = (prtgSummary?.status_counts.up ?? 0) + (prtgSummary?.status_counts.other ?? 0)

    const elasticCritical = elasticOverview?.critical_7d ?? 0
    const elasticWarning = elasticOverview?.warning_7d ?? 0
    const elasticInfo = Math.max(
      0,
      (elasticOverview?.total_events_7d ?? 0) - (elasticOverview?.alerts_7d ?? 0),
    )

    return [
      {
        key: 'critical',
        label: 'Critical',
        prtg: prtgCritical,
        elastic: elasticCritical,
      },
      {
        key: 'warning',
        label: 'Warning',
        prtg: prtgWarning,
        elastic: elasticWarning,
      },
      {
        key: 'info',
        label: 'Info/Other',
        prtg: prtgInfo,
        elastic: elasticInfo,
      },
    ]
  }, [prtgSummary, elasticOverview])

  const unifiedScale = useMemo(() => {
    return Math.max(
      1,
      ...unifiedSeverityRows.map((item) => Math.max(item.prtg, item.elastic)),
    )
  }, [unifiedSeverityRows])

  const elasticDailyRows = useMemo(() => {
    if (!elasticOverview) return []
    const snapshotRisk = (prtgSummary?.status_counts.down ?? 0) + (prtgSummary?.status_counts.warning ?? 0)

    return elasticOverview.daily.map((day) => ({
      date: new Date(day.date),
      elasticAlerts: day.alerts,
      elasticTotal: day.total,
      prtgRiskSnapshot: snapshotRisk,
    }))
  }, [elasticOverview, prtgSummary])

  const dailyScale = useMemo(() => {
    return Math.max(
      1,
      ...elasticDailyRows.map((item) => Math.max(item.elasticAlerts, item.elasticTotal, item.prtgRiskSnapshot)),
    )
  }, [elasticDailyRows])

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
          <h2>Tổng quan log Elastic (7 ngày)</h2>
          {elasticOverview ? <strong>{elasticOverview.total_events_7d} sự kiện</strong> : null}
        </div>

        {elasticLoading && !elasticOverview ? <p>Đang tải số liệu Elasticsearch...</p> : null}
        {elasticError ? <p className="error-text">{elasticError}</p> : null}

        {elasticOverview ? (
          <>
            <div className="prtg-metrics">
              <article className="prtg-metric other">
                <h3>Hệ thống thu log</h3>
                <strong>{elasticOverview.systems_count}</strong>
              </article>
              <article className="prtg-metric good">
                <h3>Tổng sự kiện 7 ngày</h3>
                <strong>{elasticOverview.total_events_7d}</strong>
              </article>
              <article className="prtg-metric warn">
                <h3>Cảnh báo 7 ngày</h3>
                <strong>{elasticOverview.alerts_7d}</strong>
              </article>
              <article className="prtg-metric danger">
                <h3>Sự kiện nghiêm trọng</h3>
                <strong>{elasticOverview.critical_7d}</strong>
              </article>
            </div>

            {elasticOverview.top_hosts.length > 0 ? (
              <p className="prtg-meta">
                Nguồn log tiêu biểu:{' '}
                {elasticOverview.top_hosts
                  .map((item) => `${item.host} (${item.count})`)
                  .join(' | ')}
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="panel">
        <h2>Biểu đồ hình thái cảnh báo tổng hợp</h2>
        <div className="prtg-grid">
          <section className="prtg-chart-block">
            <h3>So sánh mức độ theo nguồn (PRTG vs Elastic 7 ngày)</h3>
            <ul className="bar-list dual-bar-list">
              {unifiedSeverityRows.map((row) => {
                const prtgWidth = (row.prtg / unifiedScale) * 100
                const elasticWidth = (row.elastic / unifiedScale) * 100

                return (
                  <li key={row.key} className="dual-bar-item">
                    <span>{row.label}</span>
                    <div className="dual-bar-column">
                      <div className="dual-bar-row">
                        <em>PRTG</em>
                        <div className="bar-track">
                          <div className={`bar-fill ${row.key === 'critical' ? 'danger' : row.key === 'warning' ? 'warn' : 'other'}`} style={{ width: `${Math.max(prtgWidth, row.prtg > 0 ? 4 : 0)}%` }} />
                        </div>
                        <strong>{row.prtg}</strong>
                      </div>
                      <div className="dual-bar-row">
                        <em>Elastic</em>
                        <div className="bar-track">
                          <div className={`bar-fill ${row.key === 'critical' ? 'danger' : row.key === 'warning' ? 'warn' : 'good'}`} style={{ width: `${Math.max(elasticWidth, row.elastic > 0 ? 4 : 0)}%` }} />
                        </div>
                        <strong>{row.elastic}</strong>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="prtg-chart-block">
            <h3>Xu hướng 7 ngày: Elastic alerts và mức rủi ro PRTG hiện tại</h3>
            <ul className="bar-list dual-bar-list">
              {elasticDailyRows.map((row) => {
                const elasticWidth = (row.elasticAlerts / dailyScale) * 100
                const prtgWidth = (row.prtgRiskSnapshot / dailyScale) * 100
                return (
                  <li key={row.date.toISOString()} className="dual-bar-item">
                    <span>{row.date.toLocaleDateString('vi-VN')}</span>
                    <div className="dual-bar-column">
                      <div className="dual-bar-row">
                        <em>Elastic alerts</em>
                        <div className="bar-track">
                          <div className="bar-fill danger" style={{ width: `${Math.max(elasticWidth, row.elasticAlerts > 0 ? 4 : 0)}%` }} />
                        </div>
                        <strong>{row.elasticAlerts}</strong>
                      </div>
                      <div className="dual-bar-row">
                        <em>PRTG risk</em>
                        <div className="bar-track">
                          <div className="bar-fill warn" style={{ width: `${Math.max(prtgWidth, row.prtgRiskSnapshot > 0 ? 4 : 0)}%` }} />
                        </div>
                        <strong>{row.prtgRiskSnapshot}</strong>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </section>

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

      <section className="panel">
        <div className="score-line">
          <h2>Bang tat ca thong so nhiet do va do am (Vertiv)</h2>
          {vertivSnapshot ? <strong>{vertivSnapshot.summary.total_sensors} points</strong> : null}
        </div>

        {vertivLoading && !vertivSnapshot ? <p>Dang tai du lieu Vertiv...</p> : null}
        {vertivError ? <p className="error-text">{vertivError}</p> : null}

        {vertivSnapshot ? (
          <>
            <p className="prtg-meta">
              Endpoint: {vertivSnapshot.source.endpoint} | Cap nhat:{' '}
              {new Date(vertivSnapshot.source.fetched_at).toLocaleString('vi-VN')} | Nhiet do:{' '}
              {vertivSnapshot.summary.temperature_count} | Do am: {vertivSnapshot.summary.humidity_count}
            </p>

            <div className="vertiv-table-wrap">
              <table className="table vertiv-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Thiet bi</th>
                    <th>Ten point</th>
                    <th>Duong dan</th>
                    <th>Loai</th>
                    <th>Gia tri</th>
                    <th>Don vi</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vertivSnapshot.sensors.map((sensor, index) => (
                    <tr key={sensor.id || `${sensor.point_path}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{sensor.device || '-'}</td>
                      <td>{sensor.name}</td>
                      <td>{sensor.point_path}</td>
                      <td>{sensor.type === 'temperature' ? 'Nhiet do' : 'Do am'}</td>
                      <td>{sensor.value}</td>
                      <td>{sensor.unit}</td>
                      <td>{sensor.status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <RealtimeAlertList alerts={alerts} />
    </div>
  )
}
