'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MonthlyClient, Client, Service } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createMonthlyClient, deactivateMonthlyClient } from '@/actions/admin/monthly-clients'
import { rescheduleMonthlyAppointment } from '@/actions/admin/monthly-appointments'

export interface WeekAppointment {
  id: string
  date: string        // 'YYYY-MM-DD'
  start_time: string  // 'HH:MM'
}

interface MensaisManagerProps {
  monthlyClients: MonthlyClient[]
  clients: Client[]
  services: Service[]
  weekAppointments: Record<string, WeekAppointment>
  weekMonday: string  // 'YYYY-MM-DD' segunda da semana atual
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatDayBR(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

interface FormState {
  client_id: string
  service_id: string
  weekday: string
  start_time: string
  notes: string
}

const emptyForm: FormState = { client_id: '', service_id: '', weekday: '1', start_time: '', notes: '' }

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return phone
}

const OVERRIDE_DAYS = [1, 2, 3, 4, 5, 6] // Seg..Sáb

export function MensaisManager({ monthlyClients: initial, clients, services, weekAppointments, weekMonday }: MensaisManagerProps) {
  const [list, setList] = useState<MonthlyClient[]>(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Per-week override state
  const [overrideFor, setOverrideFor] = useState<string | null>(null)
  const [overrideDay, setOverrideDay] = useState('1')
  const [overrideTime, setOverrideTime] = useState('')
  const [overrideError, setOverrideError] = useState<string | null>(null)

  function openOverride(mcId: string, appt: WeekAppointment) {
    setOverrideFor(mcId)
    setOverrideError(null)
    const weekday = new Date(appt.date + 'T12:00:00Z').getUTCDay()
    setOverrideDay(String(weekday === 0 ? 6 : weekday))
    setOverrideTime(appt.start_time)
  }

  function handleReschedule(appt: WeekAppointment) {
    const newDate = addDays(weekMonday, parseInt(overrideDay, 10) - 1)
    startTransition(async () => {
      setOverrideError(null)
      const result = await rescheduleMonthlyAppointment(appt.id, newDate, overrideTime)
      if (result.error) { setOverrideError(result.error); return }
      setOverrideFor(null)
      router.refresh()
    })
  }

  function openAdd() {
    setAdding(true)
    setForm(emptyForm)
    setError(null)
  }

  function cancelForm() {
    setAdding(false)
    setError(null)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      const result = await deactivateMonthlyClient(id)
      if (result.error) { setError(result.error); return }
      setList(prev => prev.filter(mc => mc.id !== id))
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const result = await createMonthlyClient({
        client_id: form.client_id,
        service_id: form.service_id,
        weekday: parseInt(form.weekday, 10),
        start_time: form.start_time,
        notes: form.notes || undefined,
      })
      if (result.error) { setError(result.error); return }
      if (result.monthlyClient) {
        setList(prev =>
          [...prev, result.monthlyClient as MonthlyClient].sort((a, b) =>
            a.weekday !== b.weekday ? a.weekday - b.weekday : a.start_time.localeCompare(b.start_time)
          )
        )
      }
      setAdding(false)
      setForm(emptyForm)
    })
  }

  // Group by weekday
  const grouped: Record<number, MonthlyClient[]> = {}
  for (const mc of list) {
    if (!grouped[mc.weekday]) grouped[mc.weekday] = []
    grouped[mc.weekday].push(mc)
  }

  return (
    <div className="space-y-4">
      {!adding && (
        <Button type="button" onClick={openAdd} className="w-auto">
          + Novo Cliente Mensal
        </Button>
      )}

      {adding && (
        <form onSubmit={handleSubmit} className="bg-zinc-800 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-amber-500">Novo Cliente Mensal</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Cliente</label>
            <select
              name="client_id"
              value={form.client_id}
              onChange={handleChange}
              required
              className="min-h-[44px] px-3 py-2 rounded-lg bg-zinc-700 border border-zinc-600 text-white text-base focus:outline-none focus:border-amber-500"
            >
              <option value="">Selecione...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Serviço</label>
            <select
              name="service_id"
              value={form.service_id}
              onChange={handleChange}
              required
              className="min-h-[44px] px-3 py-2 rounded-lg bg-zinc-700 border border-zinc-600 text-white text-base focus:outline-none focus:border-amber-500"
            >
              <option value="">Selecione...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Dia da semana</label>
            <select
              name="weekday"
              value={form.weekday}
              onChange={handleChange}
              required
              className="min-h-[44px] px-3 py-2 rounded-lg bg-zinc-700 border border-zinc-600 text-white text-base focus:outline-none focus:border-amber-500"
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <option key={i} value={String(i)}>{label}</option>
              ))}
            </select>
          </div>

