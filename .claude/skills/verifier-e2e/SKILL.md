---
name: verifier-e2e
description: Browser end-to-end verification for the Davi Barber app. Use when verifying a change that reaches the client or admin UI — drives the real app in Chromium via Playwright and captures screenshots/traces for replay.
---

# E2E Verifier (Davi Barber)

Drives the **real running app** in a browser (Chromium via Playwright) as a real
client and a real admin. This is the evidence-capture protocol for UI changes:
runs leave screenshots (on failure) and traces (on retry) a reviewer can replay.

## Surface

GUI (server components + server actions + Supabase). The specs click through the
actual interface; they do **not** import internal functions.

## Prerequisites

- `.env.local` present with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (helpers load it via `@next/env`).
- Chromium installed: `npx playwright install chromium` (one-time).
- Admin login: defaults to the dev admin; override with `E2E_ADMIN_EMAIL` /
  `E2E_ADMIN_PASSWORD` env vars if the password changed.

## Run

```bash
npm run e2e            # headless, auto-starts (or reuses) the dev server
npm run e2e:headed     # watch it drive the browser
npx playwright test e2e/client.spec.ts   # one spec
npx playwright show-report               # open the last HTML report
```

`playwright.config.ts` starts `npm run dev` automatically (`reuseExistingServer`)
and runs **serially, one worker** — the specs share one Supabase project.

## What it covers

- `e2e/client.spec.ts` — register a throwaway client, book an appointment through
  the service → date → slot → confirm wizard, then cancel it.
- `e2e/admin.spec.ts` — admin login → dashboard/agenda/mensais; rejects wrong
  credentials.

## Test data & cleanup

Test clients use the phone prefix `119000000` (see `e2e/helpers.ts`).
`e2e/global-teardown.ts` deletes every account with that prefix (and its
appointments) after the run, via the service role. Specs also clean up in
`beforeAll`, so a crashed run self-heals on the next run.

**These tests write to the live Supabase project.** They only touch their own
prefixed accounts. Do not point them at production data you care about without
a dedicated test project.

## Evidence

- Failure screenshots + traces: `test-results/`
- HTML report: `playwright-report/` (`npx playwright show-report`)
- Capture the relevant screenshot/trace path in your verification report.

## Adding a scenario

Add a `*.spec.ts` under `e2e/`. Reuse `helpers.ts` (`testPhone`, `adminClient`,
`cleanupTestUsers`). Prefer role/label/text selectors over CSS. Keep new test
clients under the `119000000` prefix so teardown removes them.
