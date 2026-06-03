'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { logoutAdmin } from '@/actions/admin/auth'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📅' },
  { href: '/admin/servicos', label: 'Serviços', icon: '✂️' },
  { href: '/admin/bloqueios', label: 'Bloqueios', icon: '🚫' },
  { href: '/admin/mensais', label: 'Clientes Mensais', icon: '⭐' },
  { href: '/admin/clientes', label: 'Clientes', icon: '👥' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAdmin()
    })
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-zinc-800 border-r border-zinc-700 min-h-screen">
      {/* Header */}
      <div className="p-6 border-b border-zinc-700">
        <p className="text-amber-500 font-bold text-lg">Davi Barber</p>
        <p className="text-zinc-400 text-sm">Admin</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4">
        {NAV.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-zinc-700">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isPending}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <span aria-hidden="true">🚪</span>
          {isPending ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </aside>
  )
}
