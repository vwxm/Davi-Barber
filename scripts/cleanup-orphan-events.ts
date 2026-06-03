// One-off maintenance: delete Google Calendar events left behind by
// appointments that were canceled before cancel started removing the event.
// Finds canceled appointments that still carry a google_event_id, deletes the
// event, and clears the column.
//
// Usage: npx tsx --env-file=.env.local scripts/cleanup-orphan-events.ts
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
const calendarId = process.env.GOOGLE_CALENDAR_ID

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!clientEmail || !privateKey || !calendarId) {
  console.error('Set GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/calendar'],
})
const calendar = google.calendar({ version: 'v3', auth })

async function main() {
  const { data: orphans, error } = await supabase
    .from('appointments')
    .select('id, google_event_id')
    .eq('status', 'canceled')
    .not('google_event_id', 'is', null)

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }
  if (!orphans || orphans.length === 0) {
    console.log('No orphan events to clean.')
    return
  }

  console.log(`Found ${orphans.length} orphan event(s).`)
  for (const appt of orphans) {
    try {
      await calendar.events.delete({ calendarId, eventId: appt.google_event_id! })
      console.log('Deleted event for appointment', appt.id)
    } catch (err) {
      const code = (err as { code?: number }).code
      const msg = err instanceof Error ? err.message : ''
      if (code === 404 || code === 410 || /404|410|has been deleted/i.test(msg)) {
        console.log('Event already gone for appointment', appt.id)
      } else {
        console.error('Failed to delete event for appointment', appt.id, '-', msg)
        continue
      }
    }
    await supabase.from('appointments').update({ google_event_id: null }).eq('id', appt.id)
  }
  console.log('Done.')
}

main()
