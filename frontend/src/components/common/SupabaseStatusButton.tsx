import { useCallback, useEffect, useMemo, useState } from 'react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type StatusState = 'checking' | 'online' | 'degraded' | 'offline'

interface StatusResult {
  state: StatusState
  latencyMs: number | null
  message: string
  checkedAt: Date | null
}

const HEALTHCHECK_TIMEOUT_MS = 5000
const DEGRADED_THRESHOLD_MS = 1200

async function checkSupabaseHealth(): Promise<StatusResult> {
  const start = performance.now()
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS)

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
      },
      signal: controller.signal,
    })

    const latency = Math.round(performance.now() - start)

    if (!response.ok) {
      return {
        state: 'offline',
        latencyMs: latency,
        message: `Loi ket noi (${response.status})`,
        checkedAt: new Date(),
      }
    }

    return {
      state: latency > DEGRADED_THRESHOLD_MS ? 'degraded' : 'online',
      latencyMs: latency,
      message: latency > DEGRADED_THRESHOLD_MS ? 'Ket noi cham' : 'Ket noi on dinh',
      checkedAt: new Date(),
    }
  } catch {
    return {
      state: 'offline',
      latencyMs: null,
      message: 'Khong the ket noi Supabase',
      checkedAt: new Date(),
    }
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export function SupabaseStatusButton() {
  const [result, setResult] = useState<StatusResult>({
    state: 'checking',
    latencyMs: null,
    message: 'Dang kiem tra ket noi',
    checkedAt: null,
  })
  const [refreshing, setRefreshing] = useState(false)

  const refreshStatus = useCallback(async () => {
    setRefreshing(true)
    const nextResult = await checkSupabaseHealth()
    setResult(nextResult)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void refreshStatus()

    const intervalId = window.setInterval(() => {
      void refreshStatus()
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshStatus])

  const label = useMemo(() => {
    if (result.state === 'checking') return 'Supabase: checking'
    if (result.state === 'online') {
      return `Supabase: online${result.latencyMs !== null ? ` ${result.latencyMs}ms` : ''}`
    }
    if (result.state === 'degraded') {
      return `Supabase: slow${result.latencyMs !== null ? ` ${result.latencyMs}ms` : ''}`
    }

    return 'Supabase: offline'
  }, [result])

  const subtitle = useMemo(() => {
    if (!result.checkedAt) return result.message

    return `${result.message} - ${result.checkedAt.toLocaleTimeString('vi-VN')}`
  }, [result])

  return (
    <button
      className={`supabase-status-btn ${result.state}`}
      onClick={() => void refreshStatus()}
      type="button"
      title={subtitle}
      disabled={refreshing}
    >
      <span className="dot" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
