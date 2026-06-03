'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAdmin } from '@/actions/admin/auth'
import { ADMIN_NAV, isNavActive } from '@/components/admin/nav-items'

interface AdminTopBarProps {
  userName: string
}

export function AdminTopBar({ userName }: AdminTopBarProps) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const firstName = userName.split(' ')[0] ?? userName

  function handleLogout() {
    startTransition(async () => {
      await logoutAdmin()
    })
  }

  return (
    <div className="md:hidden">
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          className="p-1 text-zinc-300 hover:text-white"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        <span className="text-amber-500 font-semibold text-sm">Davi Barber Admin</span>

        <div className="flex items-center gap-2">
          <span className="text-zinc-300 text-sm">{firstName}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            aria-label="Sair"
            className="p-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {open && (
        <nav className="bg-zinc-800 border-b border-zinc-700">
          {ADMIN_NAV.map((item) => {
            const isActive = isNavActive(item.href, pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
