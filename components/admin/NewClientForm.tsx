'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClientAccount } from '@/actions/admin/clients'
import { formatPhoneInput } from '@/lib/business-rules/phone'

export function NewClientForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setName('')
    setPhone('')
    setPassword('')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(null)
    startTransition(async () => {
      const result = await createClientAccount({ name, phone, password })
      if (result.error) {
        setError(result.error)
        return
      }
      setDone(`Cliente ${result.client?.name} cadastrado.`)
      reset()
    })
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => { setOpen(true); setDone(null) }} className="w-auto">
        + Novo Cliente
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-800 rounded-xl p-4 space-y-3 max-w-md">
      <h2 className="text-lg font-semibold text-amber-500">Novo Cliente</h2>
      <p className="text-zinc-400 text-sm">
        Cadastre um cliente diretamente — ele já entra com esse telefone e senha.
      </p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {done && <p className="text-green-400 text-sm">{done}</p>}
      <Input
        label="Nome"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label="Telefone"
        name="phone"
        type="tel"
        inputMode="numeric"
        placeholder="(11) 99999-9999"
        value={phone}
        onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
        required
      />
      <Input
        label="Senha"
        name="password"
        type="text"
        placeholder="Mínimo 8 caracteres"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <div className="flex gap-2">
        <Button type="submit" loading={isPending}>Cadastrar</Button>
        <Button type="button" variant="secondary" onClick={() => { setOpen(false); reset() }} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
