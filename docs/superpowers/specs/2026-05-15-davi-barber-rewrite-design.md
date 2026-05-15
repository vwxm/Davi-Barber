# Davi Barber — Reescrita Total

**Data:** 2026-05-15  
**Branch:** feature/admin-scheduling  
**Decisão:** Reescrita completa (Opção B)

---

## 1. Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript |
| Banco | Supabase (Postgres) |
| Auth | Supabase Auth |
| Estilo | Tailwind CSS (mobile-first) |
| Integração | Google Calendar API (service account) |
| Deploy | Vercel |

---

## 2. Estrutura de Pastas

```
/app
  /(client)
    /layout.tsx          ← layout mobile (bottom nav)
    /page.tsx            ← agendar horário
    /agendamentos/
      /page.tsx          ← meus agendamentos
    /perfil/
      /page.tsx          ← telefone, nome, senha
    /login/
      /page.tsx          ← telefone + senha
    /cadastro/
      /page.tsx          ← nome + telefone + senha
  /(admin)
    /layout.tsx          ← layout com sidebar
    /page.tsx            ← dashboard / agenda do dia
    /agenda/
      /page.tsx          ← agenda mensal
    /clientes/
      /page.tsx          ← clientes mensais
    /servicos/
      /page.tsx          ← catálogo de serviços
    /bloqueios/
      /page.tsx          ← bloqueios de agenda
    /login/
      /page.tsx          ← login admin
  /api/
    /google-calendar/
      /sync/route.ts     ← sync de eventos

/components
  /client/
    /BookingForm.tsx
    /AppointmentCard.tsx
    /SlotPicker.tsx
    /BottomNav.tsx
  /admin/
    /AgendaView.tsx
    /AppointmentTable.tsx
    /MonthlyClientForm.tsx
    /BlockForm.tsx
    /ServiceForm.tsx
    /Sidebar.tsx
  /ui/
    /Button.tsx
    /Input.tsx
    /Modal.tsx
    /Toast.tsx
    /Card.tsx

/lib
  /supabase/
    /client.ts           ← browser client
    /server.ts           ← server component client
    /admin.ts            ← service role client (server only)
  /google-calendar/
    /client.ts
    /events.ts
  /business-rules/
    /slots.ts
    /booking-window.ts
    /phone.ts

/actions
  /client/
    /auth.ts             ← register, login, logout
    /appointments.ts     ← book, cancel, reschedule
  /admin/
    /appointments.ts
    /monthly-clients.ts
    /services.ts
    /blocks.ts

/types
  /index.ts              ← todos os tipos centralizados

/middleware.ts            ← proteção de rotas
```

---

## 3. Banco de Dados

### Tabelas

```sql
-- clients: sincronizado com auth.users
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

-- monthly_clients
create table public.monthly_clients (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid unique not null references public.clients(id),
  service_id  uuid not null references public.services(id),
  weekday     integer not null check (weekday between 0 and 6),
  start_time  time not null,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

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
    full_day = true or (start_time is not null and end_time is not null and end_time > start_time)
  )
);
```

### Trigger: sync clients com auth.users

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
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
```

### RLS Policies

```sql
-- clients
alter table public.clients enable row level security;
create policy "client sees own record"
  on public.clients for select using (auth.uid() = id);
create policy "client updates own record"
  on public.clients for update using (auth.uid() = id);
create policy "admin full access"
  on public.clients for all using (
    (auth.jwt()->>'role') = 'admin'
  );

-- appointments
alter table public.appointments enable row level security;
create policy "client sees own appointments"
  on public.appointments for select using (client_id = auth.uid());
create policy "client inserts own appointments"
  on public.appointments for insert with check (client_id = auth.uid());
create policy "client cancels own appointments"
  on public.appointments for update using (client_id = auth.uid());
create policy "admin full access"
  on public.appointments for all using (
    (auth.jwt()->>'role') = 'admin'
  );

-- services (leitura pública, escrita só admin)
alter table public.services enable row level security;
create policy "public read" on public.services for select using (true);
create policy "admin write" on public.services for all using (
  (auth.jwt()->>'role') = 'admin'
);

-- schedule_blocks (leitura pública, escrita só admin)
alter table public.schedule_blocks enable row level security;
create policy "public read" on public.schedule_blocks for select using (true);
create policy "admin write" on public.schedule_blocks for all using (
  (auth.jwt()->>'role') = 'admin'
);

