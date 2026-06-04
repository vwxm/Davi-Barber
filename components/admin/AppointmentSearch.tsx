'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { searchAppointments } from '@/actions/admin/search'
import type { Appointment, AppointmentStatus } from '@/types'

const STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled: { label: 'Agendado', className: 'bg-amber-500/20 text-amber-400' },
  completed: { label: 'Concluído', className: 'bg-green-500/20 text-green-400' },
  canceled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'Faltou', className: 'bg-zinc-600/40 text-zinc-300' },
}

function dateBR(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function phoneBR(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return phone
}

export function AppointmentSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Appointment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await searchAppointments(query)
      if (res.error) { setError(res.error); return }
      setResults(res.results ?? [])
    })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="Buscar por nome, telefone ou código"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: João, 11999..., AB12CD34"
          />
        </div>
        <Button type="submit" loading={isPending} className="!w-auto">Buscar</Button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {results !== null && results.length === 0 && (
        <p className="text-zinc-400 text-sm">Nenhum agendamento encontrado.</p>
      )}

      <div className="flex flex-col gap-2">
        {results?.map((a) => {
          const name = a.client?.name ?? a.guest_name ?? '—'
          const phone = a.client?.phone ?? a.guest_phone
          const st = STATUS[a.status]
          return (
            <div key={a.id} className="bg-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-medium">
                  {dateBR(a.date)} · {a.start_time.slice(0, 5)} · {a.service?.name ?? '—'}
                </p>
                <p className="text-zinc-400 text-sm truncate">
                  {name}{phone ? ` · ${phoneBR(phone)}` : ''}
                </p>
                <p className="text-zinc-500 text-xs font-mono">cód. {a.access_code}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.className}`}>{st.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
