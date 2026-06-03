// Runs once on server startup (Next.js instrumentation hook). Fails fast with a
// clear message if a required env var is missing, instead of surfacing obscure
// errors deep in a request. Google Calendar vars are validated lazily in the
// calendar client, since the app degrades gracefully without calendar sync.
export async function register() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]
  const missing = required.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
