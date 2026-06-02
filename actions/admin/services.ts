'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { Service } from '@/types'

export async function createService(data: {
  name: string
  price: number
  duration_minutes: number
  active: boolean
}): Promise<{ service?: Service; error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  if (!data.name.trim()) return { error: 'Nome é obrigatório.' }
  if (data.price < 0) return { error: 'Preço deve ser maior ou igual a 0.' }
  if (data.duration_minutes < 1) return { error: 'Duração deve ser no mínimo 1 minuto.' }

  const supabase = createAdminClient()
  const { data: service, error } = await supabase
    .from('services')
    .insert({ name: data.name.trim(), price: data.price, duration_minutes: data.duration_minutes, active: data.active })
    .select()
    .single()

  if (error) return { error: error.message }
  return { service }
}

export async function updateService(
  id: string,
  data: { name: string; price: number; duration_minutes: number; active: boolean }
): Promise<{ service?: Service; error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  if (!data.name.trim()) return { error: 'Nome é obrigatório.' }
  if (data.price < 0) return { error: 'Preço deve ser maior ou igual a 0.' }
  if (data.duration_minutes < 1) return { error: 'Duração deve ser no mínimo 1 minuto.' }

  const supabase = createAdminClient()
  const { data: service, error } = await supabase
    .from('services')
    .update({ name: data.name.trim(), price: data.price, duration_minutes: data.duration_minutes, active: data.active })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  return { service }
}

export async function updateServiceActive(id: string, active: boolean): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { error } = await supabase.from('services').update({ active }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}
