// Appointment reminders for the next day.
//
// Runnable today as a DRY RUN: it lists every scheduled appointment for
// tomorrow and the message that would be sent, so the barber can message
// clients manually (e.g. WhatsApp) right away.
//
// To actually send automatically, wire a provider inside sendReminder() (e.g.
// Twilio SMS/WhatsApp) and set REMINDER_PROVIDER=twilio plus its credentials.
// This script can then be run on a daily schedule (cron / GitHub Actions /
// Supabase scheduled function).
//
// Usage (dry run):  npx tsx --env-file=.env.local scripts/send-reminders.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const provider = process.env.REMINDER_PROVIDER // unset => dry run

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function tomorrowBR(): string {
  const tz = 'America/Sao_Paulo'
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const d = new Date(todayStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function buildMessage(name: string, time: string, service: string): string {
  return `Olá ${name}! Lembrete do seu horário amanhã às ${time} (${service}) na Davi Barber. Para cancelar ou remarcar, acesse o app.`
}

// Integration point. Replace the body with a real provider call.
async function sendReminder(phone: string, message: string): Promise<void> {
  if (!provider) {
    console.log(`[dry-run] -> ${phone}: ${message}`)
    return
  }
  // Example (pseudo): if (provider === 'twilio') { await twilio.messages.create(...) }
  throw new Error(`REMINDER_PROVIDER='${provider}' is set but no sender is wired. Implement sendReminder().`)
}

async function main() {
  const date = tomorrowBR()
  const { data, error } = await supabase
    .from('appointments')
    .select('start_time, service:services(name), client:clients(name, phone)')
    .eq('date', date)
    .eq('status', 'scheduled')
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.log(`No appointments for ${date}.`)
    return
  }

  console.log(`${data.length} reminder(s) for ${date}${provider ? '' : ' (dry run)'}:`)
  for (const appt of data as unknown as Array<{
    start_time: string
    service: { name: string } | null
    client: { name: string; phone: string } | null
  }>) {
    if (!appt.client?.phone) continue
    const message = buildMessage(
      appt.client.name ?? 'cliente',
      appt.start_time.slice(0, 5),
      appt.service?.name ?? 'serviço',
    )
    await sendReminder(appt.client.phone, message)
  }
  console.log('Done.')
}

main()
