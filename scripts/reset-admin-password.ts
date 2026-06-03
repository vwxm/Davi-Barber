import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function resetPassword() {
  const email = process.argv[2]
  const newPassword = process.argv[3]

  if (!email || !newPassword) {
    console.error('Usage: npx tsx scripts/reset-admin-password.ts <email> <newPassword>')
    process.exit(1)
  }

  // Find the user by email.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) {
    console.error('Error listing users:', listError.message)
    process.exit(1)
  }

  const user = list.users.find((u) => u.email === email)
  if (!user) {
    console.error('No user found with email:', email)
    process.exit(1)
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (error) {
    console.error('Error updating password:', error.message)
    process.exit(1)
  }

  console.log('Password updated for', email, '(id:', user.id + ')')
}

resetPassword()
