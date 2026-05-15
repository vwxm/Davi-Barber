# Davi Barber — Reescrita Total

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o sistema de agendamento de barbearia do zero com Next.js 15 + TypeScript + Supabase Auth, mobile-first, corrigindo todos os bugs críticos do Codex.

**Architecture:** Next.js 15 App Router com Server Actions para mutações. Supabase como banco + auth (JWT em cookies httpOnly via @supabase/ssr). Clientes autenticam com telefone+senha (email fake gerado internamente). Admin usa mesma stack com role='admin' no JWT.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (Postgres + Auth), @supabase/ssr, googleapis, Vitest

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `types/index.ts` | Todos os tipos TypeScript centralizados |
| `lib/supabase/client.ts` | Supabase browser client |
| `lib/supabase/server.ts` | Supabase server client (Server Components/Actions) |
| `lib/supabase/admin.ts` | Supabase service role (bypass RLS, só server) |
| `lib/business-rules/phone.ts` | Normalização e geração de email fake |
| `lib/business-rules/slots.ts` | Cálculo de slots disponíveis |
| `lib/business-rules/booking-window.ts` | Janela de agendamento (Seg–Sáb semana atual) |
| `lib/google-calendar/client.ts` | Autenticação Google service account |
| `lib/google-calendar/events.ts` | CRUD de eventos no Calendar |
| `middleware.ts` | Proteção de rotas /admin/* e /agendamentos/* |
| `actions/client/auth.ts` | register, login, logout cliente |
| `actions/client/appointments.ts` | book, cancel, reschedule |
| `actions/admin/appointments.ts` | CRUD agendamentos admin |
| `actions/admin/services.ts` | CRUD serviços |
| `actions/admin/blocks.ts` | CRUD bloqueios |
| `actions/admin/monthly-clients.ts` | CRUD clientes mensais |
| `components/ui/` | Button, Input, Modal, Toast, Card |
| `components/client/BottomNav.tsx` | Navegação mobile inferior |
| `components/client/BookingForm.tsx` | Formulário de agendamento |
| `components/client/SlotPicker.tsx` | Grid de horários |
| `components/client/AppointmentCard.tsx` | Card de agendamento do cliente |
| `components/admin/Sidebar.tsx` | Sidebar admin |
| `components/admin/AgendaView.tsx` | Visualização da agenda |
| `components/admin/ServiceForm.tsx` | Form serviços |
| `components/admin/BlockForm.tsx` | Form bloqueios |
| `components/admin/MonthlyClientForm.tsx` | Form clientes mensais |
| `app/(client)/layout.tsx` | Layout mobile com BottomNav |
| `app/(client)/page.tsx` | Página de agendamento |
| `app/(client)/agendamentos/page.tsx` | Meus agendamentos |
| `app/(client)/login/page.tsx` | Login cliente (telefone+senha) |
| `app/(client)/cadastro/page.tsx` | Cadastro cliente |
| `app/(admin)/layout.tsx` | Layout admin com Sidebar |
| `app/(admin)/page.tsx` | Dashboard / agenda do dia |
| `app/(admin)/agenda/page.tsx` | Agenda mensal |
| `app/(admin)/servicos/page.tsx` | Serviços |
| `app/(admin)/bloqueios/page.tsx` | Bloqueios |
| `app/(admin)/clientes/page.tsx` | Clientes mensais |
| `app/(admin)/login/page.tsx` | Login admin |

---

## Fase 1 — Fundação

### Task 1: Limpar arquivos legados

**Files:**
- Delete: `app.js`, `index.html`, `styles.css`, `supabase-config.js`, `supabase-schema.sql`
- Delete: `lib/accessCode.js`, `lib/api.js`, `lib/clientAuth.js`, `lib/adminAppointments.js`, `lib/businessRules.js`, `lib/googleCalendar.js`, `lib/monthlySchedule.js`, `lib/supabaseAdmin.js`
- Delete: `app/api/admin/`, `app/api/client/`, `app/api/appointments/`, `app/api/client-appointments/`, `app/api/public-data/`, `app/api/slots/`
- Delete: `app/admin/`, `app/login/`
- Modify: `app/page.jsx` → substituir por placeholder
- Modify: `app/layout.jsx` → renomear para `app/layout.tsx`

- [ ] **Step 1: Deletar arquivos legados raiz**

```bash
rm "app.js" "index.html" "styles.css" "supabase-config.js" "supabase-schema.sql"
```

- [ ] **Step 2: Deletar lib legada**

```bash
rm lib/accessCode.js lib/api.js lib/clientAuth.js lib/adminAppointments.js lib/businessRules.js lib/googleCalendar.js lib/monthlySchedule.js lib/supabaseAdmin.js
```

- [ ] **Step 3: Deletar API routes antigas**

```bash
rm -rf app/api/admin app/api/client app/api/appointments app/api/client-appointments app/api/public-data app/api/slots
rm -rf app/admin app/login
```

- [ ] **Step 4: Substituir page.jsx por placeholder TypeScript**

Criar `app/page.tsx`:
```tsx
export default function Home() {
  return <div>Davi Barber</div>
}
```

Deletar `app/page.jsx`.

- [ ] **Step 5: Renomear layout**

Criar `app/layout.tsx` com conteúdo mínimo:
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Davi Barber',
  description: 'Agendamento de barbearia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

Deletar `app/layout.jsx`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove all legacy files from Codex"
```

---

### Task 2: Instalar dependências e configurar TypeScript

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Instalar dependências**

```bash
npm install @supabase/supabase-js @supabase/ssr googleapis
npm install -D typescript @types/node @types/react @types/react-dom vitest @vitejs/plugin-react
```

- [ ] **Step 2: Criar tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Criar vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Atualizar next.config.js → next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
```

Deletar `next.config.js`.

- [ ] **Step 5: Verificar que projeto compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add TypeScript, Vitest, Supabase SSR dependencies"
```

---

### Task 3: Schema do banco de dados

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Criar diretório de migrations**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Criar migration SQL**

Criar `supabase/migrations/001_initial_schema.sql`:

```sql
-- Extensões
create extension if not exists "uuid-ossp";

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
  created_at  timestamptz not null default now()
);

-- services
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  price            numeric(10,2) not null default 0,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes % 15 = 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- monthly_clients (referenciado por appointments, então vem antes)
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
  access_code       text not null unique,
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
create index appointments_client_idx on public.appointments(client_id);

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
  constraint valid_partial_block check (
    full_day = true or (
      start_time is not null and
      end_time is not null and
      end_time > start_time
    )
  )
);
create index blocks_date_idx on public.schedule_blocks(date);

-- Trigger: criar client quando usuário se registra no Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.clients (id, name, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone'
  );
  return new;
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
create policy "admin_all_clients" on public.clients
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- services policies (leitura pública)
create policy "public_read_services" on public.services
  for select using (true);
create policy "admin_all_services" on public.services
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- appointments policies
create policy "client_select_own_appt" on public.appointments
  for select using (client_id = auth.uid());
create policy "client_insert_own_appt" on public.appointments
  for insert with check (client_id = auth.uid());
create policy "client_update_own_appt" on public.appointments
  for update using (client_id = auth.uid());
create policy "admin_all_appts" on public.appointments
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- monthly_clients (só admin)
create policy "admin_all_monthly" on public.monthly_clients
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- schedule_blocks (leitura pública, escrita admin)
create policy "public_read_blocks" on public.schedule_blocks
  for select using (true);
create policy "admin_all_blocks" on public.schedule_blocks
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Seed: serviços iniciais
insert into public.services (name, price, duration_minutes) values
  ('Corte', 35.00, 30),
  ('Barba', 25.00, 30),
  ('Corte + Barba', 55.00, 60),
  ('Corte + Penteado', 45.00, 45);
```

- [ ] **Step 3: Rodar migration no Supabase SQL Editor**

Colar o conteúdo do arquivo acima no SQL Editor do Supabase e executar.

Verificar:
```sql
select tablename from pg_tables where schemaname = 'public';
-- Deve retornar: clients, services, monthly_clients, appointments, schedule_blocks
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add database schema with RLS policies and triggers"
```

---

### Task 4: Tipos TypeScript centralizados

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Criar types/index.ts**

```typescript
export type AppointmentStatus = 'scheduled' | 'completed' | 'canceled'
export type SyncStatus = 'pending' | 'synced' | 'error'

export interface Client {
  id: string
  name: string
  phone: string
  is_monthly: boolean
  created_at: string
}

export interface Service {
  id: string
  name: string
  price: number
  duration_minutes: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  client_id: string
  service_id: string
  date: string          // 'YYYY-MM-DD'
  start_time: string    // 'HH:MM'
  end_time: string      // 'HH:MM'
  status: AppointmentStatus
  access_code: string
  monthly_client_id: string | null
  google_event_id: string | null
  sync_status: SyncStatus
  sync_error: string | null
  created_at: string
  updated_at: string
  // joins opcionais
  client?: Client
  service?: Service
}

export interface MonthlyClient {
  id: string
  client_id: string
  service_id: string
  weekday: number       // 0=Dom, 1=Seg, ..., 6=Sáb
  start_time: string    // 'HH:MM'
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
  client?: Client
  service?: Service
}

export interface ScheduleBlock {
  id: string
  date: string          // 'YYYY-MM-DD'
  full_day: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
  active: boolean
  created_at: string
}

export interface TimeSlot {
  start: string         // 'HH:MM'
  end: string           // 'HH:MM'
  available: boolean
}

export interface BookingInput {
  service_id: string
  date: string
  start_time: string
}

export interface BusinessHours {
  start: string
  end: string
  slotMinutes: number
  breaks: Array<{ start: string; end: string }>
  closedWeekdays: number[]
}
```

- [ ] **Step 2: Verificar tipos compilam**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add centralized TypeScript types"
```

---

### Task 5: Clientes Supabase e variáveis de ambiente

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `.env.local` (não commitado)
- Modify: `.env.example`

- [ ] **Step 1: Criar .env.local com credenciais reais**

Pegar URL e chaves no Supabase Dashboard → Settings → API.
Pegar credenciais do Google do arquivo `davi-barber-496323-8f76898bb5d9.json`.

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

GOOGLE_CLIENT_EMAIL=agendamento@davi-barber-496323.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=email@gmail.com

BARBERSHOP_TIMEZONE=America/Sao_Paulo
```

- [ ] **Step 2: Criar lib/supabase/client.ts (browser)**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Criar lib/supabase/server.ts (Server Components/Actions)**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 4: Criar lib/supabase/admin.ts (service role, só server)**

```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 5: Atualizar .env.example**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=

BARBERSHOP_TIMEZONE=America/Sao_Paulo
```

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/ .env.example
git commit -m "feat: add Supabase client utilities (browser, server, admin)"
```

---

### Task 6: Regras de negócio (TypeScript + testes)

**Files:**
- Create: `lib/business-rules/phone.ts`
- Create: `lib/business-rules/slots.ts`
- Create: `lib/business-rules/booking-window.ts`
- Create: `lib/business-rules/phone.test.ts`
- Create: `lib/business-rules/slots.test.ts`

- [ ] **Step 1: Criar lib/business-rules/phone.ts**

```typescript
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@davibarber.app`
}

export function isValidBrazilianPhone(phone: string): boolean {
  const digits = normalizePhone(phone)
  return digits.length >= 10 && digits.length <= 11
}
```

- [ ] **Step 2: Criar lib/business-rules/phone.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { normalizePhone, phoneToEmail, isValidBrazilianPhone } from './phone'

describe('normalizePhone', () => {
  it('strips formatting', () => {
    expect(normalizePhone('+55 (11) 99999-9999')).toBe('5511999999999')
  })
  it('leaves digits only', () => {
    expect(normalizePhone('11999999999')).toBe('11999999999')
  })
})

describe('phoneToEmail', () => {
  it('generates fake email from phone', () => {
    expect(phoneToEmail('(11) 99999-9999')).toBe('11999999999@davibarber.app')
  })
})

describe('isValidBrazilianPhone', () => {
  it('accepts 11-digit mobile', () => {
    expect(isValidBrazilianPhone('11999999999')).toBe(true)
  })
  it('accepts 10-digit landline', () => {
    expect(isValidBrazilianPhone('1133334444')).toBe(true)
  })
  it('rejects short numbers', () => {
    expect(isValidBrazilianPhone('123')).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar testes de phone**

```bash
npx vitest run lib/business-rules/phone.test.ts
```

Esperado: 5 testes passando.

- [ ] **Step 4: Criar lib/business-rules/slots.ts**

```typescript
import type { Appointment, ScheduleBlock, TimeSlot, BusinessHours } from '@/types'

export const BUSINESS_HOURS: BusinessHours = {
  start: '09:00',
  end: '19:00',
  slotMinutes: 30,
  breaks: [{ start: '12:00', end: '13:00' }],
  closedWeekdays: [0], // domingo
}

export const TIMEZONE = process.env.BARBERSHOP_TIMEZONE ?? 'America/Sao_Paulo'

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function rangesOverlap(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  return timeToMinutes(start1) < timeToMinutes(end2) &&
         timeToMinutes(end1) > timeToMinutes(start2)
}

export function getAvailableSlots(
  date: string,
  durationMinutes: number,
  appointments: Appointment[],
  blocks: ScheduleBlock[],
  nowISO: string,
): TimeSlot[] {
  const { start, end, slotMinutes, breaks, closedWeekdays } = BUSINESS_HOURS

  const dateObj = new Date(date + 'T00:00:00')
  const weekday = dateObj.getDay()
  if (closedWeekdays.includes(weekday)) return []

  const fullDayBlock = blocks.find(b => b.active && b.date === date && b.full_day)
  if (fullDayBlock) return []

  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  const slots: TimeSlot[] = []

  const now = new Date(nowISO)
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  const isToday = date === todayStr
  const nowMinutes = isToday
    ? now.getHours() * 60 + now.getMinutes()
    : 0

  for (let t = startMin; t + durationMinutes <= endMin; t += slotMinutes) {
    const slotStart = minutesToTime(t)
    const slotEnd = minutesToTime(t + durationMinutes)

    if (isToday && t <= nowMinutes) continue

    const blockedByBreak = breaks.some(b => rangesOverlap(slotStart, slotEnd, b.start, b.end))
    if (blockedByBreak) continue

    const blockedByBlock = blocks.some(b =>
      b.active && b.date === date && !b.full_day &&
      b.start_time && b.end_time &&
      rangesOverlap(slotStart, slotEnd, b.start_time, b.end_time)
    )
    if (blockedByBlock) continue

    const hasConflict = appointments.some(a =>
      a.status === 'scheduled' && a.date === date &&
      rangesOverlap(slotStart, slotEnd, a.start_time, a.end_time)
    )

    slots.push({ start: slotStart, end: slotEnd, available: !hasConflict })
  }

  return slots
}
```

- [ ] **Step 5: Criar lib/business-rules/slots.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { getAvailableSlots, timeToMinutes, minutesToTime } from './slots'
import type { Appointment, ScheduleBlock } from '@/types'

describe('timeToMinutes / minutesToTime', () => {
  it('converts 09:30 to 570', () => expect(timeToMinutes('09:30')).toBe(570))
  it('converts 570 to 09:30', () => expect(minutesToTime(570)).toBe('09:30'))
})

describe('getAvailableSlots', () => {
  const future = '2099-06-02' // segunda-feira distante
  const nowISO = '2099-06-01T10:00:00.000Z'

  it('returns slots for a free Monday', () => {
    const slots = getAvailableSlots(future, 30, [], [], nowISO)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.every(s => s.available)).toBe(true)
  })

  it('returns empty for Sunday', () => {
    const sunday = '2099-06-01' // domingo
    expect(getAvailableSlots(sunday, 30, [], [], nowISO)).toHaveLength(0)
  })

  it('marks slot unavailable when appointment conflicts', () => {
    const appt: Appointment = {
      id: '1', client_id: 'c1', service_id: 's1',
      date: future, start_time: '09:00', end_time: '09:30',
      status: 'scheduled', access_code: 'ABC123',
      monthly_client_id: null, google_event_id: null,
      sync_status: 'pending', sync_error: null,
      created_at: '', updated_at: '',
    }
    const slots = getAvailableSlots(future, 30, [appt], [], nowISO)
    const nineSlot = slots.find(s => s.start === '09:00')
    expect(nineSlot?.available).toBe(false)
  })

  it('marks slot unavailable during break', () => {
    const slots = getAvailableSlots(future, 30, [], [], nowISO)
    const breakSlot = slots.find(s => s.start === '12:00')
    expect(breakSlot).toBeUndefined()
  })

  it('returns empty for full_day block', () => {
    const block: ScheduleBlock = {
      id: 'b1', date: future, full_day: true,
      start_time: null, end_time: null,
      reason: 'Férias', active: true, created_at: '',
    }
    expect(getAvailableSlots(future, 30, [], [block], nowISO)).toHaveLength(0)
  })
})
```

- [ ] **Step 6: Rodar testes de slots**

```bash
npx vitest run lib/business-rules/slots.test.ts
```

Esperado: 7 testes passando.

- [ ] **Step 7: Criar lib/business-rules/booking-window.ts**

```typescript
import { TIMEZONE } from './slots'

export interface BookingWindow {
  start: Date
  end: Date
}

export function getClientBookingWindow(): BookingWindow {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  const today = new Date(todayStr + 'T00:00:00')

  // Encontra a segunda-feira da semana atual
  const weekday = today.getDay() // 0=Dom
  const daysToMonday = weekday === 0 ? 1 : (8 - weekday) % 7 === 0 ? 0 : -(weekday - 1)
  const monday = new Date(today)
  monday.setDate(today.getDate() + (weekday === 0 ? 1 : 1 - weekday))

  // Sábado da semana atual
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)

  return { start: monday, end: saturday }
}

export function isDateInBookingWindow(dateStr: string): boolean {
  const { start, end } = getClientBookingWindow()
  const date = new Date(dateStr + 'T00:00:00')
  return date >= start && date <= end
}

export function getBookingWeekDates(): string[] {
  const { start, end } = getClientBookingWindow()
  const dates: string[] = []
  const current = new Date(start)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates.filter(d => new Date(d + 'T00:00:00').getDay() !== 0) // remove domingo
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/business-rules/ types/
git commit -m "feat: add business rules with TypeScript and tests"
```

---

### Task 7: Middleware de proteção de rotas

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Criar middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Rotas admin: exige usuário com role=admin
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    if (user.user_metadata?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Rotas autenticadas do cliente
  if (pathname.startsWith('/agendamentos') || pathname.startsWith('/perfil')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirecionar usuário já logado fora do login
  if ((pathname === '/login' || pathname === '/cadastro') && user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add route protection middleware"
```

---

## Fase 2 — Auth

### Task 8: Server Actions de auth do cliente

**Files:**
- Create: `actions/client/auth.ts`

- [ ] **Step 1: Criar actions/client/auth.ts**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { phoneToEmail, isValidBrazilianPhone, normalizePhone } from '@/lib/business-rules/phone'

export async function registerClient(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const phone = formData.get('phone') as string
  const password = formData.get('password') as string

  if (!name || name.length < 2) {
    return { error: 'Nome deve ter pelo menos 2 caracteres.' }
  }
  if (!isValidBrazilianPhone(phone)) {
    return { error: 'Telefone inválido. Use formato: (11) 99999-9999' }
  }
  if (password.length < 8) {
    return { error: 'Senha deve ter pelo menos 8 caracteres.' }
  }

  const supabase = await createClient()
  const email = phoneToEmail(phone)
  const cleanPhone = normalizePhone(phone)

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone: cleanPhone },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'Telefone já cadastrado. Faça login.' }
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }

  redirect('/')
}

export async function loginClient(formData: FormData) {
  const phone = formData.get('phone') as string
  const password = formData.get('password') as string

  if (!isValidBrazilianPhone(phone)) {
    return { error: 'Telefone inválido.' }
  }

  const supabase = await createClient()
  const email = phoneToEmail(phone)

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Telefone ou senha incorretos.' }
  }

  redirect('/')
}

export async function logoutClient() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Commit**

```bash
git add actions/client/auth.ts
git commit -m "feat: add client auth server actions (register, login, logout)"
```

---

### Task 9: Páginas de login e cadastro do cliente

**Files:**
- Create: `app/(client)/login/page.tsx`
- Create: `app/(client)/cadastro/page.tsx`
- Create: `app/(client)/layout.tsx`
- Create: `components/client/BottomNav.tsx`
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Input.tsx`

- [ ] **Step 1: Criar components/ui/Button.tsx**

```tsx
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, className = '', ...props }: ButtonProps) {
  const base = 'min-h-[44px] px-4 py-2 rounded-lg font-medium text-base transition-colors disabled:opacity-50 w-full'
  const variants = {
    primary: 'bg-amber-500 hover:bg-amber-600 text-white',
    secondary: 'bg-zinc-700 hover:bg-zinc-600 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? 'Aguarde...' : children}
    </button>
  )
}
```

- [ ] **Step 2: Criar components/ui/Input.tsx**

```tsx
import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s/g, '-')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={inputId}
        className="min-h-[44px] px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-white text-base
                   focus:outline-none focus:border-amber-500 placeholder:text-zinc-500"
        {...props}
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Criar components/client/BottomNav.tsx**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Agendar', icon: '✂️' },
  { href: '/agendamentos', label: 'Meus Horários', icon: '📅' },
  { href: '/perfil', label: 'Perfil', icon: '👤' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 flex">
      {links.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex-1 flex flex-col items-center justify-center py-3 text-xs gap-1 transition-colors
            ${pathname === href ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          <span className="text-xl">{icon}</span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Criar app/(client)/layout.tsx**

```tsx
import { BottomNav } from '@/components/client/BottomNav'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <h1 className="text-lg font-bold text-amber-500">Davi Barber</h1>
      </header>
      <main className="pb-20 px-4 pt-4 max-w-lg mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 5: Criar app/(client)/login/page.tsx**

```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { loginClient } from '@/actions/client/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginClient(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h2 className="text-2xl font-bold">Entrar</h2>
        <p className="text-zinc-400 text-sm mt-1">Digite seu telefone e senha</p>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Telefone" name="phone" type="tel" placeholder="(11) 99999-9999" required />
        <Input label="Senha" name="password" type="password" placeholder="••••••••" required />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <Button type="submit" loading={isPending}>Entrar</Button>
      </form>
      <p className="text-center text-zinc-400 text-sm">
        Não tem conta?{' '}
        <Link href="/cadastro" className="text-amber-500 underline">Cadastre-se</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Criar app/(client)/cadastro/page.tsx**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { registerClient } from '@/actions/client/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'

export default function CadastroPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await registerClient(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h2 className="text-2xl font-bold">Criar conta</h2>
        <p className="text-zinc-400 text-sm mt-1">Rápido e sem complicação</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nome" name="name" type="text" placeholder="Seu nome" required />
        <Input label="Telefone" name="phone" type="tel" placeholder="(11) 99999-9999" required />
        <Input label="Senha" name="password" type="password" placeholder="Mínimo 8 caracteres" required />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <Button type="submit" loading={isPending}>Criar conta</Button>
      </form>
      <p className="text-center text-zinc-400 text-sm">
        Já tem conta?{' '}
        <Link href="/login" className="text-amber-500 underline">Entrar</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Verificar build**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add app/\(client\)/ components/
git commit -m "feat: add client login, register pages with mobile layout"
```

---

### Task 10: Auth admin + criar usuário admin no Supabase

**Files:**
- Create: `actions/admin/auth.ts`
- Create: `app/(admin)/login/page.tsx`
- Create: `scripts/create-admin.ts`

- [ ] **Step 1: Criar scripts/create-admin.ts**

Script para rodar uma vez e criar o usuário admin:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <password>')
    process.exit(1)
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { role: 'admin', name: 'Admin' },
    email_confirm: true,
  })

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log('Admin criado:', data.user.id)
}

createAdmin()
```

- [ ] **Step 2: Instalar tsx e rodar script**

```bash
npm install -D tsx
npx tsx scripts/create-admin.ts davi@davibarber.com SenhaForte123!
```

Esperado: `Admin criado: <uuid>`

- [ ] **Step 3: Criar actions/admin/auth.ts**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginAdmin(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || data.user?.user_metadata?.role !== 'admin') {
    await supabase.auth.signOut()
    return { error: 'Credenciais inválidas.' }
  }

  redirect('/admin')
}

export async function logoutAdmin() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
```

- [ ] **Step 4: Criar app/(admin)/login/page.tsx**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { loginAdmin } from '@/actions/admin/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginAdmin(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl p-6 flex flex-col gap-6">
        <h1 className="text-xl font-bold text-amber-500 text-center">Davi Barber — Admin</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="E-mail" name="email" type="email" placeholder="admin@..." required />
          <Input label="Senha" name="password" type="password" placeholder="••••••••" required />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <Button type="submit" loading={isPending}>Entrar</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add actions/admin/auth.ts app/\(admin\)/login/ scripts/
git commit -m "feat: add admin auth with role check and login page"
```

---

## Fase 3 — Funcionalidades do Cliente

### Task 11: Server Actions de agendamento (cliente)

**Files:**
- Create: `actions/client/appointments.ts`

- [ ] **Step 1: Criar actions/client/appointments.ts**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAvailableSlots } from '@/lib/business-rules/slots'
import { isDateInBookingWindow } from '@/lib/business-rules/booking-window'
import { syncAppointmentToCalendar, deleteCalendarEvent } from '@/lib/google-calendar/events'
import type { BookingInput } from '@/types'
import { randomBytes } from 'crypto'

function generateAccessCode(): string {
  return randomBytes(3).toString('hex').toUpperCase()
}

export async function getPublicData() {
  const supabase = await createClient()
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('name')
  return { services: services ?? [] }
}

export async function getAvailableSlotsForDate(serviceId: string, date: string) {
  if (!isDateInBookingWindow(date)) {
    return { slots: [], error: 'Data fora da janela de agendamento.' }
  }

  const supabase = await createClient()

  const [{ data: service }, { data: appointments }, { data: blocks }] = await Promise.all([
    supabase.from('services').select('duration_minutes').eq('id', serviceId).single(),
    supabase.from('appointments').select('*').eq('date', date).eq('status', 'scheduled'),
    supabase.from('schedule_blocks').select('*').eq('date', date).eq('active', true),
  ])

  if (!service) return { slots: [], error: 'Serviço não encontrado.' }

  const slots = getAvailableSlots(
    date,
    service.duration_minutes,
    appointments ?? [],
    blocks ?? [],
    new Date().toISOString()
  )

  return { slots, error: null }
}

export async function bookAppointment(input: BookingInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  if (!isDateInBookingWindow(input.date)) {
    return { error: 'Data fora da janela de agendamento.' }
  }

  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', input.service_id)
    .single()
  if (!service) return { error: 'Serviço não encontrado.' }

  const endMinutes = input.start_time.split(':').map(Number).reduce((h, m) => h * 60 + m) + service.duration_minutes
  const end_time = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`

  // Verificar disponibilidade com admin client para evitar race condition
  const admin = createAdminClient()
  const { data: conflicts } = await admin
    .from('appointments')
    .select('id')
    .eq('date', input.date)
    .eq('status', 'scheduled')
    .lt('start_time', end_time)
    .gt('end_time', input.start_time)

  if (conflicts && conflicts.length > 0) {
    return { error: 'Horário não disponível. Escolha outro.' }
  }

  let accessCode = generateAccessCode()
  // Garantir unicidade do código
  let codeExists = true
  while (codeExists) {
    const { data } = await admin.from('appointments').select('id').eq('access_code', accessCode).single()
    codeExists = !!data
    if (codeExists) accessCode = generateAccessCode()
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      client_id: user.id,
      service_id: input.service_id,
      date: input.date,
      start_time: input.start_time,
      end_time,
      access_code: accessCode,
    })
    .select('*, service:services(*), client:clients(*)')
    .single()

  if (error) return { error: 'Erro ao agendar. Tente novamente.' }

  // Sync Google Calendar (assíncrono, não bloqueia)
  syncAppointmentToCalendar(appointment).catch(console.error)

  return { appointment, error: null }
}

export async function cancelAppointment(appointmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: appt } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .eq('client_id', user.id)
    .single()

  if (!appt) return { error: 'Agendamento não encontrado.' }
  if (appt.status !== 'scheduled') return { error: 'Agendamento já cancelado ou concluído.' }

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'canceled' })
    .eq('id', appointmentId)

  if (error) return { error: 'Erro ao cancelar.' }

  if (appt.google_event_id) {
    deleteCalendarEvent(appt.google_event_id).catch(console.error)
  }

  return { error: null }
}

export async function getMyAppointments() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { appointments: [], error: 'Não autenticado.' }

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, service:services(name, price, duration_minutes)')
    .eq('client_id', user.id)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  return { appointments: appointments ?? [], error: null }
}
```

- [ ] **Step 2: Commit**

```bash
git add actions/client/appointments.ts
git commit -m "feat: add client appointment server actions (book, cancel, list)"
```

---

### Task 12: Página principal de agendamento (mobile)

**Files:**
- Create: `components/client/SlotPicker.tsx`
- Create: `components/client/BookingForm.tsx`
- Create: `app/(client)/page.tsx`
- Create: `components/ui/Card.tsx`

- [ ] **Step 1: Criar components/ui/Card.tsx**

```tsx
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean
}

export function Card({ selected, children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors cursor-pointer
        ${selected
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
        } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Criar components/client/SlotPicker.tsx**

```tsx
'use client'

import type { TimeSlot } from '@/types'

interface SlotPickerProps {
  slots: TimeSlot[]
  selected: string | null
  onSelect: (slot: string) => void
}

export function SlotPicker({ slots, selected, onSelect }: SlotPickerProps) {
  const available = slots.filter(s => s.available)

  if (available.length === 0) {
    return <p className="text-zinc-400 text-sm text-center py-4">Sem horários disponíveis nesse dia.</p>
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {available.map(slot => (
        <button
          key={slot.start}
          onClick={() => onSelect(slot.start)}
          className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors
            ${selected === slot.start
              ? 'border-amber-500 bg-amber-500 text-zinc-950'
              : 'border-zinc-700 bg-zinc-800 text-white hover:border-amber-500'
            }`}
        >
          {slot.start}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Criar components/client/BookingForm.tsx**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { getAvailableSlotsForDate, bookAppointment } from '@/actions/client/appointments'
import { getBookingWeekDates } from '@/lib/business-rules/booking-window'
import { SlotPicker } from './SlotPicker'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { Service, TimeSlot, Appointment } from '@/types'

interface BookingFormProps {
  services: Service[]
  onBooked: (appt: Appointment) => void
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function BookingForm({ services, onBooked }: BookingFormProps) {
  const [step, setStep] = useState<'service' | 'date' | 'slot' | 'confirm'>('service')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const weekDates = getBookingWeekDates()

  function handleServiceSelect(service: Service) {
    setSelectedService(service)
    setStep('date')
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date)
    setSelectedSlot(null)
    startTransition(async () => {
      const result = await getAvailableSlotsForDate(selectedService!.id, date)
      if (result.error) { setError(result.error); return }
      setSlots(result.slots)
      setStep('slot')
    })
  }

  function handleConfirm() {
    if (!selectedService || !selectedDate || !selectedSlot) return
    setError(null)
    startTransition(async () => {
      const result = await bookAppointment({
        service_id: selectedService.id,
        date: selectedDate,
        start_time: selectedSlot,
      })
      if (result.error) { setError(result.error); return }
      onBooked(result.appointment!)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step 1: Serviço */}
      <section>
        <h2 className="font-semibold text-zinc-300 mb-3">Serviço</h2>
        <div className="flex flex-col gap-2">
          {services.map(s => (
            <Card key={s.id} selected={selectedService?.id === s.id} onClick={() => handleServiceSelect(s)}>
              <div className="flex justify-between items-center">
                <span className="font-medium">{s.name}</span>
                <div className="text-right text-sm text-zinc-400">
                  <div>R$ {Number(s.price).toFixed(2)}</div>
                  <div>{s.duration_minutes} min</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Step 2: Data */}
      {step !== 'service' && (
        <section>
          <h2 className="font-semibold text-zinc-300 mb-3">Data</h2>
          <div className="grid grid-cols-3 gap-2">
            {weekDates.map(date => {
              const d = new Date(date + 'T00:00:00')
              return (
                <button
                  key={date}
                  onClick={() => handleDateSelect(date)}
                  disabled={isPending}
                  className={`min-h-[56px] rounded-lg border flex flex-col items-center justify-center text-sm transition-colors
                    ${selectedDate === date
                      ? 'border-amber-500 bg-amber-500 text-zinc-950'
                      : 'border-zinc-700 bg-zinc-800 text-white hover:border-amber-500'
                    }`}
                >
                  <span className="text-xs opacity-70">{WEEKDAY_SHORT[d.getDay()]}</span>
                  <span className="font-bold">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Step 3: Horário */}
      {step === 'slot' || step === 'confirm' ? (
        <section>
          <h2 className="font-semibold text-zinc-300 mb-3">Horário</h2>
          <SlotPicker
            slots={slots}
            selected={selectedSlot}
            onSelect={slot => { setSelectedSlot(slot); setStep('confirm') }}
          />
        </section>
      ) : null}

      {/* Step 4: Confirmar */}
      {step === 'confirm' && selectedSlot && (
        <section className="flex flex-col gap-3">
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <Button onClick={handleConfirm} loading={isPending}>
            Confirmar às {selectedSlot}
          </Button>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Criar app/(client)/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getPublicData } from '@/actions/client/appointments'
import { BookingSection } from '@/components/client/BookingSection'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { services } = await getPublicData()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">
          {user ? 'Agendar horário' : 'Bem-vindo!'}
        </h2>
        {!user && (
          <p className="text-zinc-400 text-sm mt-1">
            <a href="/login" className="text-amber-500 underline">Entre</a> ou{' '}
            <a href="/cadastro" className="text-amber-500 underline">cadastre-se</a> para agendar.
          </p>
        )}
      </div>
      {user && <BookingSection services={services} />}
    </div>
  )
}
```

- [ ] **Step 5: Criar components/client/BookingSection.tsx (client wrapper)**

```tsx
'use client'

import { useState } from 'react'
import { BookingForm } from './BookingForm'
import type { Service, Appointment } from '@/types'

interface BookingSectionProps {
  services: Service[]
}

export function BookingSection({ services }: BookingSectionProps) {
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null)

  if (confirmedAppointment) {
    return (
      <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 flex flex-col gap-3 text-center">
        <div className="text-4xl">✅</div>
        <h3 className="font-bold text-lg">Agendamento confirmado!</h3>
        <p className="text-zinc-300 text-sm">
          {confirmedAppointment.date} às {confirmedAppointment.start_time}
        </p>
        <p className="text-zinc-400 text-sm">Código de acesso:</p>
        <button
          className="font-mono text-2xl font-bold text-amber-500 tracking-widest"
          onClick={() => navigator.clipboard.writeText(confirmedAppointment.access_code)}
          title="Clique para copiar"
        >
          {confirmedAppointment.access_code}
        </button>
        <p className="text-zinc-500 text-xs">Toque no código para copiar</p>
        <button
          onClick={() => setConfirmedAppointment(null)}
          className="text-amber-500 underline text-sm mt-2"
        >
          Fazer outro agendamento
        </button>
      </div>
    )
  }

  return <BookingForm services={services} onBooked={setConfirmedAppointment} />
}
```

- [ ] **Step 6: Commit**

```bash
git add app/\(client\)/page.tsx components/client/ components/ui/Card.tsx
git commit -m "feat: add mobile booking form with service/date/slot steps"
```

---

### Task 13: Página de agendamentos do cliente

**Files:**
- Create: `components/client/AppointmentCard.tsx`
- Create: `app/(client)/agendamentos/page.tsx`
- Create: `app/(client)/perfil/page.tsx`

- [ ] **Step 1: Criar components/client/AppointmentCard.tsx**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { cancelAppointment } from '@/actions/client/appointments'
import type { Appointment } from '@/types'

interface AppointmentCardProps {
  appointment: Appointment & { service?: { name: string; price: number } }
  onCanceled: (id: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  completed: 'Concluído',
  canceled: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  scheduled: 'text-green-400',
  completed: 'text-zinc-400',
  canceled: 'text-red-400',
}

export function AppointmentCard({ appointment: appt, onCanceled }: AppointmentCardProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCancel() {
    if (!confirm('Cancelar este agendamento?')) return
    startTransition(async () => {
      const result = await cancelAppointment(appt.id)
      if (result.error) { setError(result.error); return }
      onCanceled(appt.id)
    })
  }

  const dateStr = new Date(appt.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">{appt.service?.name ?? 'Serviço'}</p>
          <p className="text-zinc-400 text-sm capitalize">{dateStr}</p>
          <p className="text-zinc-400 text-sm">{appt.start_time.slice(0, 5)}</p>
        </div>
        <span className={`text-sm font-medium ${STATUS_COLOR[appt.status]}`}>
          {STATUS_LABEL[appt.status]}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500 font-mono tracking-widest">{appt.access_code}</span>
        {appt.service && (
          <span className="text-zinc-400">R$ {Number(appt.service.price).toFixed(2)}</span>
        )}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {appt.status === 'scheduled' && (
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="text-red-400 text-sm underline self-start disabled:opacity-50"
        >
          {isPending ? 'Cancelando...' : 'Cancelar'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar app/(client)/agendamentos/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { getMyAppointments } from '@/actions/client/appointments'
import { AppointmentCard } from '@/components/client/AppointmentCard'
import type { Appointment } from '@/types'

export default function AgendamentosPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAppointments().then(({ appointments }) => {
      setAppointments(appointments)
      setLoading(false)
    })
  }, [])

  function handleCanceled(id: string) {
    setAppointments(prev =>
      prev.map(a => a.id === id ? { ...a, status: 'canceled' as const } : a)
    )
  }

  if (loading) return <p className="text-zinc-400 text-center py-8">Carregando...</p>

  const upcoming = appointments.filter(a => a.status === 'scheduled')
  const past = appointments.filter(a => a.status !== 'scheduled')

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold">Meus Horários</h2>

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-zinc-400 text-center py-8">Nenhum agendamento ainda.</p>
      )}

      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Próximos</h3>
          {upcoming.map(a => (
            <AppointmentCard key={a.id} appointment={a} onCanceled={handleCanceled} />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Histórico</h3>
          {past.map(a => (
            <AppointmentCard key={a.id} appointment={a} onCanceled={handleCanceled} />
          ))}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar app/(client)/perfil/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logoutClient } from '@/actions/client/auth'
import { Button } from '@/components/ui/Button'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('name, phone')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold">Perfil</h2>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-2">
        <p className="font-semibold text-lg">{client?.name}</p>
        <p className="text-zinc-400">
          {client?.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
        </p>
      </div>
      <form action={logoutClient}>
        <Button type="submit" variant="secondary">Sair</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(client\)/agendamentos/ app/\(client\)/perfil/ components/client/AppointmentCard.tsx
git commit -m "feat: add client appointments list and profile pages"
```

---

## Fase 4 — Funcionalidades do Admin

### Task 14: Layout e dashboard do admin

**Files:**
- Create: `components/admin/Sidebar.tsx`
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/page.tsx`
- Create: `actions/admin/appointments.ts`

- [ ] **Step 1: Criar components/admin/Sidebar.tsx**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAdmin } from '@/actions/admin/auth'

const links = [
  { href: '/admin', label: 'Agenda', icon: '📅', exact: true },
  { href: '/admin/agenda', label: 'Mês', icon: '🗓️' },
  { href: '/admin/clientes', label: 'Mensais', icon: '👥' },
  { href: '/admin/servicos', label: 'Serviços', icon: '✂️' },
  { href: '/admin/bloqueios', label: 'Bloqueios', icon: '🚫' },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="px-4 py-5 border-b border-zinc-800">
        <h1 className="font-bold text-amber-500">Davi Barber</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Admin</p>
      </div>
      <nav className="flex-1 p-2 flex flex-col gap-1">
        {links.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${active ? 'bg-amber-500/20 text-amber-500' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      <form action={logoutAdmin} className="p-2">
        <button
          type="submit"
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 transition-colors"
        >
          Sair
        </button>
      </form>
    </aside>
  )
}
```

- [ ] **Step 2: Criar app/(admin)/layout.tsx**

```tsx
import { Sidebar } from '@/components/admin/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Criar actions/admin/appointments.ts**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { AppointmentStatus } from '@/types'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') throw new Error('Unauthorized')
  return user
}

export async function getDayAppointments(date: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('appointments')
    .select('*, service:services(name, duration_minutes, price), client:clients(name, phone)')
    .eq('date', date)
    .order('start_time')
  return data ?? []
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('appointments')
    .update({ status })
    .eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function createAdminAppointment(data: {
  client_name: string
  client_phone: string
  service_id: string
  date: string
  start_time: string
}) {
  await assertAdmin()
  const admin = createAdminClient()

  const { data: service } = await admin
    .from('services')
    .select('duration_minutes')
    .eq('id', data.service_id)
    .single()
  if (!service) return { error: 'Serviço não encontrado.' }

  const startMin = data.start_time.split(':').map(Number).reduce((h, m) => h * 60 + m)
  const endMin = startMin + service.duration_minutes
  const end_time = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`

  // Buscar ou criar cliente pelo telefone
  const phone = data.client_phone.replace(/\D/g, '')
  let clientId: string

  const { data: existingClient } = await admin
    .from('clients')
    .select('id')
    .eq('phone', phone)
    .single()

  if (existingClient) {
    clientId = existingClient.id
  } else {
    // Criar usuário auth + client para agendamento manual
    const { data: newUser, error: authError } = await admin.auth.admin.createUser({
      email: `${phone}@davibarber.app`,
      user_metadata: { name: data.client_name, phone },
      email_confirm: true,
    })
    if (authError) return { error: 'Erro ao criar cliente.' }
    clientId = newUser.user.id
  }

  const { randomBytes } = await import('crypto')
  const access_code = randomBytes(3).toString('hex').toUpperCase()

  const { error } = await admin.from('appointments').insert({
    client_id: clientId,
    service_id: data.service_id,
    date: data.date,
    start_time: data.start_time,
    end_time,
    access_code,
  })

  if (error) return { error: 'Erro ao criar agendamento.' }
  return { error: null }
}
```

- [ ] **Step 4: Criar app/(admin)/page.tsx**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { getDayAppointments, updateAppointmentStatus } from '@/actions/admin/appointments'
import type { Appointment } from '@/types'

const TIMEZONE = 'America/Sao_Paulo'

function getTodayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

export default function AdminDashboard() {
  const [date, setDate] = useState(getTodayString)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLoading(true)
    getDayAppointments(date).then(data => {
      setAppointments(data)
      setLoading(false)
    })
  }, [date])

  function handleStatus(id: string, status: 'completed' | 'canceled') {
    startTransition(async () => {
      await updateAppointmentStatus(id, status)
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status } : a)
      )
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda do dia</h1>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <p className="text-zinc-400">Carregando...</p>
      ) : appointments.length === 0 ? (
        <p className="text-zinc-400">Nenhum agendamento para este dia.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {appointments.map(appt => (
            <div key={appt.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-semibold">{(appt as any).client?.name ?? '—'}</p>
                <p className="text-zinc-400 text-sm">{(appt as any).service?.name}</p>
                <p className="text-zinc-400 text-sm">{appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                  ${appt.status === 'scheduled' ? 'bg-green-900 text-green-400' :
                    appt.status === 'completed' ? 'bg-zinc-700 text-zinc-300' :
                    'bg-red-900 text-red-400'}`}
                >
                  {appt.status === 'scheduled' ? 'Agendado' : appt.status === 'completed' ? 'Concluído' : 'Cancelado'}
                </span>
                {appt.status === 'scheduled' && (
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => handleStatus(appt.id, 'completed')}
                      disabled={isPending}
                      className="text-xs text-green-400 hover:underline"
                    >
                      Concluir
                    </button>
                    <button
                      onClick={() => handleStatus(appt.id, 'canceled')}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/ components/admin/ actions/admin/
git commit -m "feat: add admin layout, sidebar, and day agenda dashboard"
```

---

### Task 15: Admin — serviços, bloqueios, clientes mensais

**Files:**
- Create: `actions/admin/services.ts`
- Create: `actions/admin/blocks.ts`
- Create: `actions/admin/monthly-clients.ts`
- Create: `app/(admin)/servicos/page.tsx`
- Create: `app/(admin)/bloqueios/page.tsx`
- Create: `app/(admin)/clientes/page.tsx`

- [ ] **Step 1: Criar actions/admin/services.ts**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') throw new Error('Unauthorized')
}

export async function getServices() {
  const admin = createAdminClient()
  const { data } = await admin.from('services').select('*').order('name')
  return data ?? []
}

export async function upsertService(data: {
  id?: string
  name: string
  price: number
  duration_minutes: number
  active: boolean
}) {
  await assertAdmin()
  const admin = createAdminClient()
  if (data.id) {
    const { error } = await admin.from('services').update({
      name: data.name, price: data.price,
      duration_minutes: data.duration_minutes, active: data.active,
    }).eq('id', data.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('services').insert({
      name: data.name, price: data.price,
      duration_minutes: data.duration_minutes, active: data.active,
    })
    if (error) return { error: error.message }
  }
  return { error: null }
}
```

- [ ] **Step 2: Criar actions/admin/blocks.ts**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') throw new Error('Unauthorized')
}

export async function getBlocks(fromDate?: string) {
  const admin = createAdminClient()
  let query = admin.from('schedule_blocks').select('*').eq('active', true).order('date')
  if (fromDate) query = query.gte('date', fromDate)
  const { data } = await query
  return data ?? []
}

export async function createBlock(data: {
  date: string
  full_day: boolean
  start_time?: string
  end_time?: string
  reason?: string
}) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('schedule_blocks').insert(data)
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteBlock(id: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('schedule_blocks').update({ active: false }).eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}
```

- [ ] **Step 3: Criar actions/admin/monthly-clients.ts**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') throw new Error('Unauthorized')
}

function getRemainingMonthDatesByWeekday(weekday: number): string[] {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const dates: string[] = []
  for (let d = today.getDate(); d <= lastDay; d++) {
    const date = new Date(year, month, d)
    if (date.getDay() === weekday) {
      dates.push(date.toISOString().split('T')[0])
    }
  }
  return dates
}

export async function getMonthlyClients() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('monthly_clients')
    .select('*, client:clients(name, phone), service:services(name, duration_minutes)')
    .eq('active', true)
    .order('weekday')
  return data ?? []
}

export async function createMonthlyClient(data: {
  client_phone: string
  client_name: string
  service_id: string
  weekday: number
  start_time: string
  notes?: string
}) {
  await assertAdmin()
  const admin = createAdminClient()

  const phone = data.client_phone.replace(/\D/g, '')
  let clientId: string

  const { data: existing } = await admin.from('clients').select('id').eq('phone', phone).single()
  if (existing) {
    clientId = existing.id
  } else {
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email: `${phone}@davibarber.app`,
      user_metadata: { name: data.client_name, phone },
      email_confirm: true,
    })
    if (error) return { error: 'Erro ao criar cliente.' }
    clientId = newUser.user.id
  }

  const { data: mc, error: mcError } = await admin
    .from('monthly_clients')
    .insert({
      client_id: clientId,
      service_id: data.service_id,
      weekday: data.weekday,
      start_time: data.start_time,
      notes: data.notes,
    })
    .select()
    .single()

  if (mcError) return { error: mcError.message }

  const { data: service } = await admin
    .from('services')
    .select('duration_minutes')
    .eq('id', data.service_id)
    .single()
  if (!service) return { error: 'Serviço não encontrado.' }

  const endMin = data.start_time.split(':').map(Number).reduce((h, m) => h * 60 + m) + service.duration_minutes
  const end_time = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`

  const dates = getRemainingMonthDatesByWeekday(data.weekday)
  for (const date of dates) {
    const access_code = randomBytes(3).toString('hex').toUpperCase()
    await admin.from('appointments').insert({
      client_id: clientId,
      service_id: data.service_id,
      date,
      start_time: data.start_time,
      end_time,
      access_code,
      monthly_client_id: mc.id,
    })
  }

  await admin.from('clients').update({ is_monthly: true }).eq('id', clientId)
  return { error: null }
}

export async function deleteMonthlyClient(id: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const today = new Date().toISOString().split('T')[0]
  await admin
    .from('appointments')
    .update({ status: 'canceled' })
    .eq('monthly_client_id', id)  // CORRIGIDO: só apaga os deste cliente mensal
    .gte('date', today)
    .eq('status', 'scheduled')

  await admin.from('monthly_clients').update({ active: false }).eq('id', id)
  return { error: null }
}
```

- [ ] **Step 4: Criar app/(admin)/servicos/page.tsx**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { getServices, upsertService } from '@/actions/admin/services'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Service } from '@/types'

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [editing, setEditing] = useState<Partial<Service> | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { getServices().then(setServices) }, [])

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await upsertService({
        id: editing.id,
        name: fd.get('name') as string,
        price: Number(fd.get('price')),
        duration_minutes: Number(fd.get('duration_minutes')),
        active: fd.get('active') === 'on',
      })
      if (result.error) { setError(result.error); return }
      setEditing(null)
      getServices().then(setServices)
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Serviços</h1>
        <Button onClick={() => setEditing({})} className="w-auto px-4">+ Novo</Button>
      </div>

      {editing !== null && (
        <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-4">
          <h2 className="font-semibold">{editing.id ? 'Editar' : 'Novo'} serviço</h2>
          <Input label="Nome" name="name" defaultValue={editing.name} required />
          <Input label="Preço (R$)" name="price" type="number" step="0.01" defaultValue={editing.price} required />
          <Input label="Duração (minutos)" name="duration_minutes" type="number" step="15" defaultValue={editing.duration_minutes} required />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="active" defaultChecked={editing.active !== false} className="w-4 h-4" />
            Ativo
          </label>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={isPending}>Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {services.map(s => (
          <div key={s.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-zinc-400 text-sm">R$ {Number(s.price).toFixed(2)} · {s.duration_minutes} min</p>
            </div>
            <div className="flex items-center gap-3">
              {!s.active && <span className="text-xs text-zinc-500">Inativo</span>}
              <button onClick={() => setEditing(s)} className="text-amber-500 text-sm hover:underline">
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Criar app/(admin)/bloqueios/page.tsx**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { getBlocks, createBlock, deleteBlock } from '@/actions/admin/blocks'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ScheduleBlock } from '@/types'

export default function BloqueiosPage() {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [showForm, setShowForm] = useState(false)
  const [fullDay, setFullDay] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { getBlocks(today).then(setBlocks) }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createBlock({
        date: fd.get('date') as string,
        full_day: fullDay,
        start_time: fullDay ? undefined : fd.get('start_time') as string,
        end_time: fullDay ? undefined : fd.get('end_time') as string,
        reason: fd.get('reason') as string || undefined,
      })
      if (result.error) { setError(result.error); return }
      setShowForm(false)
      getBlocks(today).then(setBlocks)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteBlock(id)
      setBlocks(prev => prev.filter(b => b.id !== id))
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bloqueios</h1>
        <Button onClick={() => setShowForm(true)} className="w-auto px-4">+ Novo</Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-4">
          <Input label="Data" name="date" type="date" required />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={fullDay} onChange={e => setFullDay(e.target.checked)} className="w-4 h-4" />
            Dia inteiro
          </label>
          {!fullDay && (
            <div className="flex gap-3">
              <Input label="Início" name="start_time" type="time" required />
              <Input label="Fim" name="end_time" type="time" required />
            </div>
          )}
          <Input label="Motivo (opcional)" name="reason" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={isPending}>Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {blocks.length === 0 && <p className="text-zinc-400">Nenhum bloqueio ativo.</p>}
        {blocks.map(b => (
          <div key={b.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{b.date}</p>
              <p className="text-zinc-400 text-sm">
                {b.full_day ? 'Dia inteiro' : `${b.start_time} – ${b.end_time}`}
                {b.reason && ` · ${b.reason}`}
              </p>
            </div>
            <button onClick={() => handleDelete(b.id)} className="text-red-400 text-sm hover:underline">
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Criar app/(admin)/clientes/page.tsx**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { getMonthlyClients, createMonthlyClient, deleteMonthlyClient } from '@/actions/admin/monthly-clients'
import { getServices } from '@/actions/admin/services'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { MonthlyClient, Service } from '@/types'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function ClientesPage() {
  const [clients, setClients] = useState<MonthlyClient[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMonthlyClients().then(setClients)
    getServices().then(setServices)
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createMonthlyClient({
        client_name: fd.get('client_name') as string,
        client_phone: fd.get('client_phone') as string,
        service_id: fd.get('service_id') as string,
        weekday: Number(fd.get('weekday')),
        start_time: fd.get('start_time') as string,
        notes: fd.get('notes') as string || undefined,
      })
      if (result.error) { setError(result.error); return }
      setShowForm(false)
      getMonthlyClients().then(setClients)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Remover cliente mensal e cancelar agendamentos futuros?')) return
    startTransition(async () => {
      await deleteMonthlyClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes Mensais</h1>
        <Button onClick={() => setShowForm(true)} className="w-auto px-4">+ Novo</Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-4">
          <Input label="Nome do cliente" name="client_name" required />
          <Input label="Telefone" name="client_phone" type="tel" placeholder="(11) 99999-9999" required />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Serviço</label>
            <select name="service_id" required className="min-h-[44px] px-3 rounded-lg bg-zinc-800 border border-zinc-600 text-white">
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Dia da semana</label>
            <select name="weekday" required className="min-h-[44px] px-3 rounded-lg bg-zinc-800 border border-zinc-600 text-white">
              {[1,2,3,4,5,6].map(d => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}
            </select>
          </div>
          <Input label="Horário" name="start_time" type="time" required />
          <Input label="Observações (opcional)" name="notes" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={isPending}>Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {clients.length === 0 && <p className="text-zinc-400">Nenhum cliente mensal.</p>}
        {clients.map(c => (
          <div key={c.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{(c as any).client?.name}</p>
              <p className="text-zinc-400 text-sm">
                {WEEKDAYS[c.weekday]} às {c.start_time.slice(0, 5)} · {(c as any).service?.name}
              </p>
              {c.notes && <p className="text-zinc-500 text-xs mt-1">{c.notes}</p>}
            </div>
            <button onClick={() => handleDelete(c.id)} className="text-red-400 text-sm hover:underline">
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add actions/admin/ app/\(admin\)/
git commit -m "feat: add admin services, blocks, and monthly clients pages"
```

---

## Fase 5 — Google Calendar

### Task 16: Google Calendar client e sync

**Files:**
- Create: `lib/google-calendar/client.ts`
- Create: `lib/google-calendar/events.ts`

- [ ] **Step 1: Criar lib/google-calendar/client.ts**

```typescript
import { google } from 'googleapis'

export function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  return google.calendar({ version: 'v3', auth })
}
```

- [ ] **Step 2: Criar lib/google-calendar/events.ts**

```typescript
import { getCalendarClient } from './client'
import type { Appointment } from '@/types'

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!
const TIMEZONE = process.env.BARBERSHOP_TIMEZONE ?? 'America/Sao_Paulo'

export async function syncAppointmentToCalendar(
  appointment: Appointment & {
    client?: { name: string; phone: string }
    service?: { name: string }
  }
): Promise<void> {
  const calendar = getCalendarClient()
  const admin = (await import('@/lib/supabase/admin')).createAdminClient()

  const startDateTime = `${appointment.date}T${appointment.start_time}:00`
  const endDateTime = `${appointment.date}T${appointment.end_time}:00`

  const event = {
    summary: `${appointment.service?.name ?? 'Corte'} — ${appointment.client?.name ?? 'Cliente'}`,
    description: `Telefone: ${appointment.client?.phone ?? ''}\nCódigo: ${appointment.access_code}`,
    start: { dateTime: startDateTime, timeZone: TIMEZONE },
    end: { dateTime: endDateTime, timeZone: TIMEZONE },
  }

  try {
    if (appointment.google_event_id) {
      await calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: appointment.google_event_id,
        requestBody: event,
      })
    } else {
      const { data } = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: event,
      })
      await admin
        .from('appointments')
        .update({ google_event_id: data.id, sync_status: 'synced' })
        .eq('id', appointment.id)
    }
  } catch (err) {
    await admin
      .from('appointments')
      .update({ sync_status: 'error', sync_error: String(err) })
      .eq('id', appointment.id)
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const calendar = getCalendarClient()
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId })
  } catch {
    // Falha silenciosa — evento pode já ter sido deletado
  }
}
```

- [ ] **Step 3: Verificar build completo**

```bash
npx tsc --noEmit
npm run build
```

Esperado: sem erros TypeScript, build bem-sucedido.

- [ ] **Step 4: Commit**

```bash
git add lib/google-calendar/
git commit -m "feat: add Google Calendar sync (create, update, delete events)"
```

---

## Fase 6 — Deploy

### Task 17: Tailwind CSS e globals

**Files:**
- Create: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Instalar Tailwind**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p --ts
```

- [ ] **Step 2: Configurar tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 3: Atualizar app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-size: 16px;
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-zinc-950 text-white antialiased;
  }
  * {
    @apply box-border;
  }
}
```

- [ ] **Step 4: Adicionar Inter font no layout**

Atualizar `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Davi Barber',
  description: 'Agendamento online',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts app/globals.css app/layout.tsx
git commit -m "feat: add Tailwind CSS with mobile-first dark theme"
```

---

### Task 18: Variáveis de ambiente e push para GitHub

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Garantir .env.local com todas as variáveis**

Verificar que `.env.local` contém:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_CLIENT_EMAIL=agendamento@davi-barber-496323.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=email@gmail.com
BARBERSHOP_TIMEZONE=America/Sao_Paulo
```

Preencher GOOGLE_PRIVATE_KEY copiando do arquivo `davi-barber-496323-8f76898bb5d9.json`.

- [ ] **Step 2: Verificar que .env.local não está no git**

```bash
git status
```

`.env.local` NÃO deve aparecer. Se aparecer:
```bash
git rm --cached .env.local
```

- [ ] **Step 3: Build final antes do push**

```bash
npm run build
```

Esperado: build sem erros.

- [ ] **Step 4: Push para GitHub**

```bash
git remote add origin https://github.com/vwxm/Davi-Barber.git
git push -u origin feature/admin-scheduling
```

- [ ] **Step 5: Deploy na Vercel**

1. Acessar vercel.com → New Project → importar repositório `vwxm/Davi-Barber`
2. Framework: Next.js (detectado automaticamente)
3. Adicionar variáveis de ambiente (copiar de `.env.local`)
4. Deploy

- [ ] **Step 6: Configurar domínio (opcional)**

Vercel fornece URL automática: `davi-barber-xxx.vercel.app`.

---

## Checklist Final

- [ ] `npx vitest run` — todos os testes passando
- [ ] `npm run build` — build sem erros
- [ ] `.env.local` não commitado
- [ ] JSON da service account não commitado
- [ ] Schema rodado no Supabase
- [ ] Admin criado via script
- [ ] Push para GitHub feito
- [ ] Variáveis configuradas na Vercel
