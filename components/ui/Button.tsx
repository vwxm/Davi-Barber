import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, className = '', ...props }: ButtonProps) {
  const base = 'min-h-[44px] px-4 py-2 rounded-lg font-medium text-base transition-colors disabled:opacity-50 w-full'
  const variants = {
    primary: 'bg-amber-500 hover:bg-amber-600 text-white',
    secondary: 'bg-zinc-700 hover:bg-zinc-600 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? 'Aguarde...' : children}
    </button>
  )
}
