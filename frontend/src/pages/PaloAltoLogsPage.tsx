import { useEffect, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { paloaltoService } from '../services/paloaltoService'
import type { LogCountResponse, LogsByServerResponse, LogsByActionResponse } from '../services/paloaltoService'
import './PaloAltoLogsPage.css'

const KIBANA_DASHBOARD_URL = import.meta.env.VITE_KIBANA_URL || 'http://localhost:5601'
const KIBANA_DASHBOARD_ID = import.meta.env.VITE_KIBANA_DASHBOARD_ID || ''

export function PaloAltoLogsPage() {
  const [logsCount, setLogsCount] = useState<LogCountResponse | null>(null)
  const [logsByServer, setLogsByServer] = useState<LogsByServerResponse | null>(null)
  const [logsByAction, setLogsByAction] = useState<LogsByActionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setError('')
      const [count, byServer, byAction] = await Promise.all([
        paloaltoService.getLogsCount(),
        paloaltoService.getLogsByServer(),
        paloaltoService.getLogsByAction(),
      ])
      
      setLogsCount(count)
      setLogsByServer(byServer)
      setLogsByAction(byAction)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // Refresh every 30 seconds
    const intervalId = window.setInterval(() => {
      void loadData()
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [])

  const kibanaEmbedUrl = KIBANA_DASHBOARD_ID 
    ? `${KIBANA_DASHBOARD_URL}/app/kibana#/dashboard/${KIBANA_DASHBOARD_ID}?embed=true&_a=(refreshInterval:(pause:!f,value:10000),timeRestore:!t,timeFrom:now-24h,timeTo:now)`
    : `${KIBANA_DASHBOARD_URL}/app/discover#/?_a=(index:'c43e87a6-cd59-45bf-b31a-103157c50ffb',query:(match_all:()),sort:!(!('@timestamp',desc)))`

  return (
    <div className="paloalto-page">
      <PageHeader title="Giám sát Palo Alto Firewall" subtitle="Theo dõi log thời gian thực từ tường lửa" />

      {error && <div className="error-message">{error}</div>}

      {loading && <div className="loading">Đang tải dữ liệu...</div>}

      {!loading && (
        <>
          {/* Summary Section */}
          <div className="summary-section">
            <div className="stats-card">
              <div className="stat-value">{logsCount?.total_logs.toLocaleString() || 0}</div>
              <div className="stat-label">Tổng cộng sự kiện</div>
              <div className="stat-description">Log thu thập từ Palo Alto</div>
            </div>

            <div className="stats-card">
              <div className="stat-value">{logsByServer?.servers.length || 0}</div>
              <div className="stat-label">Máy chủ / Địa điểm</div>
              <div className="stat-description">Nguồn gửi log</div>
            </div>

            <div className="stats-card">
              <div className="stat-value">{logsByAction?.actions.length || 0}</div>
              <div className="stat-label">Loại sự kiện</div>
              <div className="stat-description">Hành động được ghi lại</div>
            </div>
          </div>

          {/* Breakdown by Location */}
          <div className="breakdown-section">
            <div className="breakdown-card">
              <h3>📍 Log theo vị trí / Máy chủ</h3>
              {logsByServer && logsByServer.servers.length > 0 ? (
                <div className="breakdown-list">
                  {logsByServer.servers.map((server) => (
                    <div key={server.name} className="breakdown-item">
                      <span className="server-name">{server.name || 'Unknown'}</span>
                      <span className="server-count">{server.count.toLocaleString()} log</span>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{
                            width: `${(server.count / (logsByServer.servers[0]?.count || 1)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">Không có dữ liệu</p>
              )}
            </div>

            <div className="breakdown-card">
              <h3>⚡ Log theo loại sự kiện</h3>
              {logsByAction && logsByAction.actions.length > 0 ? (
                <div className="breakdown-list">
                  {logsByAction.actions.slice(0, 10).map((action) => (
                    <div key={action.action} className="breakdown-item">
                      <span className="action-name">{action.action}</span>
                      <span className="action-count">{action.count.toLocaleString()} log</span>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{
                            width: `${(action.count / (logsByAction.actions[0]?.count || 1)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">Không có dữ liệu</p>
              )}
            </div>
          </div>

          {/* Kibana Dashboard Embed */}
          <div className="kibana-section">
            <h2>📊 Dashboard Kibana - Phân tích chi tiết</h2>
            <p className="kibana-description">
              Nhúng dashboard Kibana để xem phân tích chi tiết log từ Palo Alto firewall
            </p>
            <div className="kibana-container">
              <iframe
                src={kibanaEmbedUrl}
                title="Kibana Dashboard"
                className="kibana-iframe"
                allow="usb; clipboard-read; clipboard-write"
                // sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>

          {/* Refresh Button */}
          <div className="action-section">
            <button className="refresh-btn" onClick={() => void loadData()}>
              🔄 Tải lại dữ liệu
            </button>
          </div>
        </>
      )}
    </div>
  )
}
