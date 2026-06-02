# Bloqueios por período + motivo visível ao cliente

**Data:** 2026-06-02
**Abordagem:** A — coluna de intervalo (`date_end`)

## Objetivo

1. Admin pode criar bloqueio de **período** (intervalo de datas), além de data única. Período = sempre dia inteiro (férias/folga).
2. Cliente vê o **motivo** quando uma data não tem horários por causa de um bloqueio dia-inteiro. Se o barbeiro não informou motivo, mostrar texto genérico explicando que não haverá atendimento.

## Modelo de dados

Migração `supabase/migrations/002_block_periods.sql`:

```sql
alter table public.schedule_blocks add column date_end date;

alter table public.schedule_blocks
  add constraint valid_period check (
    date_end is null or (date_end >= date and full_day = true)
  );
```

- `date_end` nulo → bloqueio de data única (comportamento atual, retrocompatível).
- `date_end` preenchido → bloqueio cobre `[date, date_end]`, sempre `full_day = true`.
- Bloqueio com faixa de horário (`start_time`/`end_time`) é sempre data única (`date_end` nulo).

`types/index.ts`: adicionar `date_end: string | null` em `ScheduleBlock`.

## Regra de negócio — `lib/business-rules/slots.ts`

Helper novo:

```ts
export function blockCoversDate(block: ScheduleBlock, date: string): boolean {
  return block.date <= date && (block.date_end ?? block.date) >= date
}
```

Comparação lexicográfica de `YYYY-MM-DD` é segura.

Em `getAvailableSlots`, trocar as duas comparações `b.date === date` por `blockCoversDate(b, date)`:
- bloqueio dia-inteiro: `b.active && b.full_day && blockCoversDate(b, date)` → dia sem slots.
- bloqueio parcial: `b.active && !b.full_day && b.start_time && b.end_time && blockCoversDate(b, date) && rangesOverlap(...)`.

## Server action — `actions/admin/blocks.ts`

`createBlock` ganha param opcional `date_end?: string`:
- Se `date_end` informado: força `full_day = true`; valida `date_end >= date`; ignora `start_time`/`end_time`.
- Se ausente: comportamento atual (data única, full_day ou faixa de horário).
- Validação de data passada já existe.
- Inserir `date_end: data.date_end ?? null`.

## Server action — `actions/client/appointments.ts`

`getAvailableSlotsForDate`:
- Query de bloqueios passa a pegar intervalos:
  `.eq('active', true).lte('date', date).or(\`date_end.gte.${date},and(date.eq.${date},date_end.is.null)\`)`
- Depois de calcular `slots`, achar bloqueio dia-inteiro que cobre a data (`b.full_day && blockCoversDate(b, date)`). Se existir:
  `blockReason = bloqueio.reason ?? 'Não haverá atendimento neste dia.'`
- Retorno: `{ slots?: TimeSlot[]; error?: string; blockReason?: string }`.

## UI cliente

`BookingSection`:
- Novo estado `blockReason: string | null`. Em `handleSelectDate`, setar de `result.blockReason ?? null`. Limpar nas trocas de passo.
- Passar `blockReason` ao `SlotPicker`.

`SlotPicker` (novo prop `blockReason?: string | null`):
- Se `availableCount === 0`:
  - `blockReason` presente → `<p>` âmbar com o motivo.
  - senão → texto genérico atual "Nenhum horário disponível nesta data." (caso de tudo ocupado).

## UI admin — `BloqueiosManager`

- `FormState` ganha `date_end: string`.
- Campo "Data fim (opcional)" (input `date`). Quando preenchido: período → forçar `full_day`, esconder inputs de faixa de horário.
- `handleSubmit` envia `date_end: form.date_end || undefined`.
- Lista: se `block.date_end`, mostrar `01/06 – 07/06 · Dia inteiro` (datas em BR); senão como hoje.

## Testes

`lib/business-rules/slots.test.ts`:
- Novo teste: bloqueio dia-inteiro com `date_end` cobrindo uma data no meio do intervalo → `getAvailableSlots` retorna `[]`.
- Teste: bloqueio de data única (`date_end` null) continua funcionando (regressão).

## Fora de escopo

- Bloqueio com faixa de horário repetida em vários dias (decidido: não).
- Filtrar datas bloqueadas do `DatePicker` (mantém visível pra mostrar o motivo).
- Editar bloqueio (continua criar/remover).
