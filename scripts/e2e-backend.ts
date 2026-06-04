// Real end-to-end exercise of the backend as the two personas:
//  - client: anon key + real signUp/signIn (RLS enforced, exactly like the app)
//  - admin:  service role
// Drives the DB-critical invariants the features depend on, then cleans up.
// Run: npx tsx --env-file=.env.local scripts/e2e-backend.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const PHONE_A = '11999990001'
const PHONE_B = '11999990002'
const EMAIL_A = `${PHONE_A}@davibarber.app`
const EMAIL_B = `${PHONE_B}@davibarber.app`
const PWD = 'senhaTeste123'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
  ok ? pass++ : fail++
}

function newAnon() {
  return createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
}

function code() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')
}

async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of data.users) {
    if (u.email === EMAIL_A || u.email === EMAIL_B) {
      await admin.from('appointments').delete().eq('client_id', u.id)
      await admin.auth.admin.deleteUser(u.id) // cascades clients row
    }
  }
}

async function main() {
  await cleanup() // start clean

  // 1. Client A signs up (anon) -> auth trigger should create a clients row.
  const cA = newAnon()
  const { data: signA, error: signErrA } = await cA.auth.signUp({
    email: EMAIL_A, password: PWD, options: { data: { name: 'Cliente A', phone: PHONE_A } },
  })
  check('client A signUp', !signErrA && !!signA.user, signErrA?.message ?? signA.user?.id ?? '')
  const aId = signA.user!.id

  const { data: clientRow } = await admin.from('clients').select('name, phone').eq('id', aId).maybeSingle()
  check('signup trigger created clients row', clientRow?.phone === PHONE_A, JSON.stringify(clientRow))

  // 2. Sign in (fresh client, like the app login).
  const cA2 = newAnon()
  const { error: loginErr } = await cA2.auth.signInWithPassword({ email: EMAIL_A, password: PWD })
  check('client A signIn', !loginErr, loginErr?.message ?? '')

  // 3. Public read of services under RLS.
  const { data: services } = await cA2.from('services').select('id, duration_minutes').eq('active', true).limit(1)
  check('client reads active services (RLS public)', !!services && services.length > 0, `${services?.length ?? 0} svc`)
  const svc = services![0]

  // 4. Book an appointment under the client's own session (RLS insert).
  const date = '2026-06-08' // Monday, in window
  const { data: appt, error: bookErr } = await cA2.from('appointments').insert({
    client_id: aId, service_id: svc.id, date, start_time: '14:00', end_time: '14:30',
    status: 'scheduled', access_code: code(),
  }).select('id').single()
  check('client books appointment (RLS insert own)', !bookErr && !!appt, bookErr?.message ?? appt?.id ?? '')

  // 5. Double-booking is rejected by the exclusion constraint (#1).
  const { error: dupErr } = await cA2.from('appointments').insert({
    client_id: aId, service_id: svc.id, date, start_time: '14:15', end_time: '14:45',
    status: 'scheduled', access_code: code(),
  })
  check('overlapping booking blocked by DB constraint', !!dupErr && (dupErr as { code?: string }).code === '23P01', dupErr ? `${(dupErr as { code?: string }).code}` : 'NO ERROR (BUG)')

  // 6. RLS isolation: client B cannot read client A's appointment.
  const cB = newAnon()
  await cB.auth.signUp({ email: EMAIL_B, password: PWD, options: { data: { name: 'Cliente B', phone: PHONE_B } } })
  const cB2 = newAnon()
  await cB2.auth.signInWithPassword({ email: EMAIL_B, password: PWD })
  const { data: leak } = await cB2.from('appointments').select('id').eq('id', appt!.id)
  check('RLS isolates appointments between clients', (leak?.length ?? 0) === 0, `B saw ${leak?.length ?? 0} of A's appts`)

  // 7. Client cancels own appointment (RLS update).
  const { data: canceled } = await cA2.from('appointments').update({ status: 'canceled' }).eq('id', appt!.id).eq('client_id', aId).select('status')
  check('client cancels own appointment', canceled?.[0]?.status === 'canceled', JSON.stringify(canceled))

  // 7b. After cancel, the slot frees up: same time can be booked again.
  const { error: rebookErr } = await cA2.from('appointments').insert({
    client_id: aId, service_id: svc.id, date, start_time: '14:00', end_time: '14:30',
    status: 'scheduled', access_code: code(),
  })
  check('slot reusable after cancel (constraint is partial on scheduled)', !rebookErr, rebookErr?.message ?? 'ok')

  // 8. Admin marks an appointment completed (service role).
  const { data: aAppt } = await admin.from('appointments').select('id').eq('client_id', aId).eq('status', 'scheduled').limit(1).single()
  const { data: done } = await admin.from('appointments').update({ status: 'completed' }).eq('id', aAppt!.id).select('status')
  check('admin marks completed', done?.[0]?.status === 'completed', JSON.stringify(done))

  // 9. RLS write-protection: client B cannot modify A's appointment.
  const { data: hack } = await cB2.from('appointments').update({ status: 'canceled' }).eq('id', aAppt!.id).select('id')
  check('RLS blocks cross-client writes', (hack?.length ?? 0) === 0, `B modified ${hack?.length ?? 0} rows`)

  await cleanup()
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
