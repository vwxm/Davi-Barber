import { getCurrentMonthWindow, getCurrentWeekWindow, sortByDateTime } from '../../../../lib/businessRules';
import { json, requireAdmin } from '../../../../lib/api';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseAdmin();
  const { monday, saturday } = getCurrentWeekWindow();
  const month = getCurrentMonthWindow();

  const [appointments, services, monthlyClients, blocks] = await Promise.all([
    supabase
      .from('appointments')
      .select('*')
      .gte('date', month.start)
      .lte('date', month.end)
      .neq('status', 'canceled')
      .order('date')
      .order('start_time'),
    supabase.from('services').select('*').order('name'),
    supabase.from('monthly_clients').select('*').eq('active', true).order('name'),
    supabase
      .from('schedule_blocks')
      .select('*')
      .gte('date', month.start)
      .lte('date', month.end)
      .eq('active', true)
      .order('date')
      .order('start_time')
  ]);

  if (appointments.error) return json({ error: appointments.error.message }, 500);
  if (services.error) return json({ error: services.error.message }, 500);
  if (monthlyClients.error) return json({ error: monthlyClients.error.message }, 500);
  if (blocks.error) return json({ error: blocks.error.message }, 500);

  return json({
    week: { monday, saturday },
    appointments: appointments.data.sort(sortByDateTime),
    services: services.data,
    monthlyClients: monthlyClients.data,
    blocks: blocks.data
  });
}
