import { supabase } from '../lib/supabase'
import type { PrtgServer } from '../types'

export async function getPrtgServers() {
  const { data, error } = await supabase
    .from('prtg_servers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PrtgServer[]
}

export async function upsertPrtgServer(server: Partial<PrtgServer>) {
  const { error } = await supabase.from('prtg_servers').upsert(server)
  if (error) throw error
}

export async function deletePrtgServer(id: string) {
  const { error } = await supabase.from('prtg_servers').delete().eq('id', id)
  if (error) throw error
}

export async function syncPrtgNow(serverId?: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) throw new Error('Bạn chưa đăng nhập')

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prtg-ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serverId ? { serverId } : {}),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Đồng bộ PRTG thất bại: ${message}`)
  }
}
