export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { ensureCurrentWeekMonthlyAppointments } from '@/lib/monthly/ensure'
import { currentWeekMonday } from '@/lib/business-rules/monthly'
import { AppointmentActions } from '@/components/admin/AppointmentActions'
import type { Appointment, AppointmentStatus } from '@/types'

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const statusBadge: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled: { label: 'Agendado', className: 'bg-amber-500/20 text-amber-400' },
  completed: { label: 'Concluído', className: 'bg-green-500/20 text-green-400' },
  canceled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'Não compareceu', className: 'bg-zinc-600/40 text-zinc-300' },
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatDayBR(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}

export default async function AgendaPage() {
  await ensureCurrentWeekMonthlyAppointments()
  const supabase = await createClient()

  const nowISO = new Date().toISOString()
  const monday = currentWeekMonday(nowISO)
  const saturday = addDays(monday, 5)

  const { data } = await supabase
    .from('appointments')
    .select('*, service:services(id,name), client:clients(id,name,phone)')
    .gte('date', monday)
    .lte('date', saturday)
    .neq('status', 'canceled')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  const appointments = (data ?? []) as Appointment[]

  // Mon..Sat
  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i))

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-white">Agenda da Semana</h1>

      {days.map((date) => {
        const weekday = new Date(date + 'T12:00:00Z').getUTCDay()
        const dayAppts = appointments.filter((a) => a.date === date)
        return (
          <section key={date} className="space-y-2">
            <h2 className="text-amber-500 font-semibold text-sm uppercase tracking-wide">
              {WEEKDAY_LABELS[weekday]} · {formatDayBR(date)}
            </h2>
            {dayAppts.length === 0 ? (
              <p className="text-zinc-500 text-sm">Sem agendamentos.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dayAppts.map((appt) => (
                  <div key={appt.id} className="bg-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">
                        {appt.start_time.slice(0, 5)} · {appt.service?.name ?? '—'}
                        {appt.monthly_client_id && (
                          <span className="ml-2 text-amber-400 text-xs">mensalista</span>
                        )}
                      </p>
                      <p className="text-zinc-400 text-sm truncate">
                        {appt.client?.name ?? '—'}
                        {appt.client?.phone ? ` · ${formatPhone(appt.client.phone)}` : ''}
                      </p>
                      <p className="text-zinc-500 text-xs font-mono">cód. {appt.access_code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[appt.status].className}`}>
                        {statusBadge[appt.status].label}
                      </span>
                      {appt.status === 'scheduled' && (
                        <AppointmentActions appointmentId={appt.id} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
