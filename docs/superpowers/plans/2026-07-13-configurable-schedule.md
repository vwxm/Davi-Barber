# Configurable Schedule + Weekly Booking Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-editable business hours (default 10:00–20:00) with per-day overrides, a 60-minute client booking lead time, and a booking window restricted to the current week (Sundays show a "opens Monday" message).

**Architecture:** Two new tables (`settings` singleton + `day_overrides`) read server-side by a small `lib/schedule` access layer. The slot engine receives effective hours and lead time as parameters instead of the hardcoded `BUSINESS_HOURS`. The admin "Bloqueios" page becomes "Horários" (default hours card + per-day adjustment card + existing blocks).

**Tech Stack:** Next.js server actions, Supabase (service role), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-13-configurable-schedule-design.md`

## Global Constraints

- Timezone: all "today" math uses `America/Sao_Paulo` via `toLocaleDateString('en-CA', { timeZone: TIMEZONE })` (existing pattern).
- Time inputs restricted to 30-minute steps (`HH:00` / `HH:30`).
- Sundays stay closed; overrides cannot open a Sunday.
- Lead time applies to CLIENTS only (book + reschedule), never to admin actions.
- Existing appointments outside the new grid remain valid — grid governs only new offers.
- Portuguese UI copy exactly as written in tasks.
- Commit messages follow repo style (`feat:`/`fix:`/`test:` prefix + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`).
- The e2e suite writes to the live Supabase project; keep test data under existing cleanup prefixes (`119000000*` phones, guest names `E2E%`).

---

### Task 1: Migration + types (settings, day_overrides)

**Files:**
- Create: `supabase/migrations/008_settings_day_overrides.sql`
- Modify: `types/index.ts` (append)

**Interfaces:**
- Produces: SQL tables `settings` (singleton row id=1) and `day_overrides`; TS types `ScheduleSettings`, `DayOverride`.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/008_settings_day_overrides.sql
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
```

- [ ] **Step 2: Append types**

```ts
// types/index.ts (append at end)
export interface ScheduleSettings {
  id: number
  open_time: string       // 'HH:MM'
  close_time: string      // 'HH:MM'
  min_lead_minutes: number
  updated_at: string
}

