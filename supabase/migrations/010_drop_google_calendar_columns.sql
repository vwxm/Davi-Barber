-- Google Calendar integration removed: it was a pure side-effect mirror,
-- added blocking latency to every booking, and nothing in the scheduling
-- logic (availability, conflicts, the no-overlap constraint) ever depended
-- on it. Drop the now-unused columns.
alter table public.appointments
  drop column if exists google_event_id,
  drop column if exists sync_status,
  drop column if exists sync_error;
