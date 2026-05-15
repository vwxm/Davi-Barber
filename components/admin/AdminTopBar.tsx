'use client'

import { useTransition } from 'react'
import { logoutAdmin } from '@/actions/admin/auth'

interface AdminTopBarProps {
  userName: string
}

export function AdminTopBar({ userName }: AdminTopBarProps) {
  const [isPending, startTransition] = useTransition()

  const firstName = userName.split(' ')[0] ?? userName

  function handleLogout() {
    startTransition(async () => {
      await logoutAdmin()
    })
  }

  return (
    <header className="flex md:hidden items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
      {/* Hamburger (visual only) */}
      <button
        type="button"
        aria-hidden="true"
        className="p-1 text-zinc-400"
        tabIndex={-1}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Title */}
      <span className="text-amber-500 font-semibold text-sm">Davi Barber Admin</span>

      {/* User + logout */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-300 text-sm">{firstName}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isPending}
          aria-label="Sair"
          className="p-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  )
}
