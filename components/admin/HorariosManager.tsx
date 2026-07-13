'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BloqueiosManager } from '@/components/admin/BloqueiosManager'
import { updateScheduleSettings, getDayGrid, toggleSlot } from '@/actions/admin/schedule'
import type { ScheduleSettings, ScheduleBlock } from '@/types'
import type { EffectiveHours } from '@/lib/business-rules/slots'
import type { GridSlot, SlotState } from '@/lib/schedule/grid'

interface HorariosManagerProps {
  settings: ScheduleSettings
  blocks: ScheduleBlock[]
}

// 30-min options 06:00..23:30 for the default-hours selects.
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const total = 6 * 60 + i * 30
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
})

const WEEKDAY_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Mon–Sat of the current week + Mon–Sat of the next week, as 'YYYY-MM-DD'.
function editableDays(): { date: string; label: string; sub: string }[] {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA')
  const dow = new Date(todayStr + 'T12:00:00Z').getUTCDay()
  const monday = new Date(todayStr + 'T12:00:00Z')
  monday.setUTCDate(monday.getUTCDate() + (dow === 0 ? 1 : 1 - dow))

  const days: { date: string; label: string; sub: string }[] = []
  for (let w = 0; w < 2; w++) {
    for (let d = 0; d < 6; d++) {
      const dt = new Date(monday)
      dt.setUTCDate(monday.getUTCDate() + w * 7 + d)
      const iso = dt.toISOString().slice(0, 10)
      if (iso < todayStr) continue // past days of the current week
      days.push({
        date: iso,
        label: WEEKDAY_LABEL[dt.getUTCDay()],
        sub: String(dt.getUTCDate()).padStart(2, '0'),
      })
    }
  }
  return days
}

const SLOT_STYLE: Record<SlotState, string> = {
  aberto: 'bg-amber-500/15 border-amber-500/60 text-amber-300',
  bloqueado: 'bg-red-500/15 border-red-500/60 text-red-400 line-through',
  fechado: 'bg-zinc-900 border-zinc-700 border-dashed text-zinc-500',
  ocupado: 'bg-zinc-700 border-zinc-600 text-zinc-400 cursor-not-allowed',
}