export interface DayOverride {
  id: string
  date: string            // 'YYYY-MM-DD'
  open_time: string       // 'HH:MM'
  close_time: string      // 'HH:MM'
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Apply migration to the Supabase project**

The MCP `apply_migration` tool is only available to the main session (may
require the user's approval). If you are a subagent, STOP and report that the
migration file is ready; the orchestrator applies it with:
name `settings_day_overrides`, query = file content. Verify afterwards with
`select * from settings` → one row `10:00 / 20:00 / 60`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_settings_day_overrides.sql types/index.ts
git commit -m "feat: settings and day_overrides tables for configurable schedule"
```

---

### Task 2: Slot engine takes effective hours + lead time

**Files:**
- Modify: `lib/business-rules/slots.ts`
- Test: `lib/business-rules/slots.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export interface EffectiveHours { start: string; end: string }`
  - `export const SLOT_MINUTES = 30`
  - `export const CLOSED_WEEKDAYS = [0]`
  - `getAvailableSlots(date: string, durationMinutes: number, appointments: Appointment[], blocks: ScheduleBlock[], nowISO: string, hours: EffectiveHours, minLeadMinutes?: number): TimeSlot[]` (lead defaults to 0)
  - `BUSINESS_HOURS` is DELETED. `timeToMinutes`, `minutesToTime`, `blockCoversDate`, `TIMEZONE` unchanged.

Note: `types/index.ts` keeps `BusinessHours` unused by slots.ts — remove that interface as part of this task (nothing else imports it; verify with grep).

- [ ] **Step 1: Rewrite the tests** — replace every `getAvailableSlots(date, 30, [], [], nowISO)` call with the new signature and add lead/hours cases. Full new test file:

```ts
import { describe, it, expect } from 'vitest'
import { getAvailableSlots, timeToMinutes, minutesToTime, type EffectiveHours } from './slots'
import type { Appointment, ScheduleBlock } from '@/types'

const HOURS: EffectiveHours = { start: '10:00', end: '20:00' }

// A weekday far in the future (Friday) and a "now" long before it.
const future = '2027-01-15' // Friday
const sunday = '2027-01-17'
const nowISO = '2026-12-01T12:00:00-03:00'

function appt(partial: Partial<Appointment>): Appointment {
  return {
    id: 'a', client_id: 'c', service_id: 's', date: future,
    start_time: '10:00', end_time: '10:30', status: 'scheduled',
    access_code: 'X', monthly_client_id: null, week_start: null,
    google_event_id: null, sync_status: 'pending', sync_error: null,
    created_at: '', updated_at: '', ...partial,
  } as Appointment
}

describe('timeToMinutes / minutesToTime', () => {
  it('converts 09:30 to 570', () => expect(timeToMinutes('09:30')).toBe(570))
  it('converts 570 to 09:30', () => expect(minutesToTime(570)).toBe('09:30'))
})

describe('getAvailableSlots', () => {
  it('generates 30-min slots across the effective hours with no lunch break', () => {
    const slots = getAvailableSlots(future, 30, [], [], nowISO, HOURS)
    expect(slots[0].start).toBe('10:00')
    expect(slots[slots.length - 1].start).toBe('19:30')
    expect(slots).toHaveLength(20) // 10h..20h = 10h * 2
    // 12:00 and 12:30 exist (no fixed lunch break anymore)
    expect(slots.some(s => s.start === '12:00')).toBe(true)
  })

  it('respects per-day hours (override shape)', () => {
    const slots = getAvailableSlots(future, 30, [], [], nowISO, { start: '09:00', end: '21:00' })
    expect(slots[0].start).toBe('09:00')
    expect(slots[slots.length - 1].start).toBe('20:30')
  })

  it('returns [] on Sundays', () => {
    expect(getAvailableSlots(sunday, 30, [], [], nowISO, HOURS)).toHaveLength(0)
  })

  it('marks conflicting slots unavailable', () => {
    const slots = getAvailableSlots(future, 30, [appt({ start_time: '10:00', end_time: '10:30' })], [], nowISO, HOURS)
    expect(slots.find(s => s.start === '10:00')!.available).toBe(false)
    expect(slots.find(s => s.start === '10:30')!.available).toBe(true)
  })

  it('long services need room before close', () => {
    const slots = getAvailableSlots(future, 60, [], [], nowISO, HOURS)
    expect(slots[slots.length - 1].start).toBe('19:00')
  })

  it('full-day block removes all slots', () => {
    const block: ScheduleBlock = {
      id: 'b', date: future, date_end: null, full_day: true,
      start_time: null, end_time: null, reason: null, active: true,
      created_at: '', updated_at: '',
    }
    expect(getAvailableSlots(future, 30, [], [block], nowISO, HOURS)).toHaveLength(0)
  })

  it('time-range block removes overlapping slots only', () => {
    const block: ScheduleBlock = {
      id: 'b', date: future, date_end: null, full_day: false,
      start_time: '10:00', end_time: '11:00', reason: null, active: true,
      created_at: '', updated_at: '',
    }
    const slots = getAvailableSlots(future, 30, [], [block], nowISO, HOURS)
    expect(slots.some(s => s.start === '10:00')).toBe(false)
    expect(slots.some(s => s.start === '10:30')).toBe(false)
    expect(slots.some(s => s.start === '11:00')).toBe(true)
  })

  describe('lead time (same-day)', () => {
    // "now" = 19:01 São Paulo on the slot date
    const todayISO = '2027-01-15T19:01:00-03:00'

    it('lead 60: the 20:00 slot disappears at 19:01', () => {
      const slots = getAvailableSlots(future, 30, [], [], todayISO, { start: '10:00', end: '20:30' }, 60)
      expect(slots.some(s => s.start === '20:00')).toBe(false)
    })

    it('lead 60: a slot exactly 60+ min away stays', () => {
      // now 19:01 + 60 = 20:01 -> 20:30 slot stays (hours end extended for the test)
      const slots = getAvailableSlots(future, 30, [], [], todayISO, { start: '10:00', end: '21:00' }, 60)
      expect(slots.some(s => s.start === '20:30')).toBe(true)
    })

    it('lead 0 keeps the old behavior (only past slots cut)', () => {
      const slots = getAvailableSlots(future, 30, [], [], todayISO, { start: '10:00', end: '20:30' }, 0)
      expect(slots.some(s => s.start === '20:00')).toBe(true)
      expect(slots.some(s => s.start === '19:00')).toBe(false)
    })

    it('lead does not affect future dates', () => {
      const slots = getAvailableSlots(future, 30, [], [], nowISO, HOURS, 60)
      expect(slots[0].start).toBe('10:00')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/business-rules/slots.test.ts`
Expected: FAIL (wrong argument count / BUSINESS_HOURS still hardcoded).

- [ ] **Step 3: Implement**

Replace in `lib/business-rules/slots.ts`:

```ts
import type { Appointment, ScheduleBlock, TimeSlot } from '@/types'

export interface EffectiveHours {
  start: string // 'HH:MM'
  end: string   // 'HH:MM'
}

export const SLOT_MINUTES = 30
export const CLOSED_WEEKDAYS = [0] // domingo

export const TIMEZONE = process.env.BARBERSHOP_TIMEZONE ?? 'America/Sao_Paulo'
```

(keep `timeToMinutes`, `minutesToTime`, `rangesOverlap`, `blockCoversDate` as-is)

```ts
export function getAvailableSlots(
  date: string,
  durationMinutes: number,
  appointments: Appointment[],
  blocks: ScheduleBlock[],
  nowISO: string,
  hours: EffectiveHours,
  minLeadMinutes = 0,
): TimeSlot[] {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay()
  if (CLOSED_WEEKDAYS.includes(weekday)) return []

  const fullDayBlock = blocks.find(b => b.active && b.full_day && blockCoversDate(b, date))
  if (fullDayBlock) return []

  const startMin = timeToMinutes(hours.start)
  const endMin = timeToMinutes(hours.end)
  const slots: TimeSlot[] = []

  const now = new Date(nowISO)
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  const isToday = date === todayStr
  const nowMinutes = isToday
    ? (() => {
        const t = now.toLocaleTimeString('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' })
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      })()
    : 0

  for (let t = startMin; t + durationMinutes <= endMin; t += SLOT_MINUTES) {
    const slotStart = minutesToTime(t)
    const slotEnd = minutesToTime(t + durationMinutes)

    // Same-day: slot must start at least minLeadMinutes from now
    // (minLeadMinutes = 0 preserves "no past slots").
    if (isToday && t < nowMinutes + minLeadMinutes) continue
    if (isToday && minLeadMinutes === 0 && t <= nowMinutes) continue

    const blockedByBlock = blocks.some(b =>
      b.active && !b.full_day &&
      b.start_time && b.end_time &&
      blockCoversDate(b, date) &&
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

Also delete the `BusinessHours` interface from `types/index.ts` (grep first:
`BusinessHours` must have no remaining consumers).

Note: `actions/admin/appointments.ts` and `actions/admin/monthly-appointments.ts`
still import `BUSINESS_HOURS` and will break the typecheck. Fix them in THIS
task with a minimal temporary shim so the repo stays green: replace
`BUSINESS_HOURS.closedWeekdays` with `CLOSED_WEEKDAYS` and
`BUSINESS_HOURS.start/end` with the literal `'10:00'`/`'20:00'` plus a
`// TODO(task-6): use getEffectiveHours` comment. Task 6 replaces the shim.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run lib/business-rules/slots.test.ts` → PASS
Run: `npx tsc --noEmit` → no errors

- [ ] **Step 5: Commit**

```bash
git add lib/business-rules/slots.ts lib/business-rules/slots.test.ts types/index.ts actions/admin/appointments.ts actions/admin/monthly-appointments.ts
git commit -m "feat: slot engine takes effective hours and client lead time"
```

---

### Task 3: Booking window = current week; Sunday empty

**Files:**
- Modify: `lib/business-rules/booking-window.ts`
- Test: `lib/business-rules/booking-window.test.ts`
- Modify: `app/(client)/agendar/page.tsx`

**Interfaces:**
- Produces:
  - `getClientBookingWindow(nowISO?): BookingWindow | null` — **null on Sundays**.
  - `getBookingWeekDates(nowISO?): string[]` — `[]` on Sundays.
  - `isDateInBookingWindow(dateStr, nowISO?): boolean` — always false on Sundays.
  - `BOOKING_WEEKS = 1`.

- [ ] **Step 1: Update tests** — adjust existing cases to one week and add Sunday cases:

```ts
// key new/changed cases in lib/business-rules/booking-window.test.ts
it('window covers only the current week (Mon..Sat)', () => {
  // Wednesday 2027-01-13 12:00 SP
  const w = getClientBookingWindow('2027-01-13T12:00:00-03:00')!
  expect(w.start).toBe('2027-01-13')
  expect(w.end).toBe('2027-01-16') // Saturday same week
})

it('Sunday has no window', () => {
  expect(getClientBookingWindow('2027-01-17T10:00:00-03:00')).toBeNull()
  expect(getBookingWeekDates('2027-01-17T10:00:00-03:00')).toEqual([])
  expect(isDateInBookingWindow('2027-01-18', '2027-01-17T10:00:00-03:00')).toBe(false)
})

it('Saturday window is just Saturday', () => {
  const w = getClientBookingWindow('2027-01-16T09:00:00-03:00')!
  expect(w.start).toBe('2027-01-16')
  expect(w.end).toBe('2027-01-16')
})
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run lib/business-rules/booking-window.test.ts` → FAIL

- [ ] **Step 3: Implement**

```ts
export const BOOKING_WEEKS = 1

export function getClientBookingWindow(nowISO?: string): BookingWindow | null {
  const today = todayStr(nowISO)
  const dow = weekdayOf(today) // 0=Sun
  if (dow === 0) return null // agenda da próxima semana abre segunda

  const monday = addDays(today, 1 - dow)
  const end = addDays(monday, 5 + (BOOKING_WEEKS - 1) * 7)
  const start = today > monday ? today : monday
  return { start, end }
}

export function isDateInBookingWindow(dateStr: string, nowISO?: string): boolean {
  const w = getClientBookingWindow(nowISO)
  if (!w) return false
  return dateStr >= w.start && dateStr <= w.end && weekdayOf(dateStr) !== 0
}

export function getBookingWeekDates(nowISO?: string): string[] {
  const w = getClientBookingWindow(nowISO)
  if (!w) return []
  const dates: string[] = []
  let cur = w.start
  while (cur <= w.end) {
    if (weekdayOf(cur) !== 0) dates.push(cur)
    cur = addDays(cur, 1)
  }
  return dates
}
```

- [ ] **Step 4: Sunday message on the client page**

In `app/(client)/agendar/page.tsx`, after `const availableDates = getBookingWeekDates()`:

```tsx
  if (availableDates.length === 0) {
    return (
      <div className="py-6">
        <h1 className="text-white text-2xl font-bold mb-6">Agendar</h1>
        <div className="bg-zinc-800 rounded-xl p-6 text-center">
          <p className="text-zinc-300">A agenda da próxima semana abre segunda-feira.</p>
        </div>
      </div>
    )
  }
```

- [ ] **Step 5: Run tests + full unit suite**

Run: `npx vitest run` → all PASS (other suites unaffected).

- [ ] **Step 6: Commit**

```bash
git add lib/business-rules/booking-window.ts lib/business-rules/booking-window.test.ts "app/(client)/agendar/page.tsx"
git commit -m "feat: booking window limited to current week; Sunday shows opens-Monday message"
```

---

### Task 4: Schedule access layer (lib/schedule)

**Files:**
- Create: `lib/schedule/settings.ts`
- Create: `lib/schedule/validation.ts`
- Test: `lib/schedule/validation.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `@/lib/supabase/admin`; `EffectiveHours` from Task 2; types from Task 1.
- Produces:
  - `getScheduleSettings(): Promise<ScheduleSettings>` — reads row id=1; on missing row returns hardcoded fallback `{ open_time: '10:00', close_time: '20:00', min_lead_minutes: 60 }` (never throws).
  - `getEffectiveHours(date: string): Promise<{ hours: EffectiveHours; fromOverride: boolean; settings: ScheduleSettings }>`
  - `isHalfHourStep(time: string): boolean`
  - `validateHoursInput(open: string, close: string): string | null` (error message or null)
  - `validateOverrideDate(date: string, todayStr: string): string | null`

- [ ] **Step 1: Write validation tests**

```ts
// lib/schedule/validation.test.ts
import { describe, it, expect } from 'vitest'
import { isHalfHourStep, validateHoursInput, validateOverrideDate } from './validation'

describe('isHalfHourStep', () => {
  it('accepts HH:00 and HH:30', () => {
    expect(isHalfHourStep('10:00')).toBe(true)
    expect(isHalfHourStep('19:30')).toBe(true)
  })
  it('rejects other minutes and garbage', () => {
    expect(isHalfHourStep('10:15')).toBe(false)
    expect(isHalfHourStep('abc')).toBe(false)
    expect(isHalfHourStep('25:00')).toBe(false)
  })
})

describe('validateHoursInput', () => {
  it('accepts a valid range', () => expect(validateHoursInput('10:00', '20:00')).toBeNull())
  it('rejects close <= open', () => expect(validateHoursInput('20:00', '10:00')).toMatch(/fechamento/i))
  it('rejects non-30-min steps', () => expect(validateHoursInput('10:15', '20:00')).toMatch(/30/))
})

describe('validateOverrideDate', () => {
  it('accepts today and future weekdays', () => {
    expect(validateOverrideDate('2027-01-15', '2027-01-13')).toBeNull()
  })
  it('rejects past dates', () => {
    expect(validateOverrideDate('2027-01-12', '2027-01-13')).toMatch(/passado/i)
  })
  it('rejects Sundays', () => {
    expect(validateOverrideDate('2027-01-17', '2027-01-13')).toMatch(/domingo/i)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/schedule/validation.test.ts` → FAIL (module missing)

- [ ] **Step 3: Implement validation.ts**

```ts
// lib/schedule/validation.ts
export function isHalfHourStep(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const [h, m] = time.split(':').map(Number)
  if (h > 23) return false
  return m === 0 || m === 30
}

export function validateHoursInput(open: string, close: string): string | null {
  if (!isHalfHourStep(open) || !isHalfHourStep(close)) {
    return 'Horários devem ser em passos de 30 minutos (ex.: 10:00, 10:30).'
  }
  if (close <= open) return 'O fechamento deve ser depois da abertura.'
  return null
}

export function validateOverrideDate(date: string, todayStr: string): string | null {
  if (date < todayStr) return 'A data não pode ser no passado.'
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay()
  if (weekday === 0) return 'Domingo não tem atendimento.'
  return null
}
```

- [ ] **Step 4: Implement settings.ts**

```ts
// lib/schedule/settings.ts
import { createAdminClient } from '@/lib/supabase/admin'
import type { EffectiveHours } from '@/lib/business-rules/slots'
import type { ScheduleSettings } from '@/types'

const FALLBACK: ScheduleSettings = {
  id: 1,
  open_time: '10:00',
  close_time: '20:00',
  min_lead_minutes: 60,
  updated_at: '',
}

// time columns come back as 'HH:MM:SS' — normalize to 'HH:MM'.
function hm(t: string): string {
  return t.slice(0, 5)
}

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (!data) return FALLBACK
  return { ...data, open_time: hm(data.open_time), close_time: hm(data.close_time) }
}

export async function getEffectiveHours(date: string): Promise<{
  hours: EffectiveHours
  fromOverride: boolean
  settings: ScheduleSettings
}> {
  const supabase = createAdminClient()
  const settings = await getScheduleSettings()
  const { data: override } = await supabase
    .from('day_overrides')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (override) {
    return {
      hours: { start: hm(override.open_time), end: hm(override.close_time) },
      fromOverride: true,
      settings,
    }
  }
  return {
    hours: { start: settings.open_time, end: settings.close_time },
    fromOverride: false,
    settings,
  }
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run lib/schedule/validation.test.ts` → PASS
Run: `npx tsc --noEmit` → no errors

- [ ] **Step 6: Commit**

```bash
git add lib/schedule
git commit -m "feat: schedule settings access layer and input validation"
```

---

### Task 5: Client actions use effective hours + lead

**Files:**
- Modify: `actions/client/appointments.ts`

**Interfaces:**
- Consumes: `getEffectiveHours` (Task 4), new `getAvailableSlots` signature (Task 2).
- Produces: same exported action signatures (no caller changes).

- [ ] **Step 1: `getAvailableSlotsForDate`** — add a top-level import:

```ts
import { getEffectiveHours } from '@/lib/schedule/settings'
```

and replace the `getAvailableSlots(...)` call site:

```ts
    const { hours, settings } = await getEffectiveHours(date)

    const slots = getAvailableSlots(
      date,
      service.duration_minutes,
      (appointments ?? []) as Appointment[],
      blockList,
      new Date().toISOString(),
      hours,
      settings.min_lead_minutes,
    )
```

- [ ] **Step 2: `bookAppointment` server-side revalidation** — after the service is
fetched and before the conflict query, validate the requested slot against the
freshly computed available list (covers hours, blocks, lead, Sunday, alignment):

```ts
    // Revalidate the requested slot server-side (grid, blocks, lead time).
    const slotCheck = await getAvailableSlotsForDate(input.date, input.service_id)
    const requested = slotCheck.slots?.find(
      (s) => s.start === input.start_time && s.available,
    )
    if (!requested) {
      return { error: 'Horário não disponível. Escolha outro horário.' }
    }
```

(keep the existing conflict query + insert as a second safety net)

- [ ] **Step 3: `rescheduleAppointment`** — the current select doesn't fetch the
service id — change the select to:

```ts
      .select('id, status, service_id, service:services(duration_minutes)')
```

then:

```ts
    const slotCheck = await getAvailableSlotsForDate(newDate, appt.service_id)
    const requested = slotCheck.slots?.find(
      (s) => s.start === newStartTime && s.available,
    )
    if (!requested) {
      return { error: 'Horário não disponível. Escolha outro horário.' }
    }
```

Note: `getAvailableSlotsForDate` marks slots that conflict with ANY scheduled
appointment as unavailable — including the appointment being moved. Moving an
appointment to a slot overlapping ITSELF (e.g., 10:00→10:30 with 60-min
service) will be refused. Acceptable per spec (rare; client can cancel + rebook).
Add this comment inline.

- [ ] **Step 4: Typecheck + unit suite**

Run: `npx tsc --noEmit` → no errors
Run: `npx vitest run` → PASS

- [ ] **Step 5: Commit**

```bash
git add actions/client/appointments.ts
git commit -m "feat: client booking validates against effective hours and lead time"
```

---

### Task 6: Admin validations use effective hours

**Files:**
- Modify: `actions/admin/appointments.ts:21-32` (validateSlot)
- Modify: `actions/admin/monthly-appointments.ts` (same pattern around lines 38-47)

**Interfaces:**
- Consumes: `getEffectiveHours` (Task 4), `CLOSED_WEEKDAYS`, `timeToMinutes`, `minutesToTime` (Task 2).
- Produces: `validateSlot` becomes `async` — update its call sites (`createGuestAppointment`, and the reschedule action in the same file) to `await` it.

- [ ] **Step 1: Replace the Task-2 shim in `actions/admin/appointments.ts`**

```ts
import { CLOSED_WEEKDAYS, timeToMinutes, minutesToTime } from '@/lib/business-rules/slots'
import { getEffectiveHours } from '@/lib/schedule/settings'

// Validate a date/time against the shop rules (not past, not Sunday, within
// the day's effective hours). Admins have no lead-time restriction and are
// not limited to the client booking window.
async function validateSlot(date: string, start: string, durationMinutes: number): Promise<{ end?: string; error?: string }> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (date < today) return { error: 'A data não pode ser no passado.' }
  if (CLOSED_WEEKDAYS.includes(weekdayOf(date))) return { error: 'Dia sem atendimento (domingo).' }

  const { hours } = await getEffectiveHours(date)
  const startMin = timeToMinutes(start)
  const endMin = startMin + durationMinutes
  if (startMin < timeToMinutes(hours.start) || endMin > timeToMinutes(hours.end)) {
    return { error: 'Horário fora do expediente.' }
  }
  return { end: minutesToTime(endMin) }
}
```

Update every `validateSlot(...)` call in the file to `await validateSlot(...)`.

- [ ] **Step 2: Same replacement in `actions/admin/monthly-appointments.ts`** —
replace the `BUSINESS_HOURS`-shim checks with `CLOSED_WEEKDAYS` +
`await getEffectiveHours(date)` using the identical pattern (the file inlines
the checks rather than a helper; keep its structure, swap the comparisons).

- [ ] **Step 3: Typecheck + unit suite**

Run: `npx tsc --noEmit` → no errors
Run: `npx vitest run` → PASS

- [ ] **Step 4: Commit**

```bash
git add actions/admin/appointments.ts actions/admin/monthly-appointments.ts
git commit -m "feat: admin slot validation uses per-day effective hours"
```

---

### Task 7: Admin schedule actions

**Files:**
- Create: `actions/admin/schedule.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `createAdminClient`, validation fns (Task 4).
- Produces:
  - `updateScheduleSettings(data: { open_time: string; close_time: string; min_lead_minutes: number }): Promise<{ error?: string }>`
  - `upsertDayOverride(data: { date: string; open_time: string; close_time: string }): Promise<{ override?: DayOverride; error?: string }>`
  - `removeDayOverride(date: string): Promise<{ error?: string }>`
  - `getDaySchedule(date: string): Promise<{ hours: EffectiveHours; fromOverride: boolean; blocks: ScheduleBlock[]; error?: string }>` (for the UI day picker)

- [ ] **Step 1: Implement**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { validateHoursInput, validateOverrideDate } from '@/lib/schedule/validation'
import { getEffectiveHours } from '@/lib/schedule/settings'
import type { EffectiveHours } from '@/lib/business-rules/slots'
import type { DayOverride, ScheduleBlock } from '@/types'

function todaySP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function revalidateSchedulePages() {
  revalidatePath('/admin/horarios')
  revalidatePath('/agendar')
}

export async function updateScheduleSettings(data: {
  open_time: string
  close_time: string
  min_lead_minutes: number
}): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const hoursError = validateHoursInput(data.open_time, data.close_time)
  if (hoursError) return { error: hoursError }
  if (!Number.isInteger(data.min_lead_minutes) || data.min_lead_minutes < 0 || data.min_lead_minutes > 1440) {
    return { error: 'Antecedência deve ser entre 0 e 1440 minutos.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('settings')
    .update({
      open_time: data.open_time,
      close_time: data.close_time,
      min_lead_minutes: data.min_lead_minutes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) return { error: error.message }
  revalidateSchedulePages()
  return {}
}

export async function upsertDayOverride(data: {
  date: string
  open_time: string
  close_time: string
}): Promise<{ override?: DayOverride; error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const dateError = validateOverrideDate(data.date, todaySP())
  if (dateError) return { error: dateError }
  const hoursError = validateHoursInput(data.open_time, data.close_time)
  if (hoursError) return { error: hoursError }

  const supabase = createAdminClient()
  const { data: override, error } = await supabase
    .from('day_overrides')
    .upsert(
      {
        date: data.date,
        open_time: data.open_time,
        close_time: data.close_time,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date' },
    )
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateSchedulePages()
  return { override: override as DayOverride }
}

export async function removeDayOverride(date: string): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { error } = await supabase.from('day_overrides').delete().eq('date', date)
  if (error) return { error: error.message }
  revalidateSchedulePages()
  return {}
}

export async function getDaySchedule(date: string): Promise<{
  hours?: EffectiveHours
  fromOverride?: boolean
  blocks?: ScheduleBlock[]
  error?: string
}> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { hours, fromOverride } = await getEffectiveHours(date)
  const { data: blocks, error } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('active', true)
    .lte('date', date)
    .or(`date_end.gte.${date},and(date.eq.${date},date_end.is.null)`)

  if (error) return { error: error.message }
  return { hours, fromOverride, blocks: (blocks ?? []) as ScheduleBlock[] }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → no errors

- [ ] **Step 3: Commit**

```bash
git add actions/admin/schedule.ts
git commit -m "feat: admin actions for default hours, lead time and day overrides"
```

---

### Task 8: Admin "Horários" page

**Files:**
- Create: `app/(admin)/admin/horarios/page.tsx`
- Create: `components/admin/HorariosManager.tsx`
- Modify: `app/(admin)/admin/bloqueios/page.tsx` (redirect)
- Modify: `components/admin/nav-items.ts`

**Interfaces:**
- Consumes: actions from Task 7, `createBlock`/`deactivateBlock` from `actions/admin/blocks`, `ScheduleSettings` type, `getScheduleSettings`.
- Produces: route `/admin/horarios`; `/admin/bloqueios` redirects there.

- [ ] **Step 1: nav item**

In `components/admin/nav-items.ts` replace
`{ href: '/admin/bloqueios', label: 'Bloqueios', icon: '🚫' },` with
`{ href: '/admin/horarios', label: 'Horários', icon: '🕐' },`

- [ ] **Step 2: redirect old route**

Replace the whole `app/(admin)/admin/bloqueios/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

export default function BloqueiosPage() {
  redirect('/admin/horarios')
}
```

- [ ] **Step 3: page (server component)**

```tsx
// app/(admin)/admin/horarios/page.tsx
export const dynamic = 'force-dynamic'
import { getScheduleSettings } from '@/lib/schedule/settings'
import { createClient } from '@/lib/supabase/server'
import { HorariosManager } from '@/components/admin/HorariosManager'
import type { ScheduleBlock } from '@/types'

export default async function HorariosPage() {
  const settings = await getScheduleSettings()

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const supabase = await createClient()
  const { data } = await supabase
    .from('schedule_blocks')
    .select('*')
    .gte('date', today)
    .order('date')
    .eq('active', true)
  const blocks: ScheduleBlock[] = data ?? []

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-white">Horários</h1>
      <HorariosManager settings={settings} blocks={blocks} />
    </div>
  )
}
```

- [ ] **Step 4: HorariosManager (client component)**

Three sections: default hours card, per-day adjust card, blocks (reuse the
existing BloqueiosManager below the new cards).

```tsx
// components/admin/HorariosManager.tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BloqueiosManager } from '@/components/admin/BloqueiosManager'
import {
  updateScheduleSettings,
  upsertDayOverride,
  removeDayOverride,
  getDaySchedule,
} from '@/actions/admin/schedule'
import type { ScheduleSettings, ScheduleBlock } from '@/types'
import type { EffectiveHours } from '@/lib/business-rules/slots'

interface HorariosManagerProps {
  settings: ScheduleSettings
  blocks: ScheduleBlock[]
}

// 30-min options 06:00..23:30 for selects.
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const total = 6 * 60 + i * 30
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
})

function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white"
      >
        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  )
}

export function HorariosManager({ settings, blocks }: HorariosManagerProps) {
  // --- default hours card ---
  const [open, setOpen] = useState(settings.open_time)
  const [close, setClose] = useState(settings.close_time)
  const [lead, setLead] = useState(String(settings.min_lead_minutes))
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // --- per-day card ---
  const [day, setDay] = useState('')
  const [dayHours, setDayHours] = useState<EffectiveHours | null>(null)
  const [dayFromOverride, setDayFromOverride] = useState(false)
  const [dayOpen, setDayOpen] = useState('10:00')
  const [dayClose, setDayClose] = useState('20:00')
  const [dayError, setDayError] = useState<string | null>(null)
  const [dayMsg, setDayMsg] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      setSettingsError(null)
      setSettingsMsg(null)
      const result = await updateScheduleSettings({
        open_time: open,
        close_time: close,
        min_lead_minutes: parseInt(lead, 10),
      })
      if (result.error) { setSettingsError(result.error); return }
      setSettingsMsg('Horário padrão salvo.')
    })
  }

  function loadDay(date: string) {
    setDay(date)
    setDayError(null)
    setDayMsg(null)
    setDayHours(null)
    if (!date) return
    startTransition(async () => {
      const result = await getDaySchedule(date)
      if (result.error || !result.hours) { setDayError(result.error ?? 'Erro ao carregar o dia.'); return }
      setDayHours(result.hours)
      setDayFromOverride(!!result.fromOverride)
      setDayOpen(result.hours.start)
      setDayClose(result.hours.end)
    })
  }

  function saveDay(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      setDayError(null)
      setDayMsg(null)
      const result = await upsertDayOverride({ date: day, open_time: dayOpen, close_time: dayClose })
      if (result.error) { setDayError(result.error); return }
      setDayMsg('Horário do dia salvo.')
      setDayFromOverride(true)
      setDayHours({ start: dayOpen, end: dayClose })
    })
  }

