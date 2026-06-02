'use client'

import type { TimeSlot } from '@/types'

interface SlotPickerProps {
  slots: TimeSlot[]
  onSelect: (slot: TimeSlot) => void
  error: string | null
  blockReason?: string | null
}

export default function SlotPicker({ slots, onSelect, error, blockReason }: SlotPickerProps) {
  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>
  }

  const availableCount = slots.filter((s) => s.available).length

  if (availableCount === 0) {
    if (blockReason) {
      return (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3">
          <p className="text-amber-400 text-sm font-medium">Sem atendimento nesta data</p>
          <p className="text-amber-200/80 text-sm mt-1">{blockReason}</p>
        </div>
      )
    }
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
