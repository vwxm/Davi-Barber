-- updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- clients (id = auth.users.id)
create table public.clients (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  phone       text unique not null,
  is_monthly  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- services
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  price            numeric(10,2) not null default 0,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes % 15 = 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- monthly_clients (vem antes de appointments por FK)
-- unique em client_id = um horário fixo por cliente (intencional)
create table public.monthly_clients (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid unique not null references public.clients(id) on delete cascade,
  service_id  uuid not null references public.services(id),
  weekday     integer not null check (weekday between 0 and 6),
  start_time  time not null,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger monthly_clients_updated_at before update on public.monthly_clients
  for each row execute function public.set_updated_at();

-- appointments
create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id),
  service_id        uuid not null references public.services(id),
  date              date not null,
  start_time        time not null,
  end_time          time not null check (end_time > start_time),
  status            text not null default 'scheduled'
                    check (status in ('scheduled','completed','canceled')),
  access_code       text not null unique check (length(access_code) >= 6),
  monthly_client_id uuid references public.monthly_clients(id) on delete set null,
  google_event_id   text,
  sync_status       text not null default 'pending'
                    check (sync_status in ('pending','synced','error')),
  sync_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create index appointments_date_idx on public.appointments(date);
create index appointments_client_status_idx on public.appointments(client_id, status);
-- Previne double-booking (ignora cancelados)
create unique index appointments_no_overlap
  on public.appointments (date, start_time)
  where status != 'canceled';

-- schedule_blocks
create table public.schedule_blocks (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  full_day    boolean not null default false,
  start_time  time,
  end_time    time,
  reason      text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint valid_partial_block check (
    full_day = true or (
      start_time is not null and
      end_time is not null and
      end_time > start_time
    )
  )
);
create trigger blocks_updated_at before update on public.schedule_blocks
  for each row execute function public.set_updated_at();
create index blocks_date_idx on public.schedule_blocks(date);

-- Trigger: criar client quando usuário se registra no Auth
-- Usa app_metadata (não editável pelo cliente) para dados sensíveis
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.clients (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new; -- nunca bloquear o auth
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.monthly_clients enable row level security;
alter table public.schedule_blocks enable row level security;

-- clients policies
create policy "client_select_own" on public.clients
  for select using (auth.uid() = id);
create policy "client_update_own" on public.clients
  for update using (auth.uid() = id);
-- SEGURANÇA: usa app_metadata (só service role pode escrever, não o cliente)
create policy "admin_all_clients" on public.clients
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- services policies (leitura pública)
create policy "public_read_services" on public.services
  for select using (true);
create policy "admin_all_services" on public.services
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- appointments policies
create policy "client_select_own_appt" on public.appointments
  for select using (client_id = auth.uid());
create policy "client_insert_own_appt" on public.appointments
  for insert with check (client_id = auth.uid());
-- Cliente só pode alterar status para 'canceled' (não pode marcar 'completed')
create policy "client_update_own_appt" on public.appointments
  for update using (client_id = auth.uid())
  with check (status in ('scheduled', 'canceled'));
create policy "admin_all_appts" on public.appointments
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- monthly_clients (só admin)
create policy "admin_all_monthly" on public.monthly_clients
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- schedule_blocks (leitura pública, escrita admin)
create policy "public_read_blocks" on public.schedule_blocks
  for select using (true);
create policy "admin_all_blocks" on public.schedule_blocks
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Seed: serviços iniciais
insert into public.services (name, price, duration_minutes) values
  ('Corte', 35.00, 30),
  ('Barba', 25.00, 30),
  ('Corte + Barba', 55.00, 60),
  ('Corte + Penteado', 45.00, 45);
