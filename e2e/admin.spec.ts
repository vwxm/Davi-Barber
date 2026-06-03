import { test, expect } from '@playwright/test'

// Admin credentials come from env, falling back to the known dev admin.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'vitormigli.vm@gmail.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Davibarber@2026'

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
})

test('admin login rejects wrong credentials', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill('senhaErrada123')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByText('Credenciais inválidas.')).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\/admin\/login$/)
})
