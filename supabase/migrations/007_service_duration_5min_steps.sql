-- Durations in 5-minute steps (e.g. Barba = 25 min). Was multiples of 15.
alter table services drop constraint services_duration_minutes_check;
alter table services add constraint services_duration_minutes_check
  check (duration_minutes > 0 and duration_minutes % 5 = 0);
