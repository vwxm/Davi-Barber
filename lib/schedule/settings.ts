import { createAdminClient } from '@/lib/supabase/admin'
import type { EffectiveHours } from '@/lib/business-rules/slots'
import type { ScheduleSettings } from '@/types'

const FALLBACK: ScheduleSettings = {
  id: 1,
  open_time: '10:00',
  close_time: '20:00',
  min_lead_minutes: 60,
  updated_at: '',
}

// time columns come back as 'HH:MM:SS' — normalize to 'HH:MM'.
function hm(t: string): string {
  return t.slice(0, 5)
}

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (!data) return FALLBACK
  return { ...data, open_time: hm(data.open_time), close_time: hm(data.close_time) }
}

export async function getEffectiveHours(date: string): Promise<{
  hours: EffectiveHours
  fromOverride: boolean
  settings: ScheduleSettings
}> {
  const supabase = createAdminClient()
  const [settings, { data: override }] = await Promise.all([
    getScheduleSettings(),
    supabase.from('day_overrides').select('*').eq('date', date).maybeSingle(),
  ])

  if (override) {
    return {
      hours: { start: hm(override.open_time), end: hm(override.close_time) },
      fromOverride: true,
      settings,
    }
  }
  return {
    hours: { start: settings.open_time, end: settings.close_time },
    fromOverride: false,
    settings,
  }
}
