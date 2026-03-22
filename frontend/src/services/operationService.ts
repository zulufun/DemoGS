import { supabase } from '../lib/supabase'
import type { GateOpenLog, OperationTask } from '../types'

export async function listOperationTasks() {
  const { data, error } = await supabase
    .from('operation_tasks')
    .select('*')
    .order('task_date', { ascending: false })
    .order('start_time', { ascending: false })

  if (error) throw error
  return (data ?? []) as OperationTask[]
}

export async function upsertOperationTask(payload: Partial<OperationTask>) {
  const { error } = await supabase.from('operation_tasks').upsert(payload)
  if (error) throw error
}

export async function completeOperationTask(taskId: string, endTime: string, resultContent: string) {
  const { error } = await supabase
    .from('operation_tasks')
    .update({
      end_time: endTime,
      result_content: resultContent,
    })
    .eq('id', taskId)

  if (error) throw error
}

export async function deleteOperationTask(id: string) {
  const { error } = await supabase.from('operation_tasks').delete().eq('id', id)
  if (error) throw error
}

export async function listGateOpenLogs() {
  const { data, error } = await supabase
    .from('gate_open_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as GateOpenLog[]
}

export async function upsertGateOpenLog(payload: Partial<GateOpenLog>) {
  const { error } = await supabase.from('gate_open_logs').upsert(payload)
  if (error) throw error
}

export async function deleteGateOpenLog(id: string) {
  const { error } = await supabase.from('gate_open_logs').delete().eq('id', id)
  if (error) throw error
}
