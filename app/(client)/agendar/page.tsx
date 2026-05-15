export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BookingSection from '@/components/client/BookingSection'
import type { Service } from '@/types'

export default async function AgendarPage() {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    redirect('/login')
  }

  const { data: services } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, active, created_at, updated_at')
    .eq('active', true)
    .order('name')

  return (
    <div className="py-6">
      <h1 className="text-white text-2xl font-bold mb-6">Agendar</h1>
      <BookingSection services={(services ?? []) as Service[]} />
    </div>
  )
}
