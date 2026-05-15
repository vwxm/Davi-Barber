'use client'

import type { Service } from '@/types'

interface ServicePickerProps {
  services: Service[]
  onSelect: (service: Service) => void
}

export default function ServicePicker({ services, onSelect }: ServicePickerProps) {
  return (
    <div className="flex flex-col gap-3">
      {services.map((service) => (
        <button
          key={service.id}
          type="button"
          onClick={() => onSelect(service)}
          className="bg-zinc-800 rounded-xl p-4 flex justify-between items-center cursor-pointer active:opacity-70 text-left w-full"
        >
          <div>
            <p className="text-white font-medium">{service.name}</p>
            <p className="text-zinc-400 text-sm">{service.duration_minutes} min</p>
          </div>
          <p className="text-amber-500 font-semibold">
            {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </button>
      ))}
    </div>
  )
}
