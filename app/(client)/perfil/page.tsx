export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/client/LogoutButton'

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return phone
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData.user) {
    redirect('/login')
  }

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-white">Perfil</h1>

      {client ? (
        <div className="bg-zinc-800 rounded-xl p-4 flex flex-col gap-2">
          <p className="font-semibold text-white text-base">{client.name}</p>
          <p className="text-zinc-400 text-sm">
            Telefone: <span className="text-white">{formatPhone(client.phone)}</span>
          </p>
          <p className="text-zinc-400 text-sm">
            Membro desde:{' '}
            <span className="text-white">{new Date(client.created_at).getFullYear()}</span>
          </p>
          {client.is_monthly && (
            <p className="text-amber-400 text-sm font-medium">Cliente Mensal ✓</p>
          )}
        </div>
      ) : (
        <p className="text-zinc-400 text-sm">Perfil não encontrado.</p>
      )}

      <LogoutButton />
    </div>
  )
}
