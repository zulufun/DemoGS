export type UserRole = 'admin' | 'user'

export interface UserProfile {
  id: string
  username: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface PrtgServer {
  id: string
  name: string
  base_url: string
  api_token: string | null
  username: string | null
  passhash: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PrtgLiveSensor {
  objid: number
  sensor: string
  device: string
  status: string
  status_raw: number
  message: string
  lastvalue: string
  lastup: string
  priority: number
}

export interface PrtgLiveSummary {
  source: {
    server_name: string
    base_url: string
    requested_count: number
    returned_count: number
    total_count: number
    is_truncated: boolean
    prtg_version: string | null
    fetched_at: string
  }
  status_counts: {
    up: number
    warning: number
    down: number
    other: number
  }
  priority_counts: Record<string, number>
  top_priority_sensors: PrtgLiveSensor[]
  sensors: PrtgLiveSensor[]
}

export interface AuditLog {
  id: number | string
  source: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  payload: Record<string, unknown> | null
  created_at: string
}

export interface AlertItem {
  id: number
  title: string
  severity: 'info' | 'warning' | 'critical'
  status: 'new' | 'ack' | 'resolved'
  score_impact: number
  description: string | null
  created_at: string
}

export interface ElasticDailyStats {
  date: string
  total: number
  alerts: number
  warning: number
  critical: number
}

export interface ElasticOverviewStats {
  systems_count: number
  total_events_7d: number
  alerts_7d: number
  warning_7d: number
  critical_7d: number
  top_hosts: Array<{
    host: string
    count: number
  }>
  daily: ElasticDailyStats[]
}

export interface AdminUserInput {
  email: string
  password?: string
  username: string
  role: UserRole
}

export interface AdminUserRecord {
  id: string
  email: string
  username: string
  role: UserRole
  created_at: string
}

export interface OperationTask {
  id: string
  task_date: string
  executor: string
  lead_person: string
  supervisor: string
  unit: string
  work_content: string
  start_time: string
  end_time: string | null
  result_content: string | null
  created_at: string
  updated_at: string
}

export interface GateOpenLog {
  id: string
  contact_first_name: string
  contact_last_name: string
  unit: string
  ip_source: string
  ip_dest: string
  port: string
  usage_time: string
  basis: string
  work_content: string
  opened_by: string
  created_at: string
  updated_at: string
}
