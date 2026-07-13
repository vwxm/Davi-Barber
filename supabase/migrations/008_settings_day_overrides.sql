-- Default business hours + per-day overrides (spec 2026-07-13).

create table settings (
  id integer primary key check (id = 1),
  open_time time not null,
  close_time time not null,
  min_lead_minutes integer not null check (min_lead_minutes >= 0 and min_lead_minutes <= 1440),
  updated_at timestamptz not null default now(),
  check (close_time > open_time)
);

create table day_overrides (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  open_time time not null,
  close_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (close_time > open_time)
);

alter table settings enable row level security;
alter table day_overrides enable row level security;
-- No public policies: server actions use the service role.

insert into settings (id, open_time, close_time, min_lead_minutes)
values (1, '10:00', '20:00', 60);
