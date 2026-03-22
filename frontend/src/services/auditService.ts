import { supabase } from '../lib/supabase'
import type { AlertItem, AuditLog } from '../types'

export async function getAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as AuditLog[]
}

export async function getLatestAlerts(limit = 20) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as AlertItem[]
}
