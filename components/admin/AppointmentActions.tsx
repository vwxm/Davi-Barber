'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  markAppointmentCompleted,
  markAppointmentNoShow,
  cancelAppointmentAdmin,
} from '@/actions/admin/appointments'

interface AppointmentActionsProps {
  appointmentId: string
}

export function AppointmentActions({ appointmentId }: AppointmentActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const router = useRouter()

  function run(action: (id: string) => Promise<{ error?: string }>) {
    startTransition(async () => {
      setError(null)
      const result = await action(appointmentId)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  const btn = 'px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50'

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <span className="text-red-400 text-xs">{error}</span>}
      <div className="flex gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(markAppointmentCompleted)}
          className={`${btn} bg-green-600/80 hover:bg-green-600 text-white`}
        >
          Concluir
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(markAppointmentNoShow)}
          className={`${btn} bg-zinc-600 hover:bg-zinc-500 text-white`}
        >
          Faltou
        </button>
        {confirmingCancel ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(cancelAppointmentAdmin)}
            className={`${btn} bg-red-600 hover:bg-red-700 text-white`}
          >
            Confirmar
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmingCancel(true)}
            className={`${btn} bg-zinc-700 hover:bg-red-700 text-red-300 hover:text-white`}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
