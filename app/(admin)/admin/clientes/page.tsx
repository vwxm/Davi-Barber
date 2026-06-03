export const dynamic = 'force-dynamic'
import { ClientPasswordReset } from '@/components/admin/ClientPasswordReset'

export default function ClientesPage() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-white">Clientes</h1>
      <ClientPasswordReset />
    </div>
  )
}
