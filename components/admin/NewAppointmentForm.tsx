'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createGuestAppointment } from '@/actions/admin/appointments'
import { formatPhoneInput } from '@/lib/business-rules/phone'
import type { Service } from '@/types'

interface NewAppointmentFormProps {
  services: Service[]
}

export function NewAppointmentForm({ services }: NewAppointmentFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setName(''); setPhone(''); setDate(''); setTime(''); setError(null)
    setServiceId(services[0]?.id ?? '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(null)
    startTransition(async () => {
      const result = await createGuestAppointment({
        guest_name: name, guest_phone: phone || undefined,
        service_id: serviceId, date, start_time: time,
      })
      if (result.error) { setError(result.error); return }
      setDone(`Agendado: ${name}`)
      reset()
      router.refresh()
    })
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button type="button" onClick={() => { setOpen(true); setDone(null) }} className="!w-auto">
          + Novo agendamento
        </Button>
        {done && <p className="text-green-400 text-sm">{done}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-800 rounded-xl p-4 space-y-3 max-w-md">
      <h2 className="text-lg font-semibold text-amber-500">Novo agendamento</h2>
      <p className="text-zinc-400 text-xs">Para clientes que não usam o app. Telefone é opcional.</p>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Input label="Nome do cliente" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Telefone (opcional)" name="phone" type="tel" inputMode="numeric"
        placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-300">Serviço</label>
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required
          className="min-h-[44px] px-3 rounded-lg bg-zinc-700 border border-zinc-600 text-white text-base focus:outline-none focus:border-amber-500">
          {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>)}
        </select>
      </div>

      <div className="flex gap-2">
        <Input label="Data" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Input label="Horário" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={isPending}>Salvar</Button>
        <Button type="button" variant="secondary" onClick={() => { setOpen(false); reset() }} disabled={isPending}>Cancelar</Button>
      </div>
    </form>
  )
}
