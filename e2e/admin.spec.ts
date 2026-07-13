import { test, expect } from '@playwright/test'
import { adminClient } from './helpers'

// A throwaway admin created for this run (the real admin password is not
// known to CI). E2E_ADMIN_* env vars override to use an existing account.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@davibarber.app'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? `E2e-${Math.random().toString(36).slice(2)}!3`
const USING_TEMP_ADMIN = !process.env.E2E_ADMIN_EMAIL

async function deleteTempAdmin() {
  const admin = adminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const u = data.users.find((x) => x.email === 'e2e-admin@davibarber.app')
  if (u) await admin.auth.admin.deleteUser(u.id)
}

test.beforeAll(async () => {
  if (!USING_TEMP_ADMIN) return
  await deleteTempAdmin()
  const { error } = await adminClient().auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { name: 'E2E Admin' },
  })
  if (error) throw new Error(error.message)
})

test.afterAll(async () => {
  if (USING_TEMP_ADMIN) await deleteTempAdmin()
})

test('admin can log in and reach the dashboard, agenda and monthly clients', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()

  // Dashboard renders (greeting + stat tiles).
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Bom dia|Boa tarde|Boa noite/ })).toBeVisible()
  await expect(page.getByText('Hoje', { exact: true })).toBeVisible()
  await expect(page.getByText('Semana', { exact: true })).toBeVisible()

  // Navigate via sidebar to the weekly agenda.
  await page.getByRole('link', { name: 'Agenda da Semana' }).click()
  await expect(page.getByRole('heading', { name: 'Agenda da Semana' })).toBeVisible({ timeout: 15_000 })

  // Navigate to monthly clients.
  await page.getByRole('link', { name: 'Clientes Mensais' }).click()
  await expect(page.getByRole('heading', { name: 'Clientes Mensais' })).toBeVisible({ timeout: 15_000 })

  // Search page — exercise the search action end-to-end with a no-match query.
  await page.getByRole('link', { name: 'Buscar' }).click()
  await expect(page.getByRole('heading', { name: 'Buscar Agendamento' })).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('Buscar por nome, telefone ou código').fill('zzzqqqsemresultado')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText('Nenhum agendamento encontrado.')).toBeVisible({ timeout: 15_000 })

  // Report page.
  await page.getByRole('link', { name: 'Relatório' }).click()
  await expect(page.getByRole('heading', { name: 'Relatório da Semana' })).toBeVisible({ timeout: 15_000 })
})

// Saturday of the current week (always in the weekly agenda, never Sunday,
// no monthly-client conflict). null on Sundays -> the guest test is skipped.
function currentWeekSaturday(): string | null {
  const now = new Date()
  const dow = now.getDay() // 0=Sun..6=Sat (machine tz = SP locally)
  if (dow === 0) return null
  const sat = new Date(now)
  sat.setDate(now.getDate() + (6 - dow))
  return sat.toLocaleDateString('en-CA')
}

test('admin books a walk-in (guest) and reschedules it from the agenda', async ({ page }) => {
  const date = currentWeekSaturday()
  test.skip(date === null, 'Runs Mon–Sat (guest date must be in the current week agenda)')

  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 })

  await page.goto('/admin/agenda')
  await page.getByRole('button', { name: '+ Novo agendamento' }).click()

  await page.getByLabel('Nome do cliente').fill('E2E Avulso')
  await page.getByLabel('Telefone (opcional)').fill('11955554444')
  await page.getByLabel('Data').fill(date!)
  await page.getByLabel('Horário').fill('16:30')
  await page.getByRole('button', { name: 'Salvar' }).click()

  // Appears in the agenda with the guest name + "avulso" tag.
  await expect(page.getByText('E2E Avulso').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('avulso').first()).toBeVisible()

  // Reschedule it to 17:30 — all interactions scoped to the appointment row.
  const row = page.locator('div.bg-zinc-800', { hasText: 'E2E Avulso' }).first()
  await row.getByRole('button', { name: 'Remarcar' }).click()
  await row.locator('input[type="date"]').fill(date!)
  await row.locator('input[type="time"]').fill('17:30')
  await row.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.locator('div.bg-zinc-800', { hasText: 'E2E Avulso' }).first().getByText('17:30')).toBeVisible({ timeout: 15_000 })
})

test('admin login rejects wrong credentials', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill('senhaErrada123')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByText('Credenciais inválidas.')).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\/admin\/login$/)
})
