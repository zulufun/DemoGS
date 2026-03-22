import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { RealtimeAlertList } from '../components/dashboard/RealtimeAlertList'
import { ScoreBar } from '../components/dashboard/ScoreBar'
import { getLatestAlerts } from '../services/auditService'
import { supabase } from '../lib/supabase'
import type { AlertItem } from '../types'

export function DashboardPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const data = await getLatestAlerts(20)
        setAlerts(data)
      } finally {
        setLoading(false)
      }
    })()

    const channel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const inserted = payload.new as AlertItem
          setAlerts((prev) => [inserted, ...prev].slice(0, 20))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
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
        subtitle="Score bar và cảnh báo realtime từ Supabase Realtime"
      />
      {loading ? <p>Đang tải cảnh báo...</p> : null}
      <ScoreBar score={score} />
      <RealtimeAlertList alerts={alerts} />
    </div>
  )
}
