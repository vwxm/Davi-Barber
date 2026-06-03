import { test, expect } from '@playwright/test'
import { cleanupTestUsers, testPhone, TEST_PASSWORD } from './helpers'

const PHONE = testPhone('01')

test.beforeAll(async () => {
  await cleanupTestUsers()
})

test('client can register, book an appointment, and cancel it', async ({ page }) => {
  // --- Register ---
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('Cliente E2E')
  await page.getByLabel('Telefone').fill(PHONE)
  await page.getByLabel('Senha').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Criar conta' }).click()

  // Redirected to the booking page once authenticated.
  await expect(page.getByRole('heading', { name: 'Agendar' })).toBeVisible({ timeout: 15_000 })

  // --- Book: service -> date -> slot -> confirm ---
  await page.getByRole('button').filter({ hasText: 'min' }).first().click()
  await expect(page.getByText('Escolha a data')).toBeVisible()

  // Pick the last available date (furthest out: always has open slots).
  await page.locator('button', { hasText: /^(Seg|Ter|Qua|Qui|Sex|Sáb)/ }).last().click()
  await expect(page.getByText('Escolha o horário')).toBeVisible({ timeout: 15_000 })

  // First bookable time slot.
  await page.locator('button:not([disabled])', { hasText: /^\d{2}:\d{2}$/ }).first().click()
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()

  // Success screen with access code.
  await expect(page.getByText('Agendamento confirmado!')).toBeVisible({ timeout: 15_000 })

  // --- See it in "Meus Agendamentos" then cancel ---
  await page.goto('/agendamentos')
  await expect(page.getByRole('heading', { name: 'Meus Agendamentos' })).toBeVisible()
  await expect(page.getByText('Próximos')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Cancelar' }).first().click()
  await page.getByRole('button', { name: 'Sim' }).click()

  // After cancel the upcoming appointment is gone.
  await expect(page.getByText('Próximos')).toBeHidden({ timeout: 15_000 })
})
