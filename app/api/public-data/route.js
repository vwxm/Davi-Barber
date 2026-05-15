import { getClientBookingWindow, toDateInputValue } from '../../../lib/businessRules';
import { json } from '../../../lib/api';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const today = toDateInputValue(new Date());
  const bookingWindow = getClientBookingWindow();

  const [services, clients, todayAppointments] = await Promise.all([
    supabase.from('services').select('id,name,price,duration_minutes').eq('active', true).order('name'),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('date', today)
      .neq('status', 'canceled')
  ]);

  if (services.error) return json({ error: services.error.message }, 500);

  return json({
    week: {
      monday: bookingWindow.start,
      saturday: bookingWindow.end
    },
    services: services.data,
    stats: {
      today: todayAppointments.count || 0,
      clients: clients.count || 0,
      services: services.data.length
    }
  });
}
