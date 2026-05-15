export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { MensaisManager } from '@/components/admin/MensaisManager'
import { MonthlyClient, Client, Service } from '@/types'

export default async function MensaisPage() {
  const supabase = await createClient()

  const [{ data: monthlyClientsData }, { data: clientsData }, { data: servicesData }] = await Promise.all([
    supabase
      .from('monthly_clients')
      .select('*, client:clients(id,name,phone,is_monthly,created_at,updated_at), service:services(id,name,price,duration_minutes,active,created_at,updated_at)')
      .eq('active', true)
      .order('weekday')
      .order('start_time'),
    supabase.from('clients').select('id,name,phone,is_monthly,created_at,updated_at').order('name'),
    supabase.from('services').select('id,name,price,duration_minutes,active,created_at,updated_at').eq('active', true).order('name'),
  ])

  const monthlyClients: MonthlyClient[] = (monthlyClientsData ?? []) as MonthlyClient[]
  const clients: Client[] = (clientsData ?? []) as Client[]
  const services: Service[] = (servicesData ?? []) as Service[]

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-white">Clientes Mensais</h1>
      <MensaisManager monthlyClients={monthlyClients} clients={clients} services={services} />
    </div>
  )
}
