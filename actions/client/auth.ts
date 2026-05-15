'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { phoneToEmail, isValidBrazilianPhone, normalizePhone } from '@/lib/business-rules/phone'

export async function registerClient(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const phone = formData.get('phone') as string
  const password = formData.get('password') as string

  if (!name || name.length < 2) {
    return { error: 'Nome deve ter pelo menos 2 caracteres.' }
  }
  if (!isValidBrazilianPhone(phone)) {
    return { error: 'Telefone inválido. Use formato: (11) 99999-9999' }
  }
  if (password.length < 8) {
    return { error: 'Senha deve ter pelo menos 8 caracteres.' }
  }

  const supabase = await createClient()
  const email = phoneToEmail(phone)
  const cleanPhone = normalizePhone(phone)

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone: cleanPhone },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'Telefone já cadastrado. Faça login.' }
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }

  redirect('/')
}

export async function loginClient(formData: FormData) {
  const phone = formData.get('phone') as string
  const password = formData.get('password') as string

  if (!isValidBrazilianPhone(phone)) {
    return { error: 'Telefone inválido.' }
  }

  const supabase = await createClient()
  const email = phoneToEmail(phone)

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Telefone ou senha incorretos.' }
  }

  redirect('/')
}

export async function logoutClient() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
