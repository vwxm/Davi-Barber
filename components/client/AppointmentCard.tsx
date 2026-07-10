'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { RescheduleControl } from '@/components/client/RescheduleControl'
import type { Appointment, AppointmentStatus } from '@/types'

interface AppointmentCardProps {
  appointment: Appointment
  onCancel: (id: string) => void
  isCancelling: boolean
  availableDates: string[]
}

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled: { label: 'Agendado', className: 'bg-amber-500/20 text-amber-400' },
  completed: { label: 'Concluído', className: 'bg-green-500/20 text-green-400' },
  canceled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'Não compareceu', className: 'bg-zinc-600/40 text-zinc-300' },
}

function formatDate(dateStr: string): string {
  const raw = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function AppointmentCard({ appointment, onCancel, isCancelling, availableDates }: AppointmentCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)

  const status = statusConfig[appointment.status]
  const serviceName = appointment.service?.name ?? 'Serviço'

  function handleCancelClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    onCancel(appointment.id)
    setConfirming(false)
  }

  function handleNo() {
    setConfirming(false)
  }

  return (
    <div className="bg-zinc-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-white">{serviceName}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="text-zinc-400 text-sm">{formatDate(appointment.date)}</p>
      <p className="text-zinc-400 text-sm">
        {appointment.start_time.slice(0, 5)}
      </p>
      <p className="text-zinc-400 text-sm">
        Código: <span className="text-white font-mono">{appointment.access_code}</span>
      </p>

      {appointment.status === 'scheduled' && (
        <div className="mt-1">
          {rescheduling ? (
            <RescheduleControl
              appointmentId={appointment.id}
              serviceId={appointment.service_id}
              availableDates={availableDates}
              onClose={() => setRescheduling(false)}
            />
          ) : confirming ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-300">Tem certeza?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="danger"
                  loading={isCancelling}
                  className="flex-1"
                  onClick={handleCancelClick}
                >
                  Sim
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleNo}
                  disabled={isCancelling}
                >
                  Não
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setRescheduling(true)}
                disabled={isCancelling}
              >
                Remarcar
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                loading={isCancelling}
                onClick={handleCancelClick}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
