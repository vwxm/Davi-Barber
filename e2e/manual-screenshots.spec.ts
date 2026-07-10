import { test, expect, type Page } from '@playwright/test'
import { adminClient, cleanupTestUsers, testPhone, TEST_PASSWORD } from './helpers'
import path from 'node:path'
import fs from 'node:fs'

// Captures step-by-step screenshots for the user manuals (docs/manuais).
// Not part of the regression suite: run with MANUAL_SHOTS=<output dir>, e.g.
//   $env:MANUAL_SHOTS = 'C:\temp\shots'; npx playwright test e2e/manual-screenshots.spec.ts
test.skip(!process.env.MANUAL_SHOTS, 'manual-screenshot capture only (set MANUAL_SHOTS=<dir>)')

const SHOTS = process.env.MANUAL_SHOTS ?? ''

const PHONE = testPhone('77')
const CLIENT_NAME = 'João da Silva'
const GUEST_NAME = 'Carlos Andrade'

// Temporary admin just for the screenshots (the real admin password is not
// known to this run). Created in beforeAll, deleted in afterAll.
const ADMIN_EMAIL = 'davi@davibarber.app'
const ADMIN_PASSWORD = `Shot-${Math.random().toString(36).slice(2)}!9`

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
test.setTimeout(180_000)

async function deleteTempAdmin() {
  const admin = adminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const u = data.users.find((x) => x.email === ADMIN_EMAIL)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  await cleanupTestUsers()
  // Remove any leftover guest from a previous capture run.
  await adminClient().from('appointments').delete().eq('guest_name', GUEST_NAME)
  await deleteTempAdmin()
  const { error } = await adminClient().auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { name: 'Davi' },
  })
  if (error) throw new Error(`temp admin: ${error.message}`)
})

test.afterAll(async () => {
  await adminClient().from('appointments').delete().eq('guest_name', GUEST_NAME)
  await cleanupTestUsers()
  await deleteTempAdmin()
})

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForTimeout(400)
  // Hide the Next.js dev-tools badge so it doesn't show in the manuals.
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((el) => el.remove())
  })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage })
}

test('captura fluxo do cliente', async ({ page }) => {
  // Login screen (empty, as a new visitor sees it)
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await shot(page, 'c01-login')

  // Cadastro filled
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill(CLIENT_NAME)
  await page.getByLabel('Telefone').fill(PHONE)
  await page.getByLabel('Senha').fill(TEST_PASSWORD)
  await shot(page, 'c02-cadastro')
  await page.getByRole('button', { name: 'Criar conta' }).click()

  // Booking wizard: services
  await expect(page.getByRole('heading', { name: 'Agendar' })).toBeVisible({ timeout: 20_000 })
  // Viewport-only: the full list is taller than the screen and a fullPage
  // capture paints the fixed bottom nav mid-image.
  await shot(page, 'c03-servicos', false)

  // Date
  await page.getByRole('button').filter({ hasText: 'min' }).first().click()
  await expect(page.getByText('Escolha a data')).toBeVisible()
  await shot(page, 'c04-data')

  // Time slots
  await page.locator('button', { hasText: /^(Seg|Ter|Qua|Qui|Sex|Sáb)/ }).last().click()
  await expect(page.getByText('Escolha o horário')).toBeVisible({ timeout: 20_000 })
  await shot(page, 'c05-horario')

  // Confirm step
  await page.locator('button:not([disabled])', { hasText: /^\d{2}:\d{2}$/ }).first().click()
  await expect(page.getByRole('button', { name: 'Confirmar agendamento' })).toBeVisible()
  await shot(page, 'c06-confirmar')

  // Success + access code
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('Agendamento confirmado!')).toBeVisible({ timeout: 20_000 })
  await shot(page, 'c07-sucesso')

  // Meus agendamentos
  await page.goto('/agendamentos')
  await expect(page.getByRole('heading', { name: 'Meus Agendamentos' })).toBeVisible()
  await expect(page.getByText('Próximos')).toBeVisible({ timeout: 20_000 })
  await shot(page, 'c08-meus')

  // Cancel confirmation dialog
  await page.getByRole('button', { name: 'Cancelar' }).first().click()
  await expect(page.getByRole('button', { name: 'Sim' })).toBeVisible()
  await shot(page, 'c09-cancelar')
  await page.getByRole('button', { name: 'Sim' }).click()
  await expect(page.getByText('Próximos')).toBeHidden({ timeout: 20_000 })

  // Perfil
  await page.goto('/perfil')
  await page.waitForLoadState('networkidle')
  await shot(page, 'c10-perfil')
})

function currentWeekSaturday(): string | null {
  const now = new Date()
  const dow = now.getDay()
  if (dow === 0) return null
  const sat = new Date(now)
  sat.setDate(now.getDate() + (6 - dow))
  return sat.toLocaleDateString('en-CA')
}

test('captura fluxo do admin', async ({ page }) => {
  // Login filled
  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD)
  await shot(page, 'a01-login')
  await page.getByRole('button', { name: 'Entrar' }).click()

  // Dashboard
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { name: /Bom dia|Boa tarde|Boa noite/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await shot(page, 'a02-dashboard')

  // Mobile menu open
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await expect(page.getByRole('link', { name: 'Agenda da Semana' })).toBeVisible()
  await shot(page, 'a03-menu', false)

  // Agenda da semana
  await page.getByRole('link', { name: 'Agenda da Semana' }).click()
  await expect(page.getByRole('heading', { name: 'Agenda da Semana' })).toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await shot(page, 'a04-agenda')

  // Novo agendamento (walk-in) form filled
  const date = currentWeekSaturday()
  if (date) {
    await page.getByRole('button', { name: '+ Novo agendamento' }).click()
    await page.getByLabel('Nome do cliente').fill(GUEST_NAME)
    await page.getByLabel('Telefone (opcional)').fill('11955554444')
    await page.getByLabel('Data').fill(date)
    await page.getByLabel('Horário').fill('16:30')
    await shot(page, 'a05-novo', false)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText(GUEST_NAME).first()).toBeVisible({ timeout: 20_000 })
    await shot(page, 'a06-avulso-na-agenda')
  }

  async function navTo(label: string, heading: string) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('link', { name: label }).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 20_000 })
    await page.waitForLoadState('networkidle')
  }

  // Buscar (search for the walk-in we just created)
  await navTo('Buscar', 'Buscar Agendamento')
  await page.getByLabel('Buscar por nome, telefone ou código').fill(GUEST_NAME)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.waitForTimeout(1500)
  await shot(page, 'a07-buscar')

  // Relatório
  await navTo('Relatório', 'Relatório da Semana')
  await shot(page, 'a08-relatorio')

  // Serviços
  await navTo('Serviços', 'Serviços')
  await shot(page, 'a09-servicos')

  // Bloqueios
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.getByRole('link', { name: 'Bloqueios' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await shot(page, 'a10-bloqueios')

  // Clientes mensais
  await navTo('Clientes Mensais', 'Clientes Mensais')
  await shot(page, 'a11-mensais')

  // Clientes
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await shot(page, 'a12-clientes')
})
