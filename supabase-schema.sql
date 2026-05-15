create extension if not exists pgcrypto;

create table if not exists public.clients (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  phone text not null unique,
  password_hash text,
  password_salt text,
  is_monthly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  price numeric(10, 2) not null default 0,
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id),
  client_name text not null,
  client_phone text not null,
  service_id text not null references public.services(id),
  service_name text not null,
  service_duration integer not null check (service_duration > 0),
  service_price numeric(10, 2) not null default 0,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'canceled')),
  access_code text not null default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  google_event_id text,
  google_event_link text,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'google_error')),
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.monthly_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique references public.clients(id),
  name text not null,
  phone text not null,
  notes text,
  service_id text references public.services(id),
  service_name text,
  weekday integer check (weekday between 0 and 6),
  start_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  full_day boolean not null default false,
  start_time time not null,
  end_time time not null,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.client_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.clients
add column if not exists password_hash text;

alter table public.clients
add column if not exists password_salt text;

alter table public.appointments
add column if not exists access_code text;

alter table public.appointments
add column if not exists monthly_client_id uuid references public.monthly_clients(id);

alter table public.appointments
drop constraint if exists appointments_monthly_client_id_fkey;

alter table public.appointments
add constraint appointments_monthly_client_id_fkey
foreign key (monthly_client_id)
references public.monthly_clients(id)
on delete set null;

update public.appointments
set access_code = upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))
where access_code is null;

alter table public.appointments
alter column access_code set default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

alter table public.appointments
alter column access_code set not null;

alter table public.monthly_clients
add column if not exists service_id text references public.services(id);

alter table public.monthly_clients
add column if not exists service_name text;

alter table public.monthly_clients
add column if not exists weekday integer check (weekday between 0 and 6);

alter table public.monthly_clients
add column if not exists start_time time;

create index if not exists appointments_date_idx on public.appointments(date);
create index if not exists appointments_client_phone_idx on public.appointments(client_phone);
create index if not exists appointments_lookup_idx on public.appointments(client_phone, access_code);
create index if not exists appointments_service_idx on public.appointments(service_id);
create index if not exists blocks_date_idx on public.schedule_blocks(date);
create index if not exists monthly_clients_phone_idx on public.monthly_clients(phone);
create index if not exists client_sessions_token_hash_idx on public.client_sessions(token_hash);
create index if not exists client_sessions_client_idx on public.client_sessions(client_id);

alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.monthly_clients enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.client_sessions enable row level security;

drop policy if exists "public can read services" on public.services;
drop policy if exists "public can create clients" on public.clients;
drop policy if exists "public can update own client by phone" on public.clients;
drop policy if exists "public can create appointments" on public.appointments;
drop policy if exists "public can read appointments for mvp" on public.appointments;
drop policy if exists "public can update appointments for mvp" on public.appointments;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists monthly_clients_set_updated_at on public.monthly_clients;
create trigger monthly_clients_set_updated_at
before update on public.monthly_clients
for each row execute function public.set_updated_at();

drop trigger if exists schedule_blocks_set_updated_at on public.schedule_blocks;
create trigger schedule_blocks_set_updated_at
before update on public.schedule_blocks
for each row execute function public.set_updated_at();

insert into public.services (id, name, price, duration_minutes, active)
values
  ('corte', 'Corte', 35, 30, true),
  ('barba', 'Barba', 25, 30, true),
  ('corte-barba', 'Corte + barba', 55, 60, true),
  ('corte-penteado', 'Corte com penteado', 65, 60, true)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  active = excluded.active;
