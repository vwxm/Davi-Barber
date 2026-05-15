'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Appointment, AppointmentStatus } from '@/types'

interface AppointmentCardProps {
  appointment: Appointment
  onCancel: (id: string) => void
  isCancelling: boolean
}

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled: { label: 'Agendado', className: 'bg-amber-500/20 text-amber-400' },
  completed: { label: 'Concluído', className: 'bg-green-500/20 text-green-400' },
  canceled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-400' },
}

function formatDate(dateStr: string): string {
  const raw = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function AppointmentCard({ appointment, onCancel, isCancelling }: AppointmentCardProps) {
  const [confirming, setConfirming] = useState(false)

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
        {appointment.start_time} – {appointment.end_time}
      </p>
      <p className="text-zinc-400 text-sm">
        Código: <span className="text-white font-mono">{appointment.access_code}</span>
      </p>

      {appointment.status === 'scheduled' && (
        <div className="mt-1">
          {confirming ? (
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
            <Button
              type="button"
              variant="danger"
              loading={isCancelling}
              onClick={handleCancelClick}
            >
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
