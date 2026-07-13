-- Distinguish grid "fechado" (hour removed from the day, grey) from
-- "bloqueio" (red hole in the day). Both hide slots from clients.
alter table schedule_blocks
  add column kind text not null default 'bloqueio'
  check (kind in ('bloqueio', 'fechado'));
