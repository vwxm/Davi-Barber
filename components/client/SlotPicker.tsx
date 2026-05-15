'use client'

import type { TimeSlot } from '@/types'

interface SlotPickerProps {
  slots: TimeSlot[]
  onSelect: (slot: TimeSlot) => void
  error: string | null
}

export default function SlotPicker({ slots, onSelect, error }: SlotPickerProps) {
  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>
  }

  const availableCount = slots.filter((s) => s.available).length

  if (availableCount === 0) {
    return <p className="text-zinc-400 text-sm">Nenhum horário disponível nesta data.</p>
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => (
        <button
          key={slot.start}
          type="button"
          onClick={() => slot.available ? onSelect(slot) : undefined}
          disabled={!slot.available}
          aria-label={slot.available ? `${slot.start}` : `${slot.start} indisponível`}
          className={`rounded-lg py-3 text-sm font-medium ${
            slot.available
              ? 'bg-zinc-800 text-white hover:bg-zinc-700'
              : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {slot.start}
        </button>
      ))}
    </div>
  )
}
