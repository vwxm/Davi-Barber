'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { markAppointmentCompleted } from '@/actions/admin/appointments'

interface CompleteButtonProps {
  appointmentId: string
}

export function CompleteButton({ appointmentId }: CompleteButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  function handleComplete() {
    startTransition(async () => {
      setErrorMsg(null)
      const result = await markAppointmentCompleted(appointmentId)
      if (result.error) {
        setErrorMsg(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {errorMsg && <span className="text-red-400 text-xs">{errorMsg}</span>}
      <Button
        variant="secondary"
        loading={isPending}
        onClick={handleComplete}
        className="!w-auto !min-h-0 px-3 py-1 text-xs"
      >
        Concluir
      </Button>
    </div>
  )
}
