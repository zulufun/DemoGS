import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { getVertivSnapshot } from '../services/vertivService'
import type { VertivSnapshot } from '../types'

const refreshFromEnv = Number(import.meta.env.VITE_VERTIV_REFRESH_MS || 30000)
const refreshMs = Number.isFinite(refreshFromEnv) ? Math.max(10000, refreshFromEnv) : 30000

const vertivConnection = {
  base_url: import.meta.env.VITE_VERTIV_BASE_URL?.trim() || undefined,
  path: import.meta.env.VITE_VERTIV_PATH?.trim() || undefined,
}

function formatMetric(value: number | null, unit: string) {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  const precision = unit === '%' ? 0 : 1
  return `${value.toFixed(precision)} ${unit}`
}

export function MonitoringVertivPage() {
  const [snapshot, setSnapshot] = useState<VertivSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSnapshot = async () => {
    try {
      const data = await getVertivSnapshot(vertivConnection)
      setSnapshot(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khong the lay du lieu nhiet do/do am tu Vertiv')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSnapshot()
    const intervalId = window.setInterval(() => {
      void loadSnapshot()
    }, refreshMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const lastUpdated = useMemo(() => {
    if (!snapshot?.source.fetched_at) {
      return '-'
    }
    return new Date(snapshot.source.fetched_at).toLocaleString('vi-VN')
  }, [snapshot?.source.fetched_at])

  return (
    <div>
      <PageHeader
        title="Giam sat / Vertiv Enviroment Alert"
        subtitle="Hien thi live nhiet do va do am tu thiet bi giam sat moi truong"
        action={<button onClick={() => void loadSnapshot()}>Lam moi</button>}
      />

      <section className="panel">
        <h2>Thong tin ket noi Vertiv</h2>
        <table className="table">
          <tbody>
            <tr>
              <th>Base URL</th>
              <td>{snapshot?.source.base_url || vertivConnection.base_url || '-'}</td>
            </tr>
            <tr>
              <th>Endpoint</th>
              <td>{snapshot?.source.endpoint || vertivConnection.path || '-'}</td>
            </tr>
            <tr>
              <th>Cap nhat luc</th>
              <td>{lastUpdated}</td>
            </tr>
            <tr>
              <th>Chu ky refresh</th>
              <td>{Math.round(refreshMs / 1000)} giay</td>
            </tr>
          </tbody>
        </table>
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>Dang tai du lieu Vertiv...</p> : null}

      <section className="panel">
        <h2>Chi so moi truong realtime</h2>
        <div className="vertiv-metrics">
          <article className="vertiv-metric temperature">
            <h3>Nhiet do</h3>
            <strong>
              {formatMetric(
                snapshot?.measurements.temperature.value ?? null,
                snapshot?.measurements.temperature.unit || 'C',
              )}
            </strong>
          </article>

          <article className="vertiv-metric humidity">
            <h3>Do am</h3>
            <strong>
              {formatMetric(
                snapshot?.measurements.humidity.value ?? null,
                snapshot?.measurements.humidity.unit || '%',
              )}
            </strong>
          </article>

          <article className="vertiv-metric other">
            <h3>So luong cam bien</h3>
            <strong>{snapshot?.summary.total_sensors ?? 0}</strong>
            <p>
              Nhiet do: {snapshot?.summary.temperature_count ?? 0} | Do am:{' '}
              {snapshot?.summary.humidity_count ?? 0}
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>Bang nhiet do va do am</h2>
        <table className="table vertiv-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Thiet bi</th>
              <th>Ten cam bien</th>
              <th>Duong dan point</th>
              <th>Loai</th>
              <th>Gia tri</th>
              <th>Don vi</th>
              <th>Trang thai</th>
              <th>Du lieu goc</th>
            </tr>
          </thead>
          <tbody>
            {snapshot?.sensors.map((sensor, index) => (
              <tr key={sensor.id || `${sensor.name}-${sensor.type}-${index}`}>
                <td>{index + 1}</td>
                <td>{sensor.device || '-'}</td>
                <td>{sensor.name}</td>
                <td>{sensor.point_path || '-'}</td>
                <td>{sensor.type === 'temperature' ? 'Nhiet do' : 'Do am'}</td>
                <td>{sensor.value}</td>
                <td>{sensor.unit}</td>
                <td>{sensor.status || '-'}</td>
                <td>{sensor.raw}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {snapshot?.attempts.length ? (
        <section className="panel">
          <h2>Lich su thu endpoint</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Ghi chu</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.attempts.map((attempt) => (
                <tr key={attempt.endpoint}>
                  <td>{attempt.endpoint}</td>
                  <td>{attempt.status_code ?? '-'}</td>
                  <td>{attempt.error || (attempt.ok ? 'OK' : 'Failed')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}
