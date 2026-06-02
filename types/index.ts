export type AppointmentStatus = 'scheduled' | 'completed' | 'canceled'
export type SyncStatus = 'pending' | 'synced' | 'error'

export interface Client {
  id: string
  name: string
  phone: string
  is_monthly: boolean
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  name: string
  price: number
  duration_minutes: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  client_id: string
  service_id: string
  date: string          // 'YYYY-MM-DD'
  start_time: string    // 'HH:MM'
  end_time: string      // 'HH:MM'
  status: AppointmentStatus
  access_code: string
  monthly_client_id: string | null
  google_event_id: string | null
  sync_status: SyncStatus
  sync_error: string | null
  created_at: string
  updated_at: string
  // joins opcionais
  client?: Client
  service?: Service
}

export interface MonthlyClient {
  id: string
  client_id: string
  service_id: string
  weekday: number       // 0=Dom, 1=Seg, ..., 6=Sáb
  start_time: string    // 'HH:MM'
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
  client?: Client
  service?: Service
}

export interface ScheduleBlock {
  id: string
  date: string          // 'YYYY-MM-DD' (início do período, ou data única)
  date_end: string | null // 'YYYY-MM-DD' fim do período (inclusivo); null = data única
  full_day: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface TimeSlot {
  start: string         // 'HH:MM'
  end: string           // 'HH:MM'
  available: boolean
}

export interface BookingInput {
  service_id: string
  date: string
  start_time: string
}

export interface BusinessHours {
  start: string
  end: string
  slotMinutes: number
  breaks: Array<{ start: string; end: string }>
  closedWeekdays: number[]
}
