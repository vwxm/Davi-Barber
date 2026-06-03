-- Prevent double-booking at the database level: no two scheduled appointments
-- may overlap in absolute time (single chair). Encodes date+time into a tsrange
-- so the half-open [start, end) semantics also allow back-to-back slots.
create extension if not exists btree_gist;

-- Drop any orphan index left by a partially-applied attempt before recreating.
drop index if exists public.appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    tsrange((date + start_time), (date + end_time)) with &&
  ) where (status = 'scheduled');
