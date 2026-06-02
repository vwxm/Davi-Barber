export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BookingSection from '@/components/client/BookingSection'
import type { Service } from '@/types'

function buildAvailableDates(): string[] {
  const tz = 'America/Sao_Paulo'
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const today = new Date(todayStr + 'T12:00:00')
  const dow = today.getDay() // 0=Sun 6=Sat
  const daysUntilSat = dow === 0 ? 6 : 6 - dow
  const result: string[] = []
  for (let i = 0; i <= daysUntilSat; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    if (d.getDay() !== 0) { // skip Sunday
      result.push(d.toLocaleDateString('en-CA', { timeZone: tz }))
    }
  }
  return result
}

export default async function AgendarPage() {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    redirect('/login')
  }

  const { data: services } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, active, created_at, updated_at')
    .eq('active', true)
    .order('name')

  const availableDates = buildAvailableDates()

  return (
    <div className="py-6">
      <h1 className="text-white text-2xl font-bold mb-6">Agendar</h1>
      <BookingSection services={(services ?? []) as Service[]} availableDates={availableDates} />
    </div>
  )
}
