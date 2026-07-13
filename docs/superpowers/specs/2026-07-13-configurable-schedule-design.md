# Grade de horários configurável + janela semanal — Design

Data: 2026-07-13
Status: aprovado pelo usuário (conversa de 2026-07-13)

## Contexto

Pedidos do barbeiro (cliente do app):

1. Clientes só podem agendar dentro da **semana corrente** (segunda a sábado). A
   semana seguinte abre apenas na segunda-feira dela.
2. O expediente passa a ser um **horário fixo editável** pelo admin (inicial:
   10:00–20:00, sem pausa de almoço fixa).
3. O admin pode **ajustar a grade de um dia específico** (qualquer dia da
   semana, não só domingo): mudar abertura/fechamento daquele dia e bloquear
   faixas, sem afetar os demais dias.
4. **Antecedência mínima** para agendamento de cliente: um horário só pode ser
   escolhido até N minutos antes (inicial: 60). Ex.: o slot das 20:00 some da
   lista às 19:01.

Hoje o expediente é a constante `BUSINESS_HOURS` (09:00–19:00, almoço
12:00–13:00) em `lib/business-rules/slots.ts`, a janela é `BOOKING_WEEKS = 2`
em `lib/business-rules/booking-window.ts`, e bloqueios por dia/faixa já
funcionam via tabela `schedule_blocks` (a restrição "só no domingo" do README
nunca foi implementada e deixa de valer).

## Não-objetivos

- Encaixes avulsos fora da grade de 30 min (decidido: só abertura/fechamento
  por dia).
- Abrir domingos (continuam fechados, override não pode criar grade no domingo).
- Alterar agendamentos existentes que ficarem fora da nova grade (continuam
  válidos).
- Múltiplos barbeiros.

## Modelo de dados (migration 008)

### `settings` — singleton

| coluna            | tipo    | inicial |
|-------------------|---------|---------|
| `id`              | int PK, `check (id = 1)` | 1 |
| `open_time`       | time    | 10:00 |
| `close_time`      | time    | 20:00 |
| `min_lead_minutes`| int, `check (>= 0 and <= 1440)` | 60 |
| `updated_at`      | timestamptz | now() |

Constraint: `close_time > open_time`. Seed na própria migration.

### `day_overrides`

| coluna       | tipo |
|--------------|------|
| `id`         | uuid PK |
| `date`       | date, **unique** |
| `open_time`  | time |
| `close_time` | time |
| `created_at` / `updated_at` | timestamptz |

Constraint: `close_time > open_time`. Sem coluna `active`: remover o ajuste =
`delete` (o dia volta ao padrão).

### RLS

Ambas com RLS ligado e **sem políticas públicas** — leitura e escrita apenas
pelas server actions com service role, como nas demais tabelas do projeto.

## Regras de negócio

### Horário efetivo de um dia

`effectiveHours(date) = day_overrides[date] ?? settings` → `{ start, end }`.
Domingo nunca tem grade (`closedWeekdays = [0]` continua).

### Motor de slots (`lib/business-rules/slots.ts`)

- `getAvailableSlots(date, durationMinutes, appointments, blocks, nowISO,
  hours, minLeadMinutes)` — `hours` é o horário efetivo do dia;
  `BUSINESS_HOURS.start/end/breaks` deixam de existir (o `slotMinutes = 30` e
  `closedWeekdays = [0]` permanecem como constantes).
- Pausa de almoço: removida (breaks = nenhum). Barbeiro usa bloqueio.
- Antecedência: para o dia de hoje, um slot só aparece se
  `slotStart >= agora + minLeadMinutes` (antes era `slotStart > agora`).
  Vale para **clientes** (agendar e reagendar). Não vale para admin.

### Janela de agendamento (`lib/business-rules/booking-window.ts`)

- `BOOKING_WEEKS = 1`.
- Domingo: janela **vazia** (hoje o código pula para a segunda seguinte).
  O cliente vê a mensagem: *"A agenda da próxima semana abre segunda-feira."*
- Demais dias: de hoje até o sábado da semana corrente.

### Validações do admin

- Encaixe avulso (`actions/admin/appointments.ts`) e mensal
  (`actions/admin/monthly-appointments.ts`): validar contra o **horário
  efetivo do dia** em vez da constante. Sem exigência de antecedência.
- Materialização de mensalistas (`lib/monthly/ensure.ts`): **não** valida
  grade — mensalista entra no horário fixo dele mesmo fora do expediente do
  dia; ajuste manual se preciso.

## Server actions novas (`actions/admin/schedule.ts`)

- `updateSettings({ open_time, close_time, min_lead_minutes })` — valida
  close > open, lead 0–1440, horários em passos de 30 min.
