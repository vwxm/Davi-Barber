export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyAppointments } from '@/actions/client/appointments'
import { AppointmentsList } from '@/components/client/AppointmentsList'

export default async function AgendamentosPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData.user) {
    redirect('/login')
  }

  const { appointments, error } = await getMyAppointments()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-white">Meus Agendamentos</h1>

      {error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <AppointmentsList appointments={appointments ?? []} />
      )}
    </div>
  )
}
