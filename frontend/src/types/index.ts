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
