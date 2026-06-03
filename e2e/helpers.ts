import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

// Test accounts use this phone prefix so teardown can find and delete them.
export const TEST_PHONE_PREFIX = '119000000' // + 2 digits => 11 digit mobile
export const TEST_PASSWORD = 'senhaTeste123'

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export function testPhone(suffix: string): string {
  return `${TEST_PHONE_PREFIX}${suffix}`.slice(0, 11).padEnd(11, '0')
}

export async function cleanupTestUsers(): Promise<number> {
  const admin = adminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  let removed = 0
  for (const u of data.users) {
    if (u.email?.startsWith(TEST_PHONE_PREFIX)) {
      await admin.from('appointments').delete().eq('client_id', u.id)
      await admin.auth.admin.deleteUser(u.id) // cascades the clients row
      removed++
    }
  }
  return removed
}
