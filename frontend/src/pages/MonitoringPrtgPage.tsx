import { useEffect, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { getPrtgLiveSummary } from '../services/prtgService'
import type { PrtgLiveSummary } from '../types'

const prtgConnection = {
  base_url: import.meta.env.VITE_PRTG_URL || 'http://10.1.0.2',
  username: import.meta.env.VITE_PRTG_USERNAME || 'tt6',
  passhash: import.meta.env.VITE_PRTG_PASSHASH || '1066006246',
  count: Number(import.meta.env.VITE_PRTG_COUNT || 2000),
}

function maskPasshash(value: string) {
  if (!value) return '-'
  if (value.length <= 4) return '****'
  return `${value.slice(0, 2)}******${value.slice(-2)}`
}

export function MonitoringPrtgPage() {
  const [summary, setSummary] = useState<PrtgLiveSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const loadLiveData = async () => {
    try {
      const data = await getPrtgLiveSummary(prtgConnection)
      setSummary(data)
      setMessage('Đang đồng bộ live data từ PRTG HTTP API thành công')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể đọc dữ liệu live từ PRTG')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLiveData()
    const intervalId = window.setInterval(() => {
      void loadLiveData()
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <div>
      <PageHeader
        title="Giám sát / PRTG Live"
        subtitle="Đọc dữ liệu realtime từ PRTG HTTP API ở chế độ chỉ xem"
        action={<button onClick={() => void loadLiveData()}>Làm mới</button>}
      />

      <section className="panel">
        <h2>Thông tin kết nối PRTG server</h2>
        <table className="table">
          <tbody>
            <tr>
              <th>Base URL</th>
              <td>{prtgConnection.base_url}</td>
            </tr>
            <tr>
              <th>Username</th>
              <td>{prtgConnection.username}</td>
            </tr>
            <tr>
              <th>Passhash</th>
              <td>{maskPasshash(prtgConnection.passhash)}</td>
            </tr>
            <tr>
              <th>Endpoint</th>
              <td>/api/table.json?content=sensors&columns=objid,sensor,device,status,message,lastvalue,lastup,priority</td>
            </tr>
            <tr>
              <th>Auth mode</th>
              <td>username + passhash (stateless per request)</td>
            </tr>
          </tbody>
        </table>
      </section>

      {message ? <p>{message}</p> : null}
      {loading ? <p>Đang tải dữ liệu PRTG live...</p> : null}

      <section className="panel">
        <h2>Dữ liệu live sensors từ PRTG</h2>
        {summary ? (
          <p className="prtg-meta">
            Version: {summary.source.prtg_version || 'N/A'} | Returned: {summary.source.returned_count}/
            {summary.source.total_count} | Updated:{' '}
            {new Date(summary.source.fetched_at).toLocaleString('vi-VN')}
          </p>
        ) : null}
        {summary?.source.is_truncated ? (
          <p className="error-text">
            Kết quả hiện đang bị cắt bớt ({summary.source.returned_count}/{summary.source.total_count}).
            Hãy tăng VITE_PRTG_COUNT để lấy đủ dữ liệu.
          </p>
        ) : null}

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
            {summary?.sensors.map((sensor) => (
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
    </div>
  )
}
