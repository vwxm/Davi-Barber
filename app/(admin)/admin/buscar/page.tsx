export const dynamic = 'force-dynamic'
import { AppointmentSearch } from '@/components/admin/AppointmentSearch'

export default function BuscarPage() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-white">Buscar Agendamento</h1>
      <AppointmentSearch />
    </div>
  )
}
