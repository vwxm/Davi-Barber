-- Bloqueios por período: data fim opcional (intervalo de datas).
-- date_end nulo = bloqueio de data única. Período é sempre dia inteiro.
alter table public.schedule_blocks add column if not exists date_end date;

alter table public.schedule_blocks
  add constraint valid_period check (
    date_end is null or (date_end >= date and full_day = true)
  );
