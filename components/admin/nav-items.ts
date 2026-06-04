export const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📅' },
  { href: '/admin/agenda', label: 'Agenda da Semana', icon: '🗓️' },
  { href: '/admin/buscar', label: 'Buscar', icon: '🔍' },
  { href: '/admin/relatorio', label: 'Relatório', icon: '📊' },
  { href: '/admin/servicos', label: 'Serviços', icon: '✂️' },
  { href: '/admin/bloqueios', label: 'Bloqueios', icon: '🚫' },
  { href: '/admin/mensais', label: 'Clientes Mensais', icon: '⭐' },
  { href: '/admin/clientes', label: 'Clientes', icon: '👥' },
] as const

export function isNavActive(href: string, pathname: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
}
