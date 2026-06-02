'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelAppointment } from '@/actions/client/appointments'
import { AppointmentCard } from '@/components/client/AppointmentCard'
import type { Appointment } from '@/types'

interface AppointmentsListProps {
  appointments: Appointment[]
}

export function AppointmentsList({ appointments }: AppointmentsListProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const upcoming = appointments
    .filter((a) => a.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date))

  const history = appointments
    .filter((a) => a.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))



  function handleCancel(id: string) {
    setCancellingId(id)
    startTransition(async () => {
      await cancelAppointment(id)
      setCancellingId(null)
      router.refresh()
    })
  }

  if (appointments.length === 0) {
    return (
      <p className="text-zinc-400 text-sm text-center py-8">
        Nenhum agendamento encontrado.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-white">Próximos</h2>
          {upcoming.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCancel={handleCancel}
              isCancelling={cancellingId === appointment.id}
            />
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-white">Histórico</h2>
          {history.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCancel={handleCancel}
              isCancelling={cancellingId === appointment.id}
            />
          ))}
        </section>
      )}
    </div>
  )
}