-- monthly_clients (só admin)
alter table public.monthly_clients enable row level security;
create policy "admin full access" on public.monthly_clients for all using (
  (auth.jwt()->>'role') = 'admin'
);
```

---

## 4. Auth

### Cliente (telefone + senha)

- UI: campos `Telefone` + `Senha`
- Internamente: `phone.replace(/\D/g, '') + '@davibarber.app'` como email no Supabase Auth
- Registro: `supabase.auth.signUp({ email, password, options: { data: { name, phone } } })`
- Trigger cria registro em `public.clients` automaticamente
- Sessão: JWT em cookie httpOnly via `@supabase/ssr`

### Admin

- Criado manualmente: Supabase Dashboard → Authentication → Users
- `user_metadata.role = 'admin'` definido via `supabase.auth.admin.updateUserById()`
- Login igual ao cliente (email + senha normal)
- Middleware verifica `role === 'admin'` no JWT

### Middleware

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)
  const { data: { session } } = await supabase.auth.getSession()

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isClientRoute = request.nextUrl.pathname.startsWith('/agendamentos')

  if (isAdminRoute) {
    if (!session) return redirect('/admin/login')
    if (session.user.user_metadata.role !== 'admin') return redirect('/')
  }

  if (isClientRoute && !session) {
    return redirect('/login')
  }

  return response
}
```

---

## 5. Server Actions

Todas as mutações via Server Actions (`'use server'`) — sem API routes intermediárias.

### Exemplos

```typescript
// actions/client/appointments.ts
'use server'
export async function bookAppointment(data: BookingInput) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // validar slot disponível, inserir, sync Google Calendar
}

// actions/admin/appointments.ts
'use server'
export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const supabase = createServerClient()
  // verificar role admin via JWT, atualizar
}
```

---

## 6. Mobile-First (Cliente)

### Layout

```
┌─────────────────────────┐
│  Davi Barber            │  ← header fixo
├─────────────────────────┤
│                         │
│   [conteúdo da página]  │
│                         │
│                         │
├─────────────────────────┤
│  🏠 Inicio  📅 Agenda  👤│  ← bottom nav fixo
└─────────────────────────┘
```

- Fonte mínima 16px (sem zoom involuntário em iOS)
- Inputs com `min-h-[44px]` (touch target mínimo)
- Bottom navigation fixa: Agendar / Agendamentos / Perfil
- Sem tabelas — tudo em cards
- Scroll vertical simples

### Flow de agendamento (cliente)

```
1. Seleciona serviço     → cards horizontais com scroll
2. Seleciona data        → calendário simples (Mon-Sat, semana atual)
3. Seleciona horário     → grid de slots disponíveis
4. Confirma              → exibe código de acesso + botão copiar
```

---

## 7. Google Calendar

- Mantém service account
- Secrets **nunca commitados** — somente em variáveis de ambiente Vercel
- `.env.local` adicionado ao `.gitignore`
- Chave privada atual: **revogar no Google Cloud Console e gerar nova**
- Sync assíncrono: falha no Calendar não bloqueia agendamento

---

## 8. Limpeza do Projeto Atual

Arquivos a deletar na reescrita:
- `app.js`, `index.html`, `styles.css` (legado pré-Next.js)
- `supabase-config.js` (placeholder vazio)
- `supabase-schema.sql` (substituído por migrations)
- `/lib/accessCode.js`, `/lib/api.js`, `/lib/clientAuth.js` (substituídos por Supabase Auth)
- `/app/api/client/*` (substituídos por Server Actions)
- Todos os arquivos `.js` na pasta `/lib` (migrados pra TypeScript)

---

## 9. O Que NÃO Muda

- Regras de negócio: horário 09:00–19:00, break 12:00–13:00, domingo fechado
- Timezone: `America/Sao_Paulo`
- Serviços seed: Corte, Barba, Corte+Barba, Corte+Penteado
- Janela de agendamento cliente: semana corrente (Seg–Sáb)
- Lógica de clientes mensais (corrigida)
- Google Calendar sync

---

## 10. Fluxos Corrigidos

### Bug 1 — ID do cliente
**Antes:** `id: phone` (quebra FK com UUID)  
**Depois:** `id` = `auth.users.id` via trigger automático

### Bug 2 — access_code duplicado
**Antes:** sem UNIQUE constraint  
**Depois:** `access_code text not null unique`

### Bug 3 — RLS sem policies
**Antes:** RLS habilitado mas sem nenhuma policy (bloqueia tudo)  
**Depois:** policies definidas para todos os casos

### Bug 4 — Monthly client deletion
**Antes:** `!appointment.monthly_client_id || appointment.monthly_client_id === id` (apagava appointments de outros)  
**Depois:** `appointment.monthly_client_id === id` apenas

### Bug 5 — Secrets no git
**Antes:** `.env.local` commitado com chave Google privada  
**Depois:** `.gitignore` correto + chave revogada e rotacionada
