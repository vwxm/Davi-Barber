'use client'

import { useState, useTransition } from 'react'
import type { Service, TimeSlot, Appointment } from '@/types'
import { getAvailableSlotsForDate, bookAppointment } from '@/actions/client/appointments'
import ServicePicker from './ServicePicker'
import DatePicker from './DatePicker'
import SlotPicker from './SlotPicker'
import { Button } from '@/components/ui/Button'

type Step = 'service' | 'date' | 'slot' | 'confirm'

interface BookingSectionProps {
  services: Service[]
  availableDates: string[]
}

export default function BookingSection({ services, availableDates }: BookingSectionProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [step, setStep] = useState<Step>('service')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [bookedAppointment, setBookedAppointment] = useState<Appointment | null>(null)

  const [loadingSlots, startLoadingSlots] = useTransition()
  const [booking, startBooking] = useTransition()

  function handleSelectService(service: Service) {
    setSelectedService(service)
    setSelectedDate(null)
    setSelectedSlot(null)
    setSlots([])
    setSlotsError(null)
    setBookingError(null)
    setStep('date')
  }

  function handleSelectDate(date: string) {
    if (!selectedService) return
    setSelectedDate(date)
    setSlotsError(null)
    setSelectedSlot(null)

    startLoadingSlots(async () => {
      const result = await getAvailableSlotsForDate(date, selectedService.id)
      if (result.error) {
        setSlotsError(result.error)
        // stay on date step
        return
      }
      setSlots(result.slots ?? [])
      setStep('slot')
    })
  }

  function handleSelectSlot(slot: TimeSlot) {
    setSelectedSlot(slot)
    setBookingError(null)
    setStep('confirm')
  }

  function handleBack() {
    if (step === 'confirm') {
      setStep('slot')
      setBookingError(null)
    } else if (step === 'slot') {
      setStep('date')
      setSelectedSlot(null)
      setSlotsError(null)
    } else if (step === 'date') {
      setStep('service')
      setSelectedDate(null)
      setSlots([])
      setSlotsError(null)
    }
  }

  function handleConfirm() {
    if (!selectedService || !selectedDate || !selectedSlot) return

    startBooking(async () => {
      const result = await bookAppointment({
        service_id: selectedService.id,
        date: selectedDate,
        start_time: selectedSlot.start,
      })
      if (result.error) {
        setBookingError(result.error)
        return
      }
      setBookedAppointment(result.appointment ?? null)
      setSuccess(true)
    })
  }

  if (success && bookedAppointment) {
    return (
      <div className="flex flex-col gap-6 items-center text-center py-8">
        <div className="bg-amber-500 rounded-full w-16 h-16 flex items-center justify-center text-black text-3xl">
          ✓
        </div>
        <div>
          <h2 className="text-white text-xl font-bold mb-1">Agendamento confirmado!</h2>
          <p className="text-zinc-400 text-sm">Guarde seu código de acesso</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4 w-full text-left flex flex-col gap-2">
          <p className="text-zinc-400 text-xs uppercase tracking-wide">Código de acesso</p>
          <p className="text-amber-500 text-2xl font-mono font-bold tracking-widest">
            {bookedAppointment.access_code}
          </p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4 w-full text-left flex flex-col gap-2">
          <p className="text-zinc-400 text-xs">Serviço</p>
          <p className="text-white font-medium">{selectedService?.name}</p>
          <p className="text-zinc-400 text-xs mt-1">Data e horário</p>
          <p className="text-white font-medium">
            {selectedDate} às {selectedSlot?.start}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {step !== 'service' && (
        <button
          type="button"
          onClick={handleBack}
          className="text-zinc-400 text-sm flex items-center gap-1 self-start active:opacity-70"
        >
          ← Voltar
        </button>
      )}

      {step === 'service' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-white font-semibold text-lg">Escolha o serviço</h2>
          <ServicePicker services={services} onSelect={handleSelectService} />
        </div>
      )}

      {step === 'date' && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Escolha a data</h2>
            <p className="text-zinc-400 text-sm">{selectedService?.name}</p>
          </div>
          <DatePicker
            dates={availableDates}
            onSelect={handleSelectDate}
            loading={loadingSlots}
            selectedDate={selectedDate}
          />
          {loadingSlots && (
            <p className="text-zinc-400 text-sm">Carregando horários...</p>
          )}
          {slotsError && (
            <p className="text-red-400 text-sm">{slotsError}</p>
          )}
        </div>
      )}

      {step === 'slot' && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Escolha o horário</h2>
            <p className="text-zinc-400 text-sm">
              {selectedService?.name} · {selectedDate}
            </p>
          </div>
          <SlotPicker slots={slots} onSelect={handleSelectSlot} error={slotsError} />
        </div>
      )}

      {step === 'confirm' && selectedService && selectedDate && selectedSlot && (
        <div className="flex flex-col gap-4">
          <h2 className="text-white font-semibold text-lg">Confirmar agendamento</h2>
          <div className="bg-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Serviço</span>
              <span className="text-white text-sm font-medium">{selectedService.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Data</span>
              <span className="text-white text-sm font-medium">{selectedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Horário</span>
              <span className="text-white text-sm font-medium">
                {selectedSlot.start} – {selectedSlot.end}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Valor</span>
              <span className="text-amber-500 text-sm font-semibold">
                {selectedService.price.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            </div>
          </div>
          {bookingError && (
            <p className="text-red-400 text-sm">{bookingError}</p>
          )}
          <Button variant="primary" loading={booking} onClick={handleConfirm}>
            Confirmar agendamento
          </Button>
        </div>
      )}
    </div>
  )
}
