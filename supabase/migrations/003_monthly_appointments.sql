-- Materialização semanal de mensalistas em appointments.
-- week_start = segunda-feira da semana da ocorrência (só em linhas geradas).
alter table public.appointments add column if not exists week_start date;

-- No máximo uma ocorrência por mensalista por semana (dedup idempotente).
create unique index if not exists appointments_monthly_week_uniq
  on public.appointments (monthly_client_id, week_start)
  where monthly_client_id is not null;
