export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { MensaisManager, type WeekAppointment } from '@/components/admin/MensaisManager'
import { ensureCurrentWeekMonthlyAppointments } from '@/lib/monthly/ensure'
import { currentWeekMonday } from '@/lib/business-rules/monthly'
import { MonthlyClient, Client, Service } from '@/types'

export default async function MensaisPage() {
  await ensureCurrentWeekMonthlyAppointments()

  const supabase = await createClient()
  const weekMonday = currentWeekMonday(new Date().toISOString())

  const [{ data: monthlyClientsData }, { data: clientsData }, { data: servicesData }, { data: weekAppts }] = await Promise.all([
    supabase
      .from('monthly_clients')
      .select('*, client:clients(id,name,phone,is_monthly,created_at,updated_at), service:services(id,name,price,duration_minutes,active,created_at,updated_at)')
      .eq('active', true)
      .order('weekday')
      .order('start_time'),
    supabase.from('clients').select('id,name,phone,is_monthly,created_at,updated_at').order('name'),
    supabase.from('services').select('id,name,price,duration_minutes,active,created_at,updated_at').eq('active', true).order('name'),
    supabase
      .from('appointments')
      .select('id, date, start_time, monthly_client_id')
      .eq('week_start', weekMonday)
      .eq('status', 'scheduled')
      .not('monthly_client_id', 'is', null),
  ])

  const monthlyClients: MonthlyClient[] = (monthlyClientsData ?? []) as MonthlyClient[]
  const clients: Client[] = (clientsData ?? []) as Client[]
  const services: Service[] = (servicesData ?? []) as Service[]

  // Map monthly_client_id -> this week's materialized appointment.
  const weekAppointments: Record<string, WeekAppointment> = {}
  for (const a of weekAppts ?? []) {
    if (a.monthly_client_id) {
      weekAppointments[a.monthly_client_id] = {
        id: a.id,
        date: a.date,
        start_time: a.start_time.slice(0, 5),
      }
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-white">Clientes Mensais</h1>
      <MensaisManager
        monthlyClients={monthlyClients}
        clients={clients}
        services={services}
        weekAppointments={weekAppointments}
        weekMonday={weekMonday}
      />
    </div>
  )
}
