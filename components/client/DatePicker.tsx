'use client'

import { getBookingWeekDates } from '@/lib/business-rules/booking-window'

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface DatePickerProps {
  onSelect: (date: string) => void
  loading: boolean
  selectedDate: string | null
}

export default function DatePicker({ onSelect, loading, selectedDate }: DatePickerProps) {
  const dates = getBookingWeekDates()

  return (
    <div className="flex gap-2 flex-wrap">
      {dates.map((date) => {
        const d = new Date(date + 'T12:00:00Z')
        const dayName = DAYS_PT[d.getUTCDay()]
        const dayNumber = d.getUTCDate()
        const isSelected = date === selectedDate

        return (
          <button
            key={date}
            onClick={() => onSelect(date)}
            disabled={loading}
            className={`rounded-xl p-3 text-center min-w-[60px] transition-colors ${
              isSelected
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-800 text-white'
            } disabled:opacity-50`}
          >
            <p className="text-xs font-medium">{dayName}</p>
            <p className="text-lg font-bold">{dayNumber}</p>
          </button>
        )
      })}
    </div>
  )
}
