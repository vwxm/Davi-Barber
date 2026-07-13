'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BloqueiosManager } from '@/components/admin/BloqueiosManager'
import {
  updateScheduleSettings,
  upsertDayOverride,
  removeDayOverride,
  getDaySchedule,
} from '@/actions/admin/schedule'
import type { ScheduleSettings, ScheduleBlock } from '@/types'
import type { EffectiveHours } from '@/lib/business-rules/slots'

interface HorariosManagerProps {
  settings: ScheduleSettings
  blocks: ScheduleBlock[]
}

// 30-min options 06:00..23:30 for selects.
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const total = 6 * 60 + i * 30
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
})

function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white"
      >
        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  )
}

export function HorariosManager({ settings, blocks }: HorariosManagerProps) {
  // --- default hours card ---
  const [open, setOpen] = useState(settings.open_time)
  const [close, setClose] = useState(settings.close_time)
  const [lead, setLead] = useState(String(settings.min_lead_minutes))
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // --- per-day card ---
  const [day, setDay] = useState('')
  const [dayHours, setDayHours] = useState<EffectiveHours | null>(null)
  const [dayFromOverride, setDayFromOverride] = useState(false)
  const [dayOpen, setDayOpen] = useState('10:00')
  const [dayClose, setDayClose] = useState('20:00')
  const [dayError, setDayError] = useState<string | null>(null)
  const [dayMsg, setDayMsg] = useState<string | null>(null)

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
    })
  }

  function loadDay(date: string) {
    setDay(date)
    setDayError(null)
    setDayMsg(null)
    setDayHours(null)
    if (!date) return
    startTransition(async () => {
      const result = await getDaySchedule(date)
      if (result.error || !result.hours) { setDayError(result.error ?? 'Erro ao carregar o dia.'); return }
      setDayHours(result.hours)
      setDayFromOverride(!!result.fromOverride)
      setDayOpen(result.hours.start)
      setDayClose(result.hours.end)
    })
  }

  function saveDay(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      setDayError(null)
      setDayMsg(null)
      const result = await upsertDayOverride({ date: day, open_time: dayOpen, close_time: dayClose })
      if (result.error) { setDayError(result.error); return }
      setDayMsg('Horário do dia salvo.')
      setDayFromOverride(true)
      setDayHours({ start: dayOpen, end: dayClose })
    })
  }

  function resetDay() {
    startTransition(async () => {
      setDayError(null)
      setDayMsg(null)
      const result = await removeDayOverride(day)
      if (result.error) { setDayError(result.error); return }
      setDayMsg('Dia voltou ao horário padrão.')
      loadDay(day)
    })
  }

  return (
    <div className="space-y-6">
      {/* Horário padrão */}
      <form onSubmit={saveSettings} className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-amber-500">Horário padrão</h2>
        <p className="text-zinc-400 text-sm">Vale para todos os dias sem ajuste específico.</p>
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect label="Abertura" value={open} onChange={setOpen} />
          <TimeSelect label="Fechamento" value={close} onChange={setClose} />
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

      {/* Ajustes por dia */}
      <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-amber-500">Ajustar um dia específico</h2>
        <p className="text-zinc-400 text-sm">
          Mude a abertura/fechamento de um único dia (ex.: sexta até 21:00) sem afetar os demais.
        </p>
        <Input label="Dia" name="day" type="date" value={day} onChange={(e) => loadDay(e.target.value)} />
        {day && dayHours && (
          <form onSubmit={saveDay} className="space-y-3">
            <p className="text-zinc-300 text-sm">
              Horário atual: <span className="text-white font-medium">{dayHours.start} – {dayHours.end}</span>
              {dayFromOverride ? ' (ajuste deste dia)' : ' (horário padrão)'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TimeSelect label="Abertura" value={dayOpen} onChange={setDayOpen} />
              <TimeSelect label="Fechamento" value={dayClose} onChange={setDayClose} />
            </div>
            {dayError && <p className="text-red-400 text-sm">{dayError}</p>}
            {dayMsg && <p className="text-green-400 text-sm">{dayMsg}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={isPending}>Salvar horário do dia</Button>
              {dayFromOverride && (
                <Button type="button" variant="secondary" onClick={resetDay} disabled={isPending}>
                  Voltar ao padrão
                </Button>
              )}
            </div>
          </form>
        )}
        {day && !dayHours && dayError && <p className="text-red-400 text-sm">{dayError}</p>}
      </div>

      {/* Bloqueios */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-amber-500">Bloqueios</h2>
        <p className="text-zinc-400 text-sm">
          Feche o dia inteiro ou faixas de horário (almoço, compromissos, férias).
        </p>
        <BloqueiosManager blocks={blocks} />
      </div>
    </div>
  )
}
