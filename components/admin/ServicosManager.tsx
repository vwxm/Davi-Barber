'use client'

import { useState, useTransition } from 'react'
import { Service } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createService, updateService, updateServiceActive } from '@/actions/admin/services'

interface ServicosManagerProps {
  services: Service[]
}

interface FormState {
  name: string
  price: string
  duration_minutes: string
  active: boolean
}

const emptyForm: FormState = { name: '', price: '', duration_minutes: '', active: true }

function serviceToForm(s: Service): FormState {
  return { name: s.name, price: String(s.price), duration_minutes: String(s.duration_minutes), active: s.active }
}

export function ServicosManager({ services: initial }: ServicosManagerProps) {
  const [list, setList] = useState<Service[]>(initial)
  const [editing, setEditing] = useState<Service | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openAdd() {
    setAdding(true)
    setEditing(null)
    setForm(emptyForm)
    setError(null)
  }

  function openEdit(service: Service) {
    setEditing(service)
    setAdding(false)
    setForm(serviceToForm(service))
    setError(null)
  }

  function cancelForm() {
    setAdding(false)
    setEditing(null)
    setError(null)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleToggle(service: Service) {
    startTransition(async () => {
      const result = await updateServiceActive(service.id, !service.active)
      if (result.error) {
        setError(result.error)
      } else {
        setList(prev => prev.map(s => s.id === service.id ? { ...s, active: !service.active } : s))
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(form.price)
    const duration = parseInt(form.duration_minutes, 10)

    startTransition(async () => {
      setError(null)
      if (adding) {
        const result = await createService({ name: form.name, price, duration_minutes: duration, active: form.active })
        if (result.error) { setError(result.error); return }
        if (result.service) setList(prev => [...prev, result.service as Service].sort((a, b) => a.name.localeCompare(b.name)))
        setAdding(false)
        setForm(emptyForm)
      } else if (editing) {
        const result = await updateService(editing.id, { name: form.name, price, duration_minutes: duration, active: form.active })
        if (result.error) { setError(result.error); return }
        if (result.service) setList(prev => prev.map(s => s.id === editing.id ? result.service as Service : s).sort((a, b) => a.name.localeCompare(b.name)))
        setEditing(null)
      }
    })
  }

  const showForm = adding || editing !== null

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button type="button" onClick={openAdd} className="w-auto">
          + Novo Serviço
        </Button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-800 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-amber-500">
            {adding ? 'Novo Serviço' : 'Editar Serviço'}
          </h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Input label="Nome" name="name" type="text" value={form.name} onChange={handleChange} required />
          <Input label="Preço (R$)" name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleChange} required />
          <Input label="Duração (minutos)" name="duration_minutes" type="number" min="1" value={form.duration_minutes} onChange={handleChange} required />
          <label className="flex items-center gap-2 text-zinc-300 text-sm">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} className="w-4 h-4 accent-amber-500" />
            Ativo
          </label>
          <div className="flex gap-2">
            <Button type="submit" loading={isPending}>Salvar</Button>
            <Button type="button" variant="secondary" onClick={cancelForm} disabled={isPending}>Cancelar</Button>
          </div>
        </form>
      )}

      {error && !showForm && <p className="text-red-400 text-sm">{error}</p>}

      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-zinc-400 text-sm">Nenhum serviço cadastrado.</p>
        )}
        {list.map(service => (
          <div key={service.id} className="bg-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{service.name}</p>
              <p className="text-sm text-zinc-400">
                {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {service.duration_minutes} min
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggle(service)}
                disabled={isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${service.active ? 'bg-amber-500' : 'bg-zinc-600'}`}
                aria-label={service.active ? 'Desativar' : 'Ativar'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${service.active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <button
                type="button"
                onClick={() => openEdit(service)}
                className="text-amber-500 hover:text-amber-400 text-sm font-medium px-2 py-1"
              >
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
