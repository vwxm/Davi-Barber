import 'server-only'
import { createClient } from './server'

export async function requireAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado.' }
  if (user.app_metadata?.role !== 'admin') return { error: 'Acesso restrito.' }
  return null
}