export function HorariosManager({ settings, blocks }: HorariosManagerProps) {
  // --- default hours card ---
  const [open, setOpen] = useState(settings.open_time)
  const [close, setClose] = useState(settings.close_time)
  const [lead, setLead] = useState(String(settings.min_lead_minutes))
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // --- day grid ---
  const days = editableDays()
  const [day, setDay] = useState<string | null>(null)
  const [grid, setGrid] = useState<GridSlot[] | null>(null)
  const [dayHours, setDayHours] = useState<EffectiveHours | null>(null)
  const [dayFromOverride, setDayFromOverride] = useState(false)
  const [dayError, setDayError] = useState<string | null>(null)
  // Slot waiting for the barber to choose "bloquear" or "fechar".
  const [choosing, setChoosing] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      setSettingsError(null)
      setSettingsMsg(null)
      const result = await updateScheduleSettings({
        open_time: open,
        close_time: close,
        min_lead_minutes: parseInt(lead, 10),
      })
      if (result.error) { setSettingsError(result.error); return }
      setSettingsMsg('Horário padrão salvo.')
      // The default may change the selected day's grid — refresh it.
      if (day) {
        const fresh = await getDayGrid(day)
        if (fresh.grid && fresh.hours) {
          setGrid(fresh.grid)
          setDayHours(fresh.hours)
          setDayFromOverride(!!fresh.fromOverride)
        }
      }
    })
  }

  function selectDay(date: string) {
    setDay(date)
    setDayError(null)
    setGrid(null)
    startTransition(async () => {
      const result = await getDayGrid(date)
      if (result.error || !result.grid || !result.hours) {
        setDayError(result.error ?? 'Erro ao carregar o dia.')
        return
      }
      setGrid(result.grid)
      setDayHours(result.hours)
      setDayFromOverride(!!result.fromOverride)
    })
  }

  function applyToggle(start: string, action?: 'bloquear' | 'fechar') {
    if (!day) return
    startTransition(async () => {
      setDayError(null)
      const result = await toggleSlot(day, start, action)
      if (result.error || !result.grid || !result.hours) {
        setDayError(result.error ?? 'Erro ao atualizar o horário.')
        return
      }
      setGrid(result.grid)
      setDayHours(result.hours)
      setDayFromOverride(!!result.fromOverride)
    })
  }

  function tapSlot(slot: GridSlot) {
    if (!day || slot.state === 'ocupado' || isPending) return
    if (slot.state === 'aberto') {
      // Barber chooses: bloquear (red) or fechar (grey).
      setChoosing(slot.start)
      return
    }
    applyToggle(slot.start)
  }

  function choose(action: 'bloquear' | 'fechar') {
    const start = choosing
    setChoosing(null)
    if (start) applyToggle(start, action)
  }

  function fullDate(date: string): string {
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="space-y-6">
      {/* Horário padrão */}
      <form onSubmit={saveSettings} className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-amber-500">Horário padrão</h2>
        <p className="text-zinc-400 text-sm">Vale para todos os dias sem ajuste específico.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-300">
            Abertura
            <select
              value={open}
              onChange={(e) => setOpen(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-300">
            Fechamento
            <select
              value={close}
              onChange={(e) => setClose(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <Input
          label="Antecedência mínima (minutos)"
          name="lead"
          type="number"
          min="0"
          max="1440"
          value={lead}
          onChange={(e) => setLead(e.target.value)}
          required
        />
        <p className="text-zinc-500 text-xs">
          Ex.: 60 = o horário das 20:00 só pode ser agendado até as 19:00.
        </p>
        {settingsError && <p className="text-red-400 text-sm">{settingsError}</p>}
        {settingsMsg && <p className="text-green-400 text-sm">{settingsMsg}</p>}
        <Button type="submit" loading={isPending}>Salvar</Button>
      </form>

      {/* Grade por dia */}
      <div className="bg-zinc-800 rounded-xl p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-amber-500">Ajustar dias</h2>
          <p className="text-zinc-400 text-sm">
            Escolha o dia e toque nos horários: bloqueie, reabra ou adicione horários fora do expediente.
          </p>
        </div>

        {/* Day buttons: current + next week */}
        <div className="grid grid-cols-6 gap-2">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => selectDay(d.date)}
              className={`flex flex-col items-center rounded-lg border px-1 py-2 text-sm transition-colors ${
                day === d.date
                  ? 'bg-amber-500 border-amber-500 text-zinc-900 font-semibold'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-amber-500/60'
              }`}
            >
              <span>{d.label}</span>
              <span className="text-xs">{d.sub}</span>
            </button>
          ))}
        </div>

        {day && (
          <div className="space-y-3">
            <p className="text-zinc-300 text-sm">
              {fullDate(day)} — expediente{' '}
              <span className="text-white font-medium">
                {dayHours ? `${dayHours.start} – ${dayHours.end}` : '…'}
              </span>
              {dayFromOverride ? ' (ajustado)' : ''}
            </p>

            {dayError && <p className="text-red-400 text-sm">{dayError}</p>}

            {!grid && !dayError && <p className="text-zinc-400 text-sm">Carregando horários…</p>}

            {grid && (
              <>
                <div className={`grid grid-cols-4 gap-2 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
                  {grid.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => tapSlot(slot)}
                      disabled={slot.state === 'ocupado'}
                      data-state={slot.state}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${SLOT_STYLE[slot.state]}`}
                    >
                      {slot.start}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                  <span><span className="text-amber-300">■</span> aberto — toque e escolha bloquear ou fechar</span>
                  <span><span className="text-red-400">■</span> bloqueado — toque para reabrir</span>
                  <span><span className="text-zinc-500">■</span> fechado — toque para abrir</span>
                  <span><span className="text-zinc-300">■</span> ocupado (cliente)</span>
                </div>

                {choosing && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
                    onClick={() => setChoosing(null)}
                  >
                    <div
                      className="w-full max-w-xs bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-white font-semibold text-center">{choosing}</p>
                      <button
                        type="button"
                        onClick={() => choose('bloquear')}
                        className="w-full rounded-lg border border-red-500/60 bg-red-500/15 text-red-300 py-3 text-sm font-medium"
                      >
                        Bloquear horário
                        <span className="block text-xs text-zinc-400 font-normal">Fica vermelho na grade; fácil de reabrir depois.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => choose('fechar')}
                        className="w-full rounded-lg border border-zinc-600 bg-zinc-900 text-zinc-300 py-3 text-sm font-medium"
                      >
                        Fechar horário
                        <span className="block text-xs text-zinc-500 font-normal">Sai do expediente do dia (cinza).</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChoosing(null)}
                        className="w-full rounded-lg text-zinc-400 py-2 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bloqueios */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-amber-500">Bloqueios de dia inteiro e períodos</h2>
        <p className="text-zinc-400 text-sm">
          Para fechar um dia inteiro ou um período (ex.: férias). Faixas de horário você faz na grade acima.
        </p>
        <BloqueiosManager blocks={blocks} />
      </div>
    </div>
  )
}
