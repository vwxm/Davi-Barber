'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Agendar', icon: '✂️' },
  { href: '/agendamentos', label: 'Meus Horários', icon: '📅' },
  { href: '/perfil', label: 'Perfil', icon: '👤' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 flex">
      {links.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex-1 flex flex-col items-center justify-center py-3 text-xs gap-1 transition-colors
            ${pathname === href ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          <span className="text-xl">{icon}</span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
