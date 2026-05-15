'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function parseResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
}

export default function ClientLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [message, setMessage] = useState('Entre para acessar a agenda.');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage(mode === 'login' ? 'Validando login.' : 'Criando cadastro.');

    try {
      const endpoint = mode === 'login' ? '/api/client/login' : '/api/client/register';
      const data = await parseResponse(await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      }));
      window.localStorage.setItem('davi-barber-client-token', data.token);
      window.localStorage.setItem('davi-barber-client-name', data.client.name);
      router.push('/');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="mark"><span></span><span></span><span></span></div>
          <div>
            <strong>Davi Barber</strong>
            <small>Area do cliente</small>
          </div>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Login do cliente</p>
          <h1>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
          <p>{message}</p>
        </div>

        <div className="mode-switch">
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>Entrar</button>
          <button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => setMode('register')}>Cadastrar</button>
        </div>

        <form className="login-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Nome
              <input
                autoFocus
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Seu nome"
                required
              />
            </label>
          )}
          <label>
            Telefone
            <input
              autoFocus={mode === 'login'}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Minimo 6 caracteres"
              required
            />
          </label>
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar e agendar' : 'Cadastrar e agendar'}
          </button>
        </form>
      </section>
    </main>
  );
}
