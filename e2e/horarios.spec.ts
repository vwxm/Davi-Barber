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

// Next Friday strictly after today (always a valid override target).
function nextFriday(): string {
  const now = new Date()
  const d = new Date(now)
  d.setDate(now.getDate() + (((5 - now.getDay() + 7) % 7) || 7))
  return d.toLocaleDateString('en-CA')
}

test.beforeAll(async () => {
  await cleanupTestUsers()
  await deleteTempAdmin()
  await adminClient().from('day_overrides').delete().eq('date', nextFriday())
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
  await expect(page.getByText('Horário padrão', { exact: true })).toBeVisible()

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