          <Input label="Horário" name="start_time" type="time" value={form.start_time} onChange={handleChange} required />
          <Input label="Observações (opcional)" name="notes" type="text" value={form.notes} onChange={handleChange} />

          <div className="flex gap-2">
            <Button type="submit" loading={isPending}>Salvar</Button>
            <Button type="button" variant="secondary" onClick={cancelForm} disabled={isPending}>Cancelar</Button>
          </div>
        </form>
      )}

      {error && !adding && <p className="text-red-400 text-sm">{error}</p>}

      {list.length === 0 && !adding && (
        <p className="text-zinc-400 text-sm">Nenhum cliente mensal cadastrado.</p>
      )}

      {WEEKDAY_LABELS.map((label, day) => {
        const items = grouped[day]
        if (!items || items.length === 0) return null
        return (
          <div key={day} className="space-y-2">
            <h3 className="text-amber-500 font-semibold text-sm uppercase tracking-wide">{label}</h3>
            {items.map(mc => {
              const weekAppt = weekAppointments[mc.id]
              const movedThisWeek = weekAppt &&
                new Date(weekAppt.date + 'T12:00:00Z').getUTCDay() !== mc.weekday
              return (
              <div key={mc.id} className="bg-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{mc.client?.name ?? '—'}</p>
                    <p className="text-sm text-zinc-400">
                      {mc.service?.name ?? '—'} · {mc.start_time.slice(0, 5)}
                    </p>
                    {mc.client?.phone && (
                      <p className="text-sm text-zinc-500">{formatPhone(mc.client.phone)}</p>
                    )}
                    {mc.notes && <p className="text-xs text-zinc-500 mt-0.5">{mc.notes}</p>}
                    {movedThisWeek && weekAppt && (
                      <p className="text-xs text-amber-400 mt-1">
                        Esta semana: {formatDayBR(weekAppt.date)} às {weekAppt.start_time}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeactivate(mc.id)}
                    disabled={isPending}
                    className="text-red-400 hover:text-red-300 text-sm font-medium px-2 py-1"
                  >
                    Remover
                  </button>
                </div>

                {weekAppt && overrideFor !== mc.id && (
                  <button
                    type="button"
                    onClick={() => openOverride(mc.id, weekAppt)}
                    className="text-amber-400 hover:text-amber-300 text-sm font-medium self-start"
                  >
                    Trocar esta semana
                  </button>
                )}

                {weekAppt && overrideFor === mc.id && (
                  <div className="bg-zinc-900 rounded-lg p-3 space-y-2">
                    {overrideError && <p className="text-red-400 text-sm">{overrideError}</p>}
                    <div className="flex gap-2">
                      <select
                        value={overrideDay}
                        onChange={e => setOverrideDay(e.target.value)}
                        className="min-h-[44px] flex-1 px-3 rounded-lg bg-zinc-700 border border-zinc-600 text-white text-sm focus:outline-none focus:border-amber-500"
                      >
                        {OVERRIDE_DAYS.map(d => (
                          <option key={d} value={String(d)}>
                            {WEEKDAY_LABELS[d]} {formatDayBR(addDays(weekMonday, d - 1))}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={overrideTime}
                        onChange={e => setOverrideTime(e.target.value)}
                        className="min-h-[44px] px-3 rounded-lg bg-zinc-700 border border-zinc-600 text-white text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" loading={isPending} onClick={() => handleReschedule(weekAppt)}>
                        Salvar
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setOverrideFor(null)} disabled={isPending}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
