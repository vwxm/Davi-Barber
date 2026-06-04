'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  markAppointmentCompleted,
  markAppointmentNoShow,
  cancelAppointmentAdmin,
  rescheduleAppointmentAdmin,
} from '@/actions/admin/appointments'

interface AppointmentActionsProps {
  appointmentId: string
}

export function AppointmentActions({ appointmentId }: AppointmentActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const router = useRouter()

  function handleReschedule() {
    startTransition(async () => {
      setError(null)
      const result = await rescheduleAppointmentAdmin(appointmentId, newDate, newTime)
      if (result.error) { setError(result.error); return }
      setRescheduling(false)
      router.refresh()
    })
  }

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

  if (rescheduling) {
    return (
      <div className="flex flex-col items-start sm:items-end gap-1">
        {error && <span className="text-red-400 text-xs">{error}</span>}
        <div className="flex flex-wrap gap-1">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
            className="px-2 py-1 rounded bg-zinc-700 border border-zinc-600 text-white text-xs" />
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
            className="px-2 py-1 rounded bg-zinc-700 border border-zinc-600 text-white text-xs" />
        </div>
        <div className="flex gap-1">
          <button type="button" disabled={isPending || !newDate || !newTime} onClick={handleReschedule}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500 text-black disabled:opacity-50">Salvar</button>
          <button type="button" disabled={isPending} onClick={() => setRescheduling(false)}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-zinc-700 text-white">Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start sm:items-end gap-1">
      {error && <span className="text-red-400 text-xs">{error}</span>}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => { setRescheduling(true); setError(null) }}
          className={`${btn} bg-zinc-600 hover:bg-zinc-500 text-white`}
        >
          Remarcar
        </button>
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
