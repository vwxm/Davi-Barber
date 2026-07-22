export type AppointmentStatus = 'scheduled' | 'completed' | 'canceled' | 'no_show'

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
  client_id: string | null
  service_id: string
  guest_name?: string | null
  guest_phone?: string | null
  date: string          // 'YYYY-MM-DD'
  start_time: string    // 'HH:MM'
  end_time: string      // 'HH:MM'
  status: AppointmentStatus
  access_code: string
  monthly_client_id: string | null
  week_start: string | null   // 'YYYY-MM-DD' segunda da semana (linhas de mensalista)
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
  // 'bloqueio' = buraco no dia (vermelho); 'fechado' = horário removido do
  // expediente pela grade (cinza). Ambos escondem o slot dos clientes.
  kind: 'bloqueio' | 'fechado'
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
