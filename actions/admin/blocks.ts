'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { ScheduleBlock } from '@/types'

export async function createBlock(data: {
  date: string
  date_end?: string
  full_day: boolean
  start_time?: string
  end_time?: string
  reason?: string
}): Promise<{ block?: ScheduleBlock; error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (data.date < today) return { error: 'A data não pode ser no passado.' }

  // Período (intervalo de datas) é sempre dia inteiro.
  const isPeriod = !!data.date_end
  const fullDay = isPeriod ? true : data.full_day

  if (isPeriod) {
    if (data.date_end! < data.date) return { error: 'A data fim deve ser igual ou após a data início.' }
  }

  if (!fullDay) {
    if (!data.start_time || !data.end_time) return { error: 'Horário de início e fim são obrigatórios.' }
    if (data.end_time <= data.start_time) return { error: 'Horário de fim deve ser após o horário de início.' }
  }

  const supabase = createAdminClient()
  const { data: block, error } = await supabase
    .from('schedule_blocks')
    .insert({
      date: data.date,
      date_end: data.date_end ?? null,
      full_day: fullDay,
      start_time: fullDay ? null : (data.start_time ?? null),
      end_time: fullDay ? null : (data.end_time ?? null),
      reason: data.reason ?? null,
      active: true,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { block }
}

export async function deactivateBlock(id: string): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { error } = await supabase.from('schedule_blocks').update({ active: false }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}
