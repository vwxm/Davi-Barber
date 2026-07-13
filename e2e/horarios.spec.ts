import { test, expect } from '@playwright/test'
import { adminClient, cleanupTestUsers, testPhone, TEST_PASSWORD } from './helpers'

// Uses its own throwaway admin (real admin password is not known to CI).
const ADMIN_EMAIL = 'e2e-horarios@davibarber.app'
const ADMIN_PASSWORD = `E2e-${Math.random().toString(36).slice(2)}!7`
const PHONE = testPhone('55')

// The grid test makes ~12 server-action roundtrips against the dev server.
test.setTimeout(120_000)

async function deleteTempAdmin() {
  const admin = adminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const u = data.users.find((x) => x.email === ADMIN_EMAIL)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

// Saturday of NEXT week: always in the day buttons, and far enough out that
// the live project has no real data there.
function nextWeekSaturday(): string {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA')
  const d = new Date(todayStr + 'T12:00:00Z')
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? 1 : 1 - dow) + 7 + 5) // next week's Monday + 5
  return d.toISOString().slice(0, 10)
}

async function cleanupGridDay() {
  const admin = adminClient()
  const date = nextWeekSaturday()
  await admin.from('day_overrides').delete().eq('date', date)
  await admin.from('schedule_blocks').delete().eq('date', date).is('date_end', null)
}

test.beforeAll(async () => {
  await cleanupTestUsers()
  await deleteTempAdmin()
  await cleanupGridDay()
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
  await cleanupGridDay()
  await cleanupTestUsers()
  await deleteTempAdmin()
})

test('admin edits default hours and toggles slots on the visual grid', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 })

  await page.goto('/admin/horarios')
  await expect(page.getByRole('heading', { name: 'Horários' })).toBeVisible()

  // Default card round-trip.
  await expect(page.getByText('Horário padrão', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Horário padrão salvo.')).toBeVisible({ timeout: 15_000 })

  // Pick next week's Saturday (last day button) — clean of real data.
  await page.locator('button', { hasText: /^Sáb/ }).last().click()

  const slot = (time: string) => page.locator(`button[data-state]`, { hasText: time })

  // Grid loads with the default hours: 10:00 aberto, 09:30 fechado.
  await expect(slot('10:00')).toHaveAttribute('data-state', 'aberto', { timeout: 15_000 })
  await expect(slot('09:30')).toHaveAttribute('data-state', 'fechado')

  // Tap an open slot -> choice popup -> "Bloquear" (red). Tap again -> reopens.
  await slot('14:00').click()
  await page.getByRole('button', { name: /Bloquear horário/ }).click()
  await expect(slot('14:00')).toHaveAttribute('data-state', 'bloqueado', { timeout: 15_000 })
  await slot('14:00').click()
  await expect(slot('14:00')).toHaveAttribute('data-state', 'aberto', { timeout: 15_000 })

  // Tap an open slot -> "Fechar" (grey, out of the day). Tap again -> reopens.
  await slot('15:00').click()
  await page.getByRole('button', { name: /Fechar horário/ }).click()
  await expect(slot('15:00')).toHaveAttribute('data-state', 'fechado', { timeout: 15_000 })
  await slot('15:00').click()
  await expect(slot('15:00')).toHaveAttribute('data-state', 'aberto', { timeout: 15_000 })

  // Cancel button leaves the slot untouched.
  await slot('16:00').click()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(slot('16:00')).toHaveAttribute('data-state', 'aberto')

  // Tap 09:00 (fechado, outside hours) -> adds it directly; the 09:30 gap
  // stays grey and the day is marked as adjusted.
  await slot('09:00').click()
  await expect(slot('09:00')).toHaveAttribute('data-state', 'aberto', { timeout: 15_000 })
  await expect(slot('09:30')).toHaveAttribute('data-state', 'fechado')
  await expect(page.getByText('(ajustado)')).toBeVisible()

  // Old route redirects.
  await page.goto('/admin/bloqueios')
  await expect(page).toHaveURL(/\/admin\/horarios$/)
})

test('client sees the 10:00-20:00 grid and only current week', async ({ page }) => {
  test.skip(new Date().getDay() === 0, 'Sunday: booking window closed')

  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('Cliente E2E Horarios')
  await page.getByLabel('Telefone').fill(PHONE)
  await page.getByLabel('Senha').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('heading', { name: 'Agendar' })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button').filter({ hasText: 'min' }).first().click()
  await expect(page.getByText('Escolha a data')).toBeVisible()

  // Dates offered are only within the current week (Mon–Sat).
  const dateButtons = page.locator('button', { hasText: /^(Seg|Ter|Qua|Qui|Sex|Sáb)/ })
  const dateCount = await dateButtons.count()
  expect(dateCount).toBeGreaterThan(0)
  expect(dateCount).toBeLessThanOrEqual(6)

  // Find a day whose grid actually renders slots (full-day blocks and the
  // same-day lead cutoff can empty a specific day — including real blocks
  // the barber created in the live project).
  let found = false
  for (let i = 0; i < dateCount; i++) {
    await dateButtons.nth(i).click()
    await expect(page.getByText('Escolha o horário')).toBeVisible({ timeout: 15_000 })
    const slotCount = await page.locator('button', { hasText: /^\d{2}:\d{2}$/ }).count()
    if (slotCount > 0) { found = true; break }
    await page.getByText('← Voltar').click()
    await expect(page.getByText('Escolha a data')).toBeVisible()
  }
  test.skip(!found, 'Every remaining day this week is blocked or past the lead cutoff')

  // Grid follows the default hours: starts at 10:00, nothing before.
  await expect(page.locator('button', { hasText: /^10:00$/ }).first()).toBeVisible()
  await expect(page.locator('button', { hasText: /^09:00$/ })).toHaveCount(0)
})