- `upsertDayOverride({ date, open_time, close_time })` — valida data ≥ hoje,
  não-domingo, close > open, passos de 30 min.
- `removeDayOverride(date)`.
- Todas com `requireAdmin()` e `revalidatePath` das páginas afetadas.

## UI

### Admin — página "Horários" — REVISÃO 2026-07-13 (feedback do barbeiro)

O ajuste por dia NÃO usa inputs de data/hora digitados. É visual, igual à
grade do cliente:

- **Botões de dia** (como o cliente vê): semana atual + próxima (seg–sáb,
  12 botões).
- **Grade de slots em retângulos** (06:00–23:30, passos de 30 min) para o
  dia selecionado, com 4 estados:
  - **aberto** (âmbar) — dentro do expediente, livre → tocar **bloqueia**
    (cria bloqueio de 30 min);
  - **bloqueado** (vermelho) — tocar **reabre** (desativa o bloqueio; se o
    slot fizer parte de um bloqueio de faixa do mesmo dia, o bloqueio é
    dividido nos demais slots; bloqueios de dia inteiro/período não são
    tocáveis — remover na lista);
  - **fechado** (cinza) — fora do expediente → tocar **adiciona** (estende
    a abertura/fechamento do dia via override; os slots do "vão" entre o
    expediente antigo e o novo slot entram bloqueados para não abrir hora
    que o barbeiro não pediu);
  - **ocupado** — tem cliente agendado; travado.
- O card "Horário padrão" (selects) e a lista de Bloqueios (dia inteiro,
  período/férias) continuam.

A seção abaixo descreve a versão 1 (obsoleta na parte do "Ajustes por dia"):

### Admin — página "Horários" (evolução de `/admin/bloqueios`) — v1

- Rota nova `/admin/horarios`; `/admin/bloqueios` redireciona para ela. Item
  do menu: "Horários" (substitui "Bloqueios") em
  `components/admin/nav-items.ts`.
- **Card "Horário padrão"**: abertura, fechamento (selects em passos de 30
  min), antecedência mínima (minutos), botão Salvar.
- **Card "Ajustes por dia"**: seletor de data (seg–sáb, ≥ hoje) →
  - mostra horário efetivo do dia e se vem de ajuste ou do padrão;
  - form abertura/fechamento para criar/editar o ajuste do dia;
  - botão "Remover ajuste" (volta ao padrão);
  - bloqueios daquele dia: lista + criação com a data pré-preenchida (reusa
    os componentes/ações de bloqueio existentes).
- A criação de bloqueio por período (intervalo de datas, ex.: férias)
  continua disponível na mesma página.

### Cliente

- Fluxo inalterado. Datas ofertadas = janela semanal nova; horários =
  grade efetiva − bloqueios − ocupados − antecedência.
- Domingo: no lugar da lista de datas, mensagem
  *"A agenda da próxima semana abre segunda-feira."*

## Casos de borda

- **Agendamento existente fora da nova grade** (ex.: 09:30 marcado antes da
  mudança): permanece válido e visível na agenda do admin; a grade só governa
  ofertas novas.
- **Override menor que o padrão** (ex.: fechar 17:00 na sexta): slots após
  17:00 somem; agendamentos já feitos depois disso permanecem (admin decide
  remarcar/cancelar manualmente).
- **Cliente com a tela aberta** escolhe slot que acabou de sair da janela de
  antecedência: a server action de criação revalida e recusa com mensagem
  clara (mesmo mecanismo atual de conflito).
- **Sábado 23:59 → domingo**: janela zera; domingo mostra a mensagem.
- **Reagendamento de cliente** obedece às mesmas regras (janela + antecedência
  + grade efetiva).

## Testes

### Unitários (vitest)

- `slots.test.ts`: horário efetivo via parâmetro; antecedência (60 min corta
  slot das 20:00 às 19:01; lead 0 mantém comportamento antigo); sem pausa de
  almoço; override reduzindo/estendendo o dia.
- `booking-window.test.ts`: semana única; domingo → janela vazia; sábado
  inclui só o próprio sábado.
- Validações das novas actions (passos de 30 min, close > open, domingo
  proibido em override).

### E2E (Playwright)

- Admin: salvar horário padrão novo → ajustar um dia específico → criar
  bloqueio nesse dia → grade do dia reflete tudo.
- Cliente: vê apenas dias da semana corrente; horários respeitam o padrão
  10:00–20:00.

## Rollout

1. Migration 008 aplicada no Supabase (MCP `apply_migration`) + arquivo em
   `supabase/migrations/`.
2. Deploy manual `npx vercel --prod` (sem auto-deploy — ver memória do
   projeto).
3. Pós-deploy: conferir página Horários em produção e grade do cliente.
4. Follow-up fora deste escopo: atualizar o Manual do Admin (PDF) com a
   página Horários.
