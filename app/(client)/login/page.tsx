'use client'

import { useState, useTransition } from 'react'
import { loginClient } from '@/actions/client/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginClient(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h2 className="text-2xl font-bold">Entrar</h2>
        <p className="text-zinc-400 text-sm mt-1">Digite seu telefone e senha</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Telefone" name="phone" type="tel" placeholder="(11) 99999-9999" required />
        <Input label="Senha" name="password" type="password" placeholder="••••••••" required />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <Button type="submit" loading={isPending}>Entrar</Button>
      </form>
      <p className="text-center text-zinc-400 text-sm">
        Não tem conta?{' '}
        <Link href="/cadastro" className="text-amber-500 underline">Cadastre-se</Link>
      </p>
    </div>
  )
}
