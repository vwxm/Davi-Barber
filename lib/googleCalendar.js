import { google } from 'googleapis';

function getCalendarSettings() {
  return {
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    timeZone: process.env.BARBERSHOP_TIMEZONE || 'America/Sao_Paulo'
  };
}

function getCalendarClient() {
  const { clientEmail, privateKey } = getCalendarSettings();

  if (!clientEmail || !privateKey) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  return google.calendar({ version: 'v3', auth });
}

export async function createCalendarEvent(appointment) {
  const { calendarId, timeZone } = getCalendarSettings();
  const calendar = getCalendarClient();

  if (!calendarId || !calendar) {
    return null;
  }

  const event = {
    summary: `${appointment.service_name} - ${appointment.client_name}`,
    description: `Cliente: ${appointment.client_name}\nTelefone: ${appointment.client_phone}\nServiço: ${appointment.service_name}`,
    start: {
      dateTime: `${appointment.date}T${normalizeClock(appointment.start_time)}`,
      timeZone
    },
    end: {
      dateTime: `${appointment.date}T${normalizeClock(appointment.end_time)}`,
      timeZone
    }
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event
  });

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink
  };
}

export async function updateCalendarEventStatus(googleEventId, status) {
  const { calendarId } = getCalendarSettings();
  const calendar = getCalendarClient();

  if (!calendarId || !calendar || !googleEventId) {
    return null;
  }

  if (status === 'canceled') {
    await calendar.events.delete({ calendarId, eventId: googleEventId });
    return { deleted: true };
  }

  return null;
}

export async function updateCalendarEventTime(appointment) {
  const { calendarId, timeZone } = getCalendarSettings();
  const calendar = getCalendarClient();

  if (!calendarId || !calendar || !appointment.google_event_id) {
    return null;
  }

  await calendar.events.patch({
    calendarId,
    eventId: appointment.google_event_id,
    requestBody: {
      start: {
        dateTime: `${appointment.date}T${normalizeClock(appointment.start_time)}`,
        timeZone
      },
      end: {
        dateTime: `${appointment.date}T${normalizeClock(appointment.end_time)}`,
        timeZone
      }
    }
  });

  return { updated: true };
}

export async function testCalendarConnection() {
  const { calendarId, clientEmail, privateKey } = getCalendarSettings();
  const calendar = getCalendarClient();

  if (!calendarId || !clientEmail || !privateKey || !calendar) {
    return {
      ok: false,
      error: 'Variaveis GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_EMAIL ou GOOGLE_PRIVATE_KEY nao configuradas.'
    };
  }

  const response = await calendar.calendars.get({ calendarId });
  return {
    ok: true,
    calendar: {
      id: response.data.id,
      summary: response.data.summary,
      timeZone: response.data.timeZone
    }
  };
}

function normalizeClock(value) {
  const clock = String(value);
  return clock.length === 5 ? `${clock}:00` : clock;
}
