import { getDateRange, isDateTodayOrFuture } from '../../../../lib/businessRules';
import { json, requireAdmin } from '../../../../lib/api';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const startDate = String(body.startDate || body.date || '');
  const endDate = String(body.endDate || body.date || startDate);
  const fullDay = Boolean(body.fullDay);
  const startTime = fullDay ? '00:00' : String(body.startTime || '');
  const endTime = fullDay ? '23:59' : String(body.endTime || '');
  const reason = String(body.reason || '').trim();
  const dates = getDateRange(startDate, endDate, 90);

  if (!dates.length || !dates.every((date) => isDateTodayOrFuture(date))) {
    return json({ error: 'Bloqueios so podem ser criados a partir de hoje.' }, 400);
  }

  if (!fullDay && (!startTime || !endTime || endTime <= startTime)) {
    return json({ error: 'Informe inicio e fim validos para o bloqueio.' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('schedule_blocks')
    .insert(dates.map((date) => ({
      date,
      full_day: fullDay,
      start_time: startTime,
      end_time: endTime,
      reason,
      active: true
    })))
    .select();

  if (error) return json({ error: error.message }, 500);
  return json({ blocks: data }, 201);
}
