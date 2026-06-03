'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { retryFailedSyncs } from '@/actions/admin/calendar'

interface RetrySyncButtonProps {
  count: number
}

export function RetrySyncButton({ count }: RetrySyncButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  function handleRetry() {
    startTransition(async () => {
      setMsg(null)
      const result = await retryFailedSyncs()
      if (result.error) {
        setMsg(result.error)
        return
      }
      setMsg(`${result.retried} sincronizado(s), ${result.errors} com erro.`)
      router.refresh()
    })
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-amber-400 text-sm font-medium">
          {count} agendamento(s) com falha de sincronização
        </p>
        {msg && <p className="text-zinc-300 text-xs mt-1">{msg}</p>}
      </div>
      <Button
        variant="secondary"
        loading={isPending}
        onClick={handleRetry}
        className="!w-auto !min-h-0 px-3 py-2 text-sm"
      >
        Reprocessar
      </Button>
    </div>
  )
}
