import { json, requireAdmin } from '../../../../../lib/api';
import { testCalendarConnection } from '../../../../../lib/googleCalendar';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await testCalendarConnection();
    return json(result, result.ok ? 200 : 500);
  } catch (error) {
    return json({
      ok: false,
      error: error.message,
      code: error.code || null
    }, 500);
  }
}
