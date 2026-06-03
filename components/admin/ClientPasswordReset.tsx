'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { resetClientPassword } from '@/actions/admin/clients'
import { formatPhoneInput } from '@/lib/business-rules/phone'

export function ClientPasswordReset() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    startTransition(async () => {
      const result = await resetClientPassword(phone, password)
      if (result.error) {
        setError(result.error)
        return
      }
      setDone(true)
      setPhone('')
      setPassword('')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-800 rounded-xl p-4 space-y-3 max-w-md">
      <h2 className="text-lg font-semibold text-amber-500">Redefinir senha de cliente</h2>
      <p className="text-zinc-400 text-sm">
        Use quando um cliente esquecer a senha. Informe o telefone cadastrado e uma nova senha.
      </p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {done && <p className="text-green-400 text-sm">Senha redefinida com sucesso.</p>}
      <Input
        label="Telefone do cliente"
        name="phone"
        type="tel"
        placeholder="(11) 99999-9999"
        value={phone}
        onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
        required
      />
      <Input
        label="Nova senha"
        name="password"
        type="text"
        placeholder="Mínimo 8 caracteres"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" loading={isPending}>Redefinir senha</Button>
    </form>
  )
}
