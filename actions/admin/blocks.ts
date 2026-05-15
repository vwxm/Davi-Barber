'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { ScheduleBlock } from '@/types'

export async function createBlock(data: {
  date: string
  full_day: boolean
  start_time?: string
  end_time?: string
  reason?: string
}): Promise<{ block?: ScheduleBlock; error?: string }> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (data.date < today) return { error: 'A data não pode ser no passado.' }

  if (!data.full_day) {
    if (!data.start_time || !data.end_time) return { error: 'Horário de início e fim são obrigatórios.' }
    if (data.end_time <= data.start_time) return { error: 'Horário de fim deve ser após o horário de início.' }
  }

  const supabase = createAdminClient()
  const { data: block, error } = await supabase
    .from('schedule_blocks')
    .insert({
      date: data.date,
      full_day: data.full_day,
      start_time: data.full_day ? null : (data.start_time ?? null),
      end_time: data.full_day ? null : (data.end_time ?? null),
      reason: data.reason ?? null,
      active: true,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { block }
}

export async function deactivateBlock(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('schedule_blocks').update({ active: false }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}
