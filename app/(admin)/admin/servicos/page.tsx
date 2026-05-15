export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { ServicosManager } from '@/components/admin/ServicosManager'
import { Service } from '@/types'

export default async function ServicosPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('services').select('*').order('name')
  const services: Service[] = data ?? []

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-white">Serviços</h1>
      <ServicosManager services={services} />
    </div>
  )
}
