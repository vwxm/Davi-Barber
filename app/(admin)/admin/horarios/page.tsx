export const dynamic = 'force-dynamic'
import { getScheduleSettings } from '@/lib/schedule/settings'
import { createClient } from '@/lib/supabase/server'
import { HorariosManager } from '@/components/admin/HorariosManager'
import type { ScheduleBlock } from '@/types'

export default async function HorariosPage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const supabase = await createClient()
  const [settings, { data }] = await Promise.all([
    getScheduleSettings(),
    supabase
      .from('schedule_blocks')
      .select('*')
      .gte('date', today)
      .order('date')
      .eq('active', true)
      .eq('kind', 'bloqueio'), // grid-managed "fechado" rows stay out of the list
  ])
  const blocks: ScheduleBlock[] = data ?? []

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-white">Horários</h1>
      <HorariosManager settings={settings} blocks={blocks} />
    </div>
  )
}
