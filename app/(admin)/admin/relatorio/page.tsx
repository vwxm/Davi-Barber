export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { currentWeekMonday, addDays } from '@/lib/business-rules/monthly'

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function dayBR(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

interface Row {
  status: string
  service: { price: number } | null
}

export default async function RelatorioPage() {
  const supabase = await createClient()
  const monday = currentWeekMonday(new Date().toISOString())
  const saturday = addDays(monday, 5)

  const { data } = await supabase
    .from('appointments')
    .select('status, service:services(price)')
    .gte('date', monday)
    .lte('date', saturday)

  const rows = (data ?? []) as unknown as Row[]
  const price = (r: Row) => Number(r.service?.price ?? 0)

  const completed = rows.filter((r) => r.status === 'completed')
  const scheduled = rows.filter((r) => r.status === 'scheduled')
  const noShow = rows.filter((r) => r.status === 'no_show')
  const canceled = rows.filter((r) => r.status === 'canceled')

  const revenue = completed.reduce((s, r) => s + price(r), 0)
  const expected = scheduled.reduce((s, r) => s + price(r), 0)

  const tiles = [
    { label: 'Concluídos', value: String(completed.length), accent: 'text-green-400' },
    { label: 'Faturamento', value: brl(revenue), accent: 'text-green-400' },
    { label: 'Agendados', value: String(scheduled.length), accent: 'text-amber-400' },
    { label: 'Previsto', value: brl(expected), accent: 'text-amber-400' },
    { label: 'Faltas', value: String(noShow.length), accent: 'text-zinc-300' },
    { label: 'Cancelados', value: String(canceled.length), accent: 'text-red-400' },
  ]

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatório da Semana</h1>
        <p className="text-zinc-400 text-sm">{dayBR(monday)} a {dayBR(saturday)}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${t.accent}`}>{t.value}</p>
            <p className="text-zinc-400 text-sm mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <p className="text-zinc-500 text-xs">
        Faturamento = soma dos serviços concluídos. Previsto = serviços ainda agendados.
      </p>
    </div>
  )
}
