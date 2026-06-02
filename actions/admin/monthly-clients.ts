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
  const { data: monthlyClient, error } = await supabase
    .from('monthly_clients')
    .insert({
      client_id: data.client_id,
      service_id: data.service_id,
      weekday: data.weekday,
      start_time: data.start_time,
      notes: data.notes ?? null,
      active: true,
    })
    .select('*, client:clients(id,name,phone,is_monthly,created_at,updated_at), service:services(id,name,price,duration_minutes,active,created_at,updated_at)')
    .single()

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