  function resetDay() {
    startTransition(async () => {
      setDayError(null)
      setDayMsg(null)
      const result = await removeDayOverride(day)
      if (result.error) { setDayError(result.error); return }
      setDayMsg('Dia voltou ao horário padrão.')
      loadDay(day)
    })
  }

  return (
    <div className="space-y-6">
      {/* Horário padrão */}
      <form onSubmit={saveSettings} className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-amber-500">Horário padrão</h2>
        <p className="text-zinc-400 text-sm">Vale para todos os dias sem ajuste específico.</p>
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect label="Abertura" value={open} onChange={setOpen} />
          <TimeSelect label="Fechamento" value={close} onChange={setClose} />
        </div>
        <Input
          label="Antecedência mínima (minutos)"
          name="lead"
          type="number"
          min="0"
          max="1440"
          value={lead}
          onChange={(e) => setLead(e.target.value)}
          required
        />
        <p className="text-zinc-500 text-xs">
          Ex.: 60 = o horário das 20:00 só pode ser agendado até as 19:00.
        </p>
        {settingsError && <p className="text-red-400 text-sm">{settingsError}</p>}
        {settingsMsg && <p className="text-green-400 text-sm">{settingsMsg}</p>}
        <Button type="submit" loading={isPending}>Salvar</Button>
      </form>

      {/* Ajustes por dia */}
      <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-amber-500">Ajustar um dia específico</h2>
        <p className="text-zinc-400 text-sm">
          Mude a abertura/fechamento de um único dia (ex.: sexta até 21:00) sem afetar os demais.
        </p>
        <Input label="Dia" name="day" type="date" value={day} onChange={(e) => loadDay(e.target.value)} />
        {day && dayHours && (
          <form onSubmit={saveDay} className="space-y-3">
            <p className="text-zinc-300 text-sm">
              Horário atual: <span className="text-white font-medium">{dayHours.start} – {dayHours.end}</span>
              {dayFromOverride ? ' (ajuste deste dia)' : ' (horário padrão)'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TimeSelect label="Abertura" value={dayOpen} onChange={setDayOpen} />
              <TimeSelect label="Fechamento" value={dayClose} onChange={setDayClose} />
            </div>
            {dayError && <p className="text-red-400 text-sm">{dayError}</p>}
            {dayMsg && <p className="text-green-400 text-sm">{dayMsg}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={isPending}>Salvar horário do dia</Button>
              {dayFromOverride && (
                <Button type="button" variant="secondary" onClick={resetDay} disabled={isPending}>
                  Voltar ao padrão
                </Button>
              )}
            </div>
          </form>
        )}
        {day && !dayHours && dayError && <p className="text-red-400 text-sm">{dayError}</p>}
      </div>

      {/* Bloqueios */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-amber-500">Bloqueios</h2>
        <p className="text-zinc-400 text-sm">
          Feche o dia inteiro ou faixas de horário (almoço, compromissos, férias).
        </p>
        <BloqueiosManager blocks={blocks} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck + lint + manual smoke**

Run: `npx tsc --noEmit` → no errors
Run: `npm run lint` → no new errors
Run: `npm run dev`, open `http://localhost:3000/admin/horarios` (login with the
E2E temp-admin pattern or the dev admin), verify: settings card shows 10:00 /
20:00 / 60; picking a date shows its hours; saving an override + removing it
works; blocks section works. `/admin/bloqueios` redirects.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/horarios" "app/(admin)/admin/bloqueios/page.tsx" components/admin/HorariosManager.tsx components/admin/nav-items.ts
git commit -m "feat: admin Horarios page - default hours, lead time and per-day adjustments"
```

---

### Task 9: E2E coverage

**Files:**
- Create: `e2e/horarios.spec.ts`
- Modify: `e2e/admin.spec.ts` (nav assertion only if it references "Bloqueios")

**Interfaces:**
- Consumes: `e2e/helpers.ts` (`adminClient`, `cleanupTestUsers`, `testPhone`, `TEST_PASSWORD`); temp-admin creation pattern from `e2e/manual-screenshots.spec.ts`.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test'
import { adminClient, cleanupTestUsers, testPhone, TEST_PASSWORD } from './helpers'

// Uses its own throwaway admin (real admin password is not known to CI).
const ADMIN_EMAIL = 'e2e-horarios@davibarber.app'
const ADMIN_PASSWORD = `E2e-${Math.random().toString(36).slice(2)}!7`
const PHONE = testPhone('55')

async function deleteTempAdmin() {
  const admin = adminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const u = data.users.find((x) => x.email === ADMIN_EMAIL)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

// Next Friday from today (always inside admin editing range; skip if Sunday
// affects the client window assertions).
function nextFriday(): string {
  const now = new Date()
  const d = new Date(now)
  d.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7))
  return d.toLocaleDateString('en-CA')
}

test.beforeAll(async () => {
  await cleanupTestUsers()
  await deleteTempAdmin()
  const { error } = await adminClient().auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { name: 'E2E' },
  })
  if (error) throw new Error(error.message)
})

test.afterAll(async () => {
  // Remove any override the test created, then the temp admin.
  await adminClient().from('day_overrides').delete().eq('date', nextFriday())
  await cleanupTestUsers()
  await deleteTempAdmin()
})

test('admin edits default hours and a specific day', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 })

  await page.goto('/admin/horarios')
  await expect(page.getByRole('heading', { name: 'Horários' })).toBeVisible()

  // Default card shows the seeded settings.
  await expect(page.getByText('Horário padrão')).toBeVisible()

  // Save settings unchanged (round-trip works).
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Horário padrão salvo.')).toBeVisible({ timeout: 15_000 })

  // Per-day override on next Friday: open 09:00.
  const friday = nextFriday()
  await page.getByLabel('Dia').fill(friday)
  await expect(page.getByText(/Horário atual:/)).toBeVisible({ timeout: 15_000 })
  // TimeSelect nests the <select> inside its <label>, so getByLabel works.
  // The day form is the second form on the page (first = default hours card).
  await page.locator('form').nth(1).getByLabel('Abertura').selectOption('09:00')
  await page.getByRole('button', { name: 'Salvar horário do dia' }).click()
  await expect(page.getByText('Horário do dia salvo.')).toBeVisible({ timeout: 15_000 })

  // Reset to default.
  await page.getByRole('button', { name: 'Voltar ao padrão' }).click()
  await expect(page.getByText('Dia voltou ao horário padrão.')).toBeVisible({ timeout: 15_000 })

  // Old route redirects.
  await page.goto('/admin/bloqueios')
  await expect(page).toHaveURL(/\/admin\/horarios$/)
})

test('client sees the 10:00-20:00 grid and only current week', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('Cliente E2E Horarios')
  await page.getByLabel('Telefone').fill(PHONE)
  await page.getByLabel('Senha').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('heading', { name: 'Agendar' })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button').filter({ hasText: 'min' }).first().click()
  await expect(page.getByText('Escolha a data')).toBeVisible()

  // Pick the last day (Saturday of the current week) and check the grid.
  await page.locator('button', { hasText: /^(Seg|Ter|Qua|Qui|Sex|Sáb)/ }).last().click()
  await expect(page.getByText('Escolha o horário')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('button', { hasText: /^10:00$/ }).first()).toBeVisible()
  await expect(page.locator('button', { hasText: /^09:00$/ })).toHaveCount(0)
})
```

- [ ] **Step 2: Run the new spec (needs the dev server; playwright starts it)**

Run: `npx playwright test e2e/horarios.spec.ts`
Expected: PASS on Mon–Sat. On Sunday the client test fails (empty window) —
guard it: `test.skip(new Date().getDay() === 0, 'Sunday: booking window closed')`.
Include that skip line in the client test from the start.

- [ ] **Step 3: Check `e2e/admin.spec.ts`** for references to "Bloqueios" in the
nav walk — there are none today (it visits Dashboard, Agenda, Mensais, Buscar,
Relatório) — confirm with grep and leave unchanged if so.

- [ ] **Step 4: Run the whole e2e suite**

Run: `npm run e2e`
Expected: all specs PASS (client spec now books within 10:00–20:00 grid — its
selectors are grid-agnostic, so no change needed).

- [ ] **Step 5: Commit**

```bash
git add e2e/horarios.spec.ts
git commit -m "test: e2e coverage for Horarios page and weekly client grid"
```

---

### Task 10: Full verification + deploy

**Files:** none new.

- [ ] **Step 1: Full local verification**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run e2e
```
All green. If manual screenshots are wanted later, `e2e/manual-screenshots.spec.ts`
still works (gated by MANUAL_SHOTS) but the manuals update is a separate follow-up.

- [ ] **Step 2: Confirm the migration ran in production Supabase**
(Task 1 Step 3 — if it was deferred, apply it now via MCP `apply_migration`
before deploying, or the new tables won't exist.)

- [ ] **Step 3: Deploy**

```bash
npx vercel --prod --yes
```
(CLI is authenticated as the project-owner account `vwxm` on this machine —
see project memory. No GitHub auto-deploy.)

- [ ] **Step 4: Verify production**

- Open `davi-barber.vercel.app/admin/horarios` (barber admin) → cards render, settings 10:00/20:00/60.
- Client flow: register a `119000000*` test client via the UI or reuse the
  check pattern from earlier sessions; confirm date list = current week only
  and slots start 10:00. Clean the test client afterwards via service role.

- [ ] **Step 5: Push**

```bash
git push origin main
```
