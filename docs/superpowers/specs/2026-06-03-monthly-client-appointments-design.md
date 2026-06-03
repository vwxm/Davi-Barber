# Mensalistas: materialização semanal + override pontual

**Data:** 2026-06-03

## Objetivo

Cliente mensalista (`monthly_clients`: weekday + horário + serviço) hoje é só template — não gera agendamentos. Precisa:

1. Aparecer como `appointment` real toda semana (cliente vê, dashboard conta, slot bloqueia, sincroniza no Calendar).
2. Horário fixo bloqueado pros outros clientes.
3. Suportar troca pontual numa semana (ex.: sexta → quarta só naquela semana), sem afetar a recorrência.

## Decisões

- **Recorrência:** geração sob demanda da semana atual (sem cron). Auto-curativa.
- **Conflito:** horário do mensalista bloqueia os outros via materialização; se já houver agendamento normal naquele slot, pula a geração e avisa o admin.
- **Override:** a linha `appointments` materializada É o ponto de edição. Mover a linha = troca pontual. Template intacto → semana seguinte volta ao normal.

## Modelo de dados

Migração `supabase/migrations/003_monthly_appointments.sql`:

```sql
alter table public.appointments add column if not exists week_start date;

create unique index if not exists appointments_monthly_week_uniq
  on public.appointments (monthly_client_id, week_start)
  where monthly_client_id is not null;
```

- `week_start` = segunda-feira da semana da ocorrência (só preenchido em linhas geradas de mensalista).
- Índice único `(monthly_client_id, week_start)` → no máximo uma linha por mensalista por semana; dedup idempotente e à prova de corrida. Mover a data dentro da semana **não** dispara nova geração (week_start não muda).

`types/index.ts`: `Appointment.week_start: string | null`.

## Lógica pura — `lib/business-rules/monthly.ts`

```ts
// Segunda-feira da semana atual, 'YYYY-MM-DD', no fuso do negócio.
export function currentWeekMonday(nowISO: string): string

// Data ('YYYY-MM-DD') do weekday (0=Dom..6=Sáb) na semana atual.
export function weekdayDateInCurrentWeek(weekday: number, nowISO: string): string
```

Testes em `monthly.test.ts` cobrindo: segunda no meio da semana, domingo, virada de mês.

## Geração — `lib/monthly/ensure.ts` (server-only, service role)

`ensureCurrentWeekMonthlyAppointments(): Promise<{ generated: number; conflicts: string[] }>`

Idempotente. Passos:
1. `weekMonday = currentWeekMonday(now)`; `today = hoje (BR)`.
2. Busca `monthly_clients` ativos (+ `service:duration_minutes`).
3. Pra cada mensalista:
   - `date = weekdayDateInCurrentWeek(mc.weekday, now)`. Se `date < today` → pula (ocorrência da semana já passou).
   - Já existe linha `(monthly_client_id = mc.id, week_start = weekMonday)`? → pula.
   - `end_time = start + duration`. Conflito: existe `appointment` scheduled em `date` que sobrepõe `[start,end]` com `monthly_client_id` diferente? → pula + adiciona aviso a `conflicts`.
   - Insere: `client_id, service_id, date, start_time, end_time, status='scheduled', access_code (crypto), monthly_client_id=mc.id, week_start=weekMonday`. `onConflict` no índice → ignora corrida.
   - `await syncAppointmentEvent(novoId)` (swallow erro).
4. Retorna resumo.

Chamada (try/catch, nunca quebra a página) no início de: `getAvailableSlotsForDate`, `bookAppointment`, dashboard admin (`/admin`), `/agendamentos` cliente, `/mensais`.

## Bloqueio de slot

Sem mudança em `slots.ts`. Como `ensure` materializa antes de qualquer leitura de slot, a própria linha `appointments` bloqueia via o conflito já existente. Override (mover a linha) move o bloqueio junto, de graça.

## `actions/admin/monthly-clients.ts`

- `createMonthlyClient`: rejeita `weekday === 0` ("Domingo não tem atendimento."). Após criar/reativar, chama `ensureCurrentWeekMonthlyAppointments()` (para aparecer já nesta semana).
- `deactivateMonthlyClient`: antes de `active=false`, busca appointments gerados (`monthly_client_id = id`, `date >= hoje`, `status='scheduled'`); deleta evento no Calendar e remove as linhas. Depois desativa o template.

## Override — `actions/admin/monthly-appointments.ts`

`rescheduleMonthlyAppointment(appointmentId, newDate, newStartTime): Promise<{ error?: string }>`

- `requireAdmin`.
- Busca appointment (precisa ter `monthly_client_id`, `status='scheduled'`).
- Valida `currentWeekMonday(newDate) === appointment.week_start` (mesma semana). Senão → erro.
- Valida `newDate` não domingo, dentro do horário comercial.
- `end_time` recalculado pela duração do serviço.
- Conflito no novo slot (excluindo a própria linha) → erro.
- Atualiza `date, start_time, end_time`; mantém `week_start`, `monthly_client_id`.
- Re-sync Calendar (`syncAppointmentEvent` faz patch, pois `google_event_id` existe).

## UI admin — `/mensais`

- `app/(admin)/admin/mensais/page.tsx`: chama `ensure`, busca os appointments desta semana de mensalistas (`monthly_client_id not null`, `week_start = weekMonday`), monta mapa `{ monthly_client_id → appointment }`, passa ao `MensaisManager`.
- `MensaisManager`: cada card de mensalista ativo com appointment desta semana ganha botão "Trocar esta semana" → form inline (select dia Seg–Sáb da semana + horário) → `rescheduleMonthlyAppointment(appt.id, novaData, horario)`. Atualiza UI com o novo dia/horário. Sem appointment nesta semana (ocorrência passou) → botão oculto.

## Testes

- `lib/business-rules/monthly.test.ts`: `currentWeekMonday`, `weekdayDateInCurrentWeek`.
- Geração e override: verificação contra o banco real (insert/rollback) durante a implementação.

## Fora de escopo

- Cron real / geração além da semana atual.
- Mover ocorrência para outra semana (override é só dentro da semana).
- Agenda semanal de arrastar-e-soltar (recomendação separada).
- Cobrança/pagamento do mensalista.
