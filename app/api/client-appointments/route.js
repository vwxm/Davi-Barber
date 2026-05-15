import { sortByDateTime } from '../../../lib/businessRules';
import { getClientFromRequest } from '../../../lib/clientAuth';
import { json } from '../../../lib/api';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const client = await getClientFromRequest(request);
  if (!client) return json({ error: 'Login de cliente obrigatorio.' }, 401);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('appointments')
    .select('id,date,start_time,end_time,service_id,service_name,service_duration,status,access_code')
    .eq('client_id', client.id)
    .neq('status', 'canceled')
    .limit(50);

  if (error) return json({ error: error.message }, 500);
  return json({ appointments: data.sort(sortByDateTime) });
}
