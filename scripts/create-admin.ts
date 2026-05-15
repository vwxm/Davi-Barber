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

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <password>')
    process.exit(1)
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    app_metadata: { role: 'admin' },
    user_metadata: { name: 'Admin' },
    email_confirm: true,
  })

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log('Admin criado:', data.user.id)
}

createAdmin()
