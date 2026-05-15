'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { logoutClient } from '@/actions/client/auth'

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutClient()
    })
  }

  return (
    <Button type="button" variant="secondary" loading={isPending} onClick={handleLogout}>
      Sair
    </Button>
  )
}
