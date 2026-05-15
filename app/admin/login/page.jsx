'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function parseResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('Acesso exclusivo do barbeiro.');
  const [loading, setLoading] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('Validando acesso.');

    try {
      await parseResponse(await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      }));
      window.localStorage.setItem('davi-barber-admin-token', token);
      router.push('/admin');
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
            <small>Painel privado</small>
          </div>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Login administrativo</p>
          <h1>Entrar no painel</h1>
          <p>{message}</p>
        </div>

        <form className="login-form" onSubmit={submitLogin}>
          <label>
            Token de acesso
            <input
              autoFocus
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Digite o token administrativo"
              required
            />
          </label>
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
