import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { RealtimeAlertList } from '../components/dashboard/RealtimeAlertList'
import { ScoreBar } from '../components/dashboard/ScoreBar'
import { getLatestAlerts } from '../services/auditService'
import type { AlertItem } from '../types'

export function DashboardPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const data = await getLatestAlerts(20)
        setAlerts(data)
      } finally {
        setLoading(false)
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

  const score = useMemo(() => {
    const penalty = alerts.reduce((acc, item) => {
      if (item.severity === 'critical') return acc + 20
      if (item.severity === 'warning') return acc + 8
      return acc + 2
    }, 0)

    return Math.max(0, 100 - penalty)
  }, [alerts])

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Score bar và cảnh báo được cập nhật định kỳ"
      />
      {loading ? <p>Đang tải cảnh báo...</p> : null}
      <ScoreBar score={score} />
      <RealtimeAlertList alerts={alerts} />
    </div>
  )
}
