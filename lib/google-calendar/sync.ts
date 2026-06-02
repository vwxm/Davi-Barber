import 'server-only'
import { getCalendarClient } from './client'

// Build ISO datetime for São Paulo timezone.
// date: 'YYYY-MM-DD'; time may be 'HH:MM' or 'HH:MM:SS' (Postgres `time`
// columns read back with seconds). Normalize to 'HH:MM:SS'.
// Returns: '2024-01-15T09:00:00-03:00'
function toSaoPauloISO(date: string, time: string): string {
  const [h = '00', m = '00', s = '00'] = time.split(':')
  const hhmmss = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`
  return `${date}T${hhmmss}-03:00`
}

export async function createCalendarEvent(appointment: {
  id: string
  date: string
  start_time: string
  end_time: string
  access_code: string
  service?: { name: string } | null
  client?: { name: string; phone: string } | null
}): Promise<{ eventId?: string; error?: string }> {
  try {
    const { calendar, calendarId } = getCalendarClient()

    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: appointment.service?.name ?? 'Agendamento',
        description: `Código: ${appointment.access_code}\nCliente: ${appointment.client?.name ?? 'N/A'}\nTelefone: ${appointment.client?.phone ?? 'N/A'}`,
        start: {
          dateTime: toSaoPauloISO(appointment.date, appointment.start_time),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: toSaoPauloISO(appointment.date, appointment.end_time),
          timeZone: 'America/Sao_Paulo',
        },
      },
    })

    return { eventId: event.data.id ?? undefined }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Calendar error' }
  }
}

export async function updateCalendarEvent(
  eventId: string,
  appointment: {
    date: string
    start_time: string
    end_time: string
    service?: { name: string } | null
  },
): Promise<{ error?: string }> {
  try {
    const { calendar, calendarId } = getCalendarClient()

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary: appointment.service?.name ?? 'Agendamento',
        start: {
          dateTime: toSaoPauloISO(appointment.date, appointment.start_time),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: toSaoPauloISO(appointment.date, appointment.end_time),
          timeZone: 'America/Sao_Paulo',
        },
      },
    })

    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Calendar error' }
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<{ error?: string }> {
  try {
    const { calendar, calendarId } = getCalendarClient()

    await calendar.events.delete({ calendarId, eventId })

    return {}
  } catch (err) {
    // Swallow 404 (Not Found) and 410 (Gone) — event is already deleted, so
    // the desired end state is reached. Makes delete/unsync idempotent.
    const code = (err as { code?: number }).code
    if (code === 404 || code === 410) {
      return {}
    }
    if (err instanceof Error && /404|410|has been deleted/i.test(err.message)) {
      return {}
    }
    return { error: err instanceof Error ? err.message : 'Calendar error' }
  }
}
