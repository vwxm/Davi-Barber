'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from './DatePicker'
import SlotPicker from './SlotPicker'
import { Button } from '@/components/ui/Button'
import { getAvailableSlotsForDate, rescheduleAppointment } from '@/actions/client/appointments'
import type { TimeSlot } from '@/types'

interface RescheduleControlProps {
  appointmentId: string
  serviceId: string
  availableDates: string[]
  onClose: () => void
}

export function RescheduleControl({ appointmentId, serviceId, availableDates, onClose }: RescheduleControlProps) {
  const router = useRouter()
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingSlots, startLoad] = useTransition()
  const [saving, startSave] = useTransition()

  function selectDate(d: string) {
    setDate(d)
    setError(null)
    startLoad(async () => {
      const result = await getAvailableSlotsForDate(d, serviceId)
      if (result.error) {
        setError(result.error)
        setSlots([])
        return
      }
      setSlots(result.slots ?? [])
      setBlockReason(result.blockReason ?? null)
    })
  }

  function selectSlot(slot: TimeSlot) {
    if (!date) return
    startSave(async () => {
      const result = await rescheduleAppointment(appointmentId, date, slot.start)
      if (result.error) {
        setError(result.error)
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-3 space-y-3">
      <p className="text-sm text-zinc-300 font-medium">Nova data e horário</p>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <DatePicker dates={availableDates} onSelect={selectDate} loading={loadingSlots} selectedDate={date} />

      {date && loadingSlots && <p className="text-zinc-400 text-sm">Carregando horários...</p>}
      {date && !loadingSlots && (
        <SlotPicker slots={slots} onSelect={selectSlot} error={null} blockReason={blockReason} />
      )}

      <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
        Cancelar
      </Button>
    </div>
  )
}
