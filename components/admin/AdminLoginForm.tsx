'use client'

import { useState, useTransition } from 'react'
import { loginAdmin } from '@/actions/admin/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function AdminLoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginAdmin(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl p-6 flex flex-col gap-6">
        <h1 className="text-xl font-bold text-amber-500 text-center">Davi Barber — Admin</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="E-mail" name="email" type="email" placeholder="admin@..." required />
          <Input label="Senha" name="password" type="password" placeholder="••••••••" required />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <Button type="submit" loading={isPending}>Entrar</Button>
        </form>
      </div>
    </div>
  )
}
