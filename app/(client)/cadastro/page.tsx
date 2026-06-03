'use client'

import { useState, useTransition } from 'react'
import { registerClient } from '@/actions/client/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import Link from 'next/link'

export default function CadastroPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await registerClient(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h2 className="text-2xl font-bold">Criar conta</h2>
        <p className="text-zinc-400 text-sm mt-1">Rápido e sem complicação</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nome" name="name" type="text" placeholder="Seu nome" required />
        <PhoneInput required />
        <Input label="Senha" name="password" type="password" placeholder="Mínimo 8 caracteres" required />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <Button type="submit" loading={isPending}>Criar conta</Button>
      </form>
      <p className="text-center text-zinc-400 text-sm">
        Já tem conta?{' '}
        <Link href="/login" className="text-amber-500 underline">Entrar</Link>
      </p>
    </div>
  )
}
