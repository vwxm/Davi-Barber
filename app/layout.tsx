import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Davi Barber',
  description: 'Agendamento de barbearia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
