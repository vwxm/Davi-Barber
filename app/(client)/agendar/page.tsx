export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBookingWeekDates } from '@/lib/business-rules/booking-window'
import BookingSection from '@/components/client/BookingSection'
import type { Service } from '@/types'

export default async function AgendarPage() {
  const supabase = await createClient()

  const [{ data: authData }, { data: services }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('services')
      .select('id, name, price, duration_minutes, active, created_at, updated_at')
      .eq('active', true)
      .order('name'),
  ])
  if (!authData.user) {
    redirect('/login')
  }

  const availableDates = getBookingWeekDates()

  // Sundays: the next week's agenda only opens on Monday.
  if (availableDates.length === 0) {
    return (
      <div className="py-6">
        <h1 className="text-white text-2xl font-bold mb-6">Agendar</h1>
        <div className="bg-zinc-800 rounded-xl p-6 text-center">
          <p className="text-zinc-300">A agenda da próxima semana abre segunda-feira.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-6">
      <h1 className="text-white text-2xl font-bold mb-6">Agendar</h1>
      <BookingSection services={(services ?? []) as Service[]} availableDates={availableDates} />
    </div>
  )
}
