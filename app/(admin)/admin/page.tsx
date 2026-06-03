export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import type { Appointment } from '@/types'
import { SyncButton } from '@/components/admin/SyncButton'
import { AppointmentActions } from '@/components/admin/AppointmentActions'
import { RetrySyncButton } from '@/components/admin/RetrySyncButton'
import { ensureCurrentWeekMonthlyAppointments } from '@/lib/monthly/ensure'

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}

function getGreeting(hourSP: number): string {
  if (hourSP >= 5 && hourSP < 12) return 'Bom dia'
  if (hourSP >= 12 && hourSP < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function getWeekRangeBR(): { start: string; end: string } {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  )
  const day = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = (day === 0 ? -6 : 1 - day)
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return { start: fmt(monday), end: fmt(sunday) }
}

export default async function AdminDashboardPage() {
  await ensureCurrentWeekMonthlyAppointments()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    'Admin'
  const firstName = userName.split(' ')[0] ?? userName

  const today = getTodayBR()
  const { start: weekStart, end: weekEnd } = getWeekRangeBR()

  const nowSP = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  )
  const hourSP = nowSP.getHours()
  const greeting = getGreeting(hourSP)

  // Today's appointments
  const { data: todayAppointments } = await supabase
    .from('appointments')
    .select('*, service:services(id,name), client:clients(id,name,phone)')
    .eq('date', today)
    .eq('status', 'scheduled')
    .order('start_time', { ascending: true })

  const appointments = (todayAppointments ?? []) as Appointment[]

  // This week's scheduled count
  const { count: weekCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'scheduled')
    .gte('date', weekStart)
    .lte('date', weekEnd)

  // Total clients count
  const { count: clientsCount } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })

  // Appointments whose calendar sync failed
  const { count: syncErrorCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('sync_status', 'error')
    .eq('status', 'scheduled')

  return (
    <div className="max-w-3xl mx-auto">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-white mb-6">
        {greeting}, {firstName}!
      </h1>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-zinc-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{appointments.length}</p>
          <p className="text-zinc-400 text-sm mt-1">Hoje</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{weekCount ?? 0}</p>
          <p className="text-zinc-400 text-sm mt-1">Semana</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{clientsCount ?? 0}</p>
          <p className="text-zinc-400 text-sm mt-1">Clientes</p>
        </div>
      </div>

      {/* Calendar sync failures */}
      {(syncErrorCount ?? 0) > 0 && (
        <div className="mb-6">
          <RetrySyncButton count={syncErrorCount ?? 0} />
        </div>
      )}

      {/* Today's appointments */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Agendamentos de hoje</h2>

        {appointments.length === 0 ? (
          <div className="bg-zinc-800 rounded-xl p-6 text-center text-zinc-400">
            Nenhum agendamento hoje
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="bg-zinc-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-white">{appt.start_time}</p>
                  <p className="text-zinc-400 text-sm">
                    {appt.service?.name ?? '—'}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-sm text-white">{appt.client?.name ?? '—'}</p>
                  <p className="text-zinc-500 text-xs">
                    {appt.client?.phone ? formatPhone(appt.client.phone) : '—'}
                  </p>
                  <SyncButton
                    appointmentId={appt.id}
                    syncStatus={appt.sync_status}
                    googleEventId={appt.google_event_id}
                  />
                  <AppointmentActions appointmentId={appt.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
