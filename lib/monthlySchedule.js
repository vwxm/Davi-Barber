import { getRemainingMonthDatesByWeekday, toDateInputValue } from './businessRules';
import { updateCalendarEventStatus } from './googleCalendar';

export async function deleteFutureMonthlySchedule(supabase, monthly) {
  const today = toDateInputValue(new Date());
  const dates = Number.isInteger(monthly.weekday)
    ? getRemainingMonthDatesByWeekday(monthly.weekday)
    : [];

  const linked = await supabase
    .from('appointments')
    .select('id,google_event_id')
    .eq('monthly_client_id', monthly.id)
    .gte('date', today);

  if (linked.error) throw new Error(linked.error.message);

  const legacy = [];
  for (const date of dates) {
    const result = await supabase
      .from('appointments')
      .select('id,google_event_id,monthly_client_id')
      .eq('client_id', monthly.client_id)
      .eq('service_id', monthly.service_id)
      .eq('date', date)
      .eq('start_time', monthly.start_time)
      .eq('status', 'scheduled');

    if (result.error) throw new Error(result.error.message);
    legacy.push(...result.data.filter((appointment) => !appointment.monthly_client_id || appointment.monthly_client_id === monthly.id));
  }

  const byId = new Map([...linked.data, ...legacy].map((appointment) => [appointment.id, appointment]));
  for (const appointment of byId.values()) {
    try {
      await updateCalendarEventStatus(appointment.google_event_id, 'canceled');
    } catch {
      // The local cleanup should still happen if Google deletion fails.
    }

    const deleted = await supabase.from('appointments').delete().eq('id', appointment.id);
    if (deleted.error) throw new Error(deleted.error.message);
  }
}

export async function unlinkPastMonthlyAppointments(supabase, monthlyClientId) {
  const today = toDateInputValue(new Date());
  const result = await supabase
    .from('appointments')
    .update({ monthly_client_id: null })
    .eq('monthly_client_id', monthlyClientId)
    .lt('date', today);

  if (result.error) throw new Error(result.error.message);
}
