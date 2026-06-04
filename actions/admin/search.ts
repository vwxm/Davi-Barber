'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import type { Appointment } from '@/types'

// Search appointments by access code, client/guest name, or phone.
export async function searchAppointments(
  query: string,
): Promise<{ results?: Appointment[]; error?: string }> {
  const authError = await requireAdmin()
  if (authError) return { error: authError.error }

  // Strip characters that would break the PostgREST or() filter syntax.
  const safe = query.trim().replace(/[,%()*\\]/g, '')
  if (safe.length < 2) return { results: [] }
  const digits = safe.replace(/\D/g, '')

  const supabase = createAdminClient()

  // Clients whose name or phone matches.
  const clientOr = [`name.ilike.%${safe}%`]
  if (digits.length >= 3) clientOr.push(`phone.ilike.%${digits}%`)
  const { data: clients } = await supabase.from('clients').select('id').or(clientOr.join(','))
  const clientIds = (clients ?? []).map((c) => c.id)

  // Match on the appointment itself (code, guest fields) or a matching client.
  const apptOr = [`access_code.ilike.%${safe}%`, `guest_name.ilike.%${safe}%`]
  if (digits.length >= 3) apptOr.push(`guest_phone.ilike.%${digits}%`)
  if (clientIds.length > 0) apptOr.push(`client_id.in.(${clientIds.join(',')})`)

  const { data, error } = await supabase
    .from('appointments')
    .select('*, service:services(name), client:clients(name, phone)')
    .or(apptOr.join(','))
    .order('date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(50)

  if (error) return { error: 'Erro na busca.' }
  return { results: (data ?? []) as Appointment[] }
}
