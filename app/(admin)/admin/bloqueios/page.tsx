export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { BloqueiosManager } from '@/components/admin/BloqueiosManager'
import { ScheduleBlock } from '@/types'

export default async function BloqueiosPage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const supabase = await createClient()
  const { data } = await supabase
    .from('schedule_blocks')
    .select('*')
    .gte('date', today)
    .order('date')
    .eq('active', true)
  const blocks: ScheduleBlock[] = data ?? []

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-white">Bloqueios de Agenda</h1>
      <BloqueiosManager blocks={blocks} />
    </div>
  )
}
