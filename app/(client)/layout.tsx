import ConditionalShell from '@/components/client/ConditionalShell'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ConditionalShell>{children}</ConditionalShell>
}
