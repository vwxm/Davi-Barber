import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s/g, '-')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={inputId}
        className="min-h-[44px] px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-white text-base
                   focus:outline-none focus:border-amber-500 placeholder:text-zinc-500"
        {...props}
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
