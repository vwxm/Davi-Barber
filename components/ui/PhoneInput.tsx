'use client'

import { useState } from 'react'
import { Input } from './Input'
import { formatPhoneInput } from '@/lib/business-rules/phone'

interface PhoneInputProps {
  label?: string
  name?: string
  required?: boolean
}

// Controlled phone field with a progressive Brazilian mask. The masked value is
// submitted as-is; server actions normalize it, so the mask is purely UX.
export function PhoneInput({ label = 'Telefone', name = 'phone', required }: PhoneInputProps) {
  const [value, setValue] = useState('')
  return (
    <Input
      label={label}
      name={name}
      type="tel"
      inputMode="numeric"
      placeholder="(11) 99999-9999"
      value={value}
      onChange={(e) => setValue(formatPhoneInput(e.target.value))}
      required={required}
    />
  )
}
