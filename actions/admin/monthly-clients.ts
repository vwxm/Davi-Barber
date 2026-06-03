'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { MonthlyClient } from '@/types'

export async function createMonthlyClient(data: {
  client_id: string
  service_id: string
  weekday: number
  start_time: string
  notes?: string
}): Promise<{ monthlyClient?: MonthlyClient; error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  if (!data.client_id) return { error: 'Cliente é obrigatório.' }
  if (!data.service_id) return { error: 'Serviço é obrigatório.' }
  if (data.weekday < 0 || data.weekday > 6) return { error: 'Dia da semana inválido.' }
  if (!data.start_time) return { error: 'Horário é obrigatório.' }

  const supabase = createAdminClient()
  const selectCols =
    '*, client:clients(id,name,phone,is_monthly,created_at,updated_at), service:services(id,name,price,duration_minutes,active,created_at,updated_at)'

  // client_id is UNIQUE: a client can hold at most one monthly_clients row.
  // Look for an existing row (active or deactivated) before inserting.
  const { data: existing } = await supabase
    .from('monthly_clients')
    .select('id, active')
    .eq('client_id', data.client_id)
    .maybeSingle()

  if (existing?.active) {
    return { error: 'Esse cliente já é mensalista.' }
  }

  const row = {
    client_id: data.client_id,
    service_id: data.service_id,
    weekday: data.weekday,
    start_time: data.start_time,
    notes: data.notes ?? null,
    active: true,
  }

  // Reactivate/replace a deactivated row, otherwise insert a new one.
  const query = existing
    ? supabase.from('monthly_clients').update(row).eq('id', existing.id)
    : supabase.from('monthly_clients').insert(row)

  const { data: monthlyClient, error } = await query.select(selectCols).single()

  if (error) return { error: error.message }
  return { monthlyClient }
}

export async function deactivateMonthlyClient(id: string): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { error } = await supabase.from('monthly_clients').update({ active: false }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}
