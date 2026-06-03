export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyAppointments } from '@/actions/client/appointments'
import { ensureCurrentWeekMonthlyAppointments } from '@/lib/monthly/ensure'
import { getBookingWeekDates } from '@/lib/business-rules/booking-window'
import { AppointmentsList } from '@/components/client/AppointmentsList'

export default async function AgendamentosPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData.user) {
    redirect('/login')
  }

  // Self-heal: ensure this week's monthly occurrence exists so the client sees it.
  await ensureCurrentWeekMonthlyAppointments()

  const { appointments, error } = await getMyAppointments()
  const availableDates = getBookingWeekDates()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-white">Meus Agendamentos</h1>

      {error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <AppointmentsList appointments={appointments ?? []} availableDates={availableDates} />
      )}
    </div>
  )
}
