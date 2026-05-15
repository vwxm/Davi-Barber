'use client'

import { useState, useTransition } from 'react'
import { ScheduleBlock } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createBlock, deactivateBlock } from '@/actions/admin/blocks'

interface BloqueiosManagerProps {
  blocks: ScheduleBlock[]
}

interface FormState {
  date: string
  full_day: boolean
  start_time: string
  end_time: string
  reason: string
}

const emptyForm: FormState = { date: '', full_day: true, start_time: '', end_time: '', reason: '' }

function formatDateBR(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

export function BloqueiosManager({ blocks: initial }: BloqueiosManagerProps) {
  const [list, setList] = useState<ScheduleBlock[]>(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openAdd() {
    setAdding(true)
    setForm(emptyForm)
    setError(null)
  }

  function cancelForm() {
    setAdding(false)
    setError(null)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      const result = await deactivateBlock(id)
      if (result.error) { setError(result.error); return }
      setList(prev => prev.filter(b => b.id !== id))
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const result = await createBlock({
        date: form.date,
        full_day: form.full_day,
        start_time: form.full_day ? undefined : form.start_time || undefined,
        end_time: form.full_day ? undefined : form.end_time || undefined,
        reason: form.reason || undefined,
      })
      if (result.error) { setError(result.error); return }
      if (result.block) {
        setList(prev => [...prev, result.block as ScheduleBlock].sort((a, b) => a.date.localeCompare(b.date)))
      }
      setAdding(false)
      setForm(emptyForm)
    })
  }

  return (
    <div className="space-y-4">
      {!adding && (
        <Button type="button" onClick={openAdd} className="w-auto">
          + Novo Bloqueio
        </Button>
      )}

      {adding && (
        <form onSubmit={handleSubmit} className="bg-zinc-800 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-amber-500">Novo Bloqueio</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Input label="Data" name="date" type="date" value={form.date} onChange={handleChange} required />
          <label className="flex items-center gap-2 text-zinc-300 text-sm">
            <input type="checkbox" name="full_day" checked={form.full_day} onChange={handleChange} className="w-4 h-4 accent-amber-500" />
            Dia inteiro
          </label>
          {!form.full_day && (
            <>
              <Input label="Início" name="start_time" type="time" value={form.start_time} onChange={handleChange} required />
              <Input label="Fim" name="end_time" type="time" value={form.end_time} onChange={handleChange} required />
            </>
          )}
          <Input label="Motivo (opcional)" name="reason" type="text" value={form.reason} onChange={handleChange} />
          <div className="flex gap-2">
            <Button type="submit" loading={isPending}>Salvar</Button>
            <Button type="button" variant="secondary" onClick={cancelForm} disabled={isPending}>Cancelar</Button>
          </div>
        </form>
      )}

      {error && !adding && <p className="text-red-400 text-sm">{error}</p>}

      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-zinc-400 text-sm">Nenhum bloqueio ativo.</p>
        )}
        {list.map(block => (
          <div key={block.id} className="bg-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">{formatDateBR(block.date)}</p>
              <p className="text-sm text-zinc-400">
                {block.full_day
                  ? 'Dia inteiro'
                  : `${block.start_time} – ${block.end_time}`}
                {block.reason ? ` · ${block.reason}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDeactivate(block.id)}
              disabled={isPending}
              className="text-red-400 hover:text-red-300 text-sm font-medium px-2 py-1"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
