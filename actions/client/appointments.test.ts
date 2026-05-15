'use server'

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only before importing anything that uses it
vi.mock('server-only', () => ({}))

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

// Mock business-rules
vi.mock('@/lib/business-rules/booking-window', () => ({
  isDateInBookingWindow: vi.fn(),
  getClientBookingWindow: vi.fn(),
  getBookingWeekDates: vi.fn(),
}))

// Mock supabase/server
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { isDateInBookingWindow } from '@/lib/business-rules/booking-window'
import { createClient } from '@/lib/supabase/server'
import {
  getAvailableSlotsForDate,
  bookAppointment,
  cancelAppointment,
  getMyAppointments,
} from './appointments'

const mockIsDateInBookingWindow = vi.mocked(isDateInBookingWindow)
const mockCreateClient = vi.mocked(createClient)

function makeSupabaseClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAvailableSlotsForDate', () => {
  it('returns error when date is out of booking window', async () => {
    mockIsDateInBookingWindow.mockReturnValue(false)
    const mockClient = makeSupabaseClient()
    mockCreateClient.mockResolvedValue(mockClient as ReturnType<typeof makeSupabaseClient> as never)

    const result = await getAvailableSlotsForDate('2024-01-01', 'service-id-123')

    expect(result.error).toBeDefined()
    expect(result.slots).toBeUndefined()
  })
})

describe('bookAppointment', () => {
  it('returns error when user is not logged in', async () => {
    mockIsDateInBookingWindow.mockReturnValue(true)
    const mockClient = makeSupabaseClient({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    mockCreateClient.mockResolvedValue(mockClient as ReturnType<typeof makeSupabaseClient> as never)

    const result = await bookAppointment({
      service_id: 'service-id-123',
      date: '2025-05-19',
      start_time: '10:00',
    })

    expect(result.error).toBeDefined()
    expect(result.appointment).toBeUndefined()
  })

  it('returns error when date is out of booking window', async () => {
    mockIsDateInBookingWindow.mockReturnValue(false)
    const mockClient = makeSupabaseClient({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-id-123' } },
          error: null,
        }),
      },
    })
    mockCreateClient.mockResolvedValue(mockClient as ReturnType<typeof makeSupabaseClient> as never)

    const result = await bookAppointment({
      service_id: 'service-id-123',
      date: '2024-01-01',
      start_time: '10:00',
    })

    expect(result.error).toBeDefined()
    expect(result.appointment).toBeUndefined()
  })
})

describe('cancelAppointment', () => {
  it('returns error when user is not logged in', async () => {
    const mockClient = makeSupabaseClient({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    mockCreateClient.mockResolvedValue(mockClient as ReturnType<typeof makeSupabaseClient> as never)

    const result = await cancelAppointment('appointment-id-123')

    expect(result.error).toBeDefined()
  })
})

describe('getMyAppointments', () => {
  it('returns error when user is not logged in', async () => {
    const mockClient = makeSupabaseClient({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    mockCreateClient.mockResolvedValue(mockClient as ReturnType<typeof makeSupabaseClient> as never)

    const result = await getMyAppointments()

    expect(result.error).toBeDefined()
    expect(result.appointments).toBeUndefined()
  })
})
