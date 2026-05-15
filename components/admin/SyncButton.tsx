'use client'

import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { syncAppointmentToCalendar } from '@/actions/admin/calendar'

interface SyncButtonProps {
  appointmentId: string
  syncStatus: string
  googleEventId: string | null
}

export function SyncButton({ appointmentId, syncStatus, googleEventId }: SyncButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState<string>(syncStatus)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (localStatus === 'synced' && !errorMsg) {
    return <span className="text-green-400 text-xs">✓ Calendário</span>
  }

  function handleSync() {
    startTransition(async () => {
      setErrorMsg(null)
      const result = await syncAppointmentToCalendar(appointmentId)
      if (result.error) {
        setLocalStatus('error')
        setErrorMsg(result.error)
      } else {
        setLocalStatus('synced')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {errorMsg && (
        <span className="text-red-400 text-xs">⚠ Sync falhou</span>
      )}
      <Button
        variant="secondary"
        loading={isPending}
        onClick={handleSync}
        className="!w-auto !min-h-0 px-3 py-1 text-xs"
      >
        {googleEventId ? 'Ressync' : 'Sync'}
      </Button>
    </div>
  )
}
