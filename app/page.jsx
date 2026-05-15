'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS } from '../lib/businessRules';

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(`${date}T00:00:00`));
}

async function parseResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
}

export default function Home() {
  const router = useRouter();
  const [clientToken, setClientToken] = useState('');
  const [client, setClient] = useState(null);
  const [services, setServices] = useState([]);
  const [week, setWeek] = useState({ monday: todayValue(), saturday: todayValue() });
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [message, setMessage] = useState('Carregando dados do sistema.');
  const [toast, setToast] = useState({ text: '', type: 'info' });
  const [confirmed, setConfirmed] = useState(null);
  const [booking, setBooking] = useState({
    serviceId: '',
    date: todayValue()
  });
  const [clientAppointments, setClientAppointments] = useState([]);
  const [reschedule, setReschedule] = useState({
    appointmentId: '',
    date: todayValue(),
    startTime: '',
    slots: []
  });
  const [busyAppointmentId, setBusyAppointmentId] = useState('');

  const selectedService = useMemo(
    () => services.find((service) => service.id === booking.serviceId),
    [services, booking.serviceId]
  );

  useEffect(() => {
    const token = window.localStorage.getItem('davi-barber-client-token') || '';
    if (!token) {
      router.replace('/login');
      return;
    }
    setClientToken(token);
    validateClient(token);
    loadClientAppointments(token);
    loadPublicData();
  }, []);

  useEffect(() => {
    if (booking.serviceId && booking.date) loadSlots();
  }, [booking.serviceId, booking.date]);

  useEffect(() => {
    if (!message) return;
    const type = /erro|falh|indispon|obrigatorio|login/i.test(message) ? 'error' : /confirm|cancel|reagend|liberad|carregado/i.test(message) ? 'success' : 'info';
    setToast({ text: message, type });
    const timer = window.setTimeout(() => setToast({ text: '', type: 'info' }), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function validateClient(token) {
    try {
      const data = await parseResponse(await fetch('/api/client/me', {
        headers: { Authorization: `Bearer ${token}` }
      }));
      setClient(data.client);
    } catch (error) {
      window.localStorage.removeItem('davi-barber-client-token');
      router.replace('/login');
    }
  }

  async function loadPublicData() {
    try {
      const data = await parseResponse(await fetch('/api/public-data'));
      setServices(data.services);
      setWeek(data.week);
      setBooking((current) => ({
        ...current,
        date: data.week.monday,
        serviceId: data.services[0]?.id || ''
      }));
      setMessage('Agendamentos liberados de hoje ate sabado da semana atual.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadSlots() {
    setSelectedSlot('');
    const params = new URLSearchParams({ date: booking.date, serviceId: booking.serviceId });
    try {
      const data = await parseResponse(await fetch(`/api/slots?${params}`));
      setSlots(data.slots);
      if (data.message) setMessage(data.message);
    } catch (error) {
      setSlots([]);
      setMessage(error.message);
    }
  }

  async function loadClientAppointments(token = clientToken) {
    try {
      const data = await parseResponse(await fetch('/api/client-appointments', {
        headers: { Authorization: `Bearer ${token}` }
      }));
      setClientAppointments(data.appointments);
    } catch (error) {
      if (error.message.includes('Login')) router.replace('/login');
      setMessage(error.message);
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!selectedSlot) {
      setMessage('Escolha um horario disponivel antes de confirmar.');
      return;
    }

    try {
      const data = await parseResponse(await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientToken}`
        },
        body: JSON.stringify({ ...booking, startTime: selectedSlot })
      }));
      setConfirmed(data.appointment);
      setMessage('Agendamento confirmado. O codigo fica salvo como comprovante.');
      await loadPublicData();
      await loadClientAppointments();
      await loadSlots();
    } catch (error) {
      if (error.message.includes('login')) router.replace('/login');
      setMessage(error.message);
    }
  }

  async function cancelAppointment(id) {
    try {
      setBusyAppointmentId(id);
      await parseResponse(await fetch(`/api/client-appointments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientToken}`
        },
        body: JSON.stringify({ action: 'cancel' })
      }));
      setMessage('Agendamento cancelado. O horario foi liberado.');
      setConfirmed(null);
      await loadClientAppointments();
      await loadSlots();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyAppointmentId('');
    }
  }

  async function startReschedule(appointment) {
    const nextState = {
      appointmentId: appointment.id,
      date: appointment.date,
      startTime: '',
      slots: []
    };
    setReschedule(nextState);
    await loadRescheduleSlots(appointment.id, appointment.date);
  }

  async function loadRescheduleSlots(appointmentId, date) {
    try {
      const params = new URLSearchParams({ date });
      const data = await parseResponse(await fetch(`/api/client-appointments/${appointmentId}?${params}`, {
        headers: { Authorization: `Bearer ${clientToken}` }
      }));
      setReschedule((current) => ({
        ...current,
        appointmentId,
        date,
        startTime: '',
        slots: data.slots
      }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitReschedule(event) {
    event.preventDefault();
    if (!reschedule.appointmentId || !reschedule.startTime) {
      setMessage('Escolha o novo horario.');
      return;
    }

    try {
      setBusyAppointmentId(reschedule.appointmentId);
      await parseResponse(await fetch(`/api/client-appointments/${reschedule.appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientToken}`
        },
        body: JSON.stringify({
          action: 'reschedule',
          date: reschedule.date,
          startTime: reschedule.startTime
        })
      }));
      setMessage('Agendamento reagendado.');
      setReschedule({ appointmentId: '', date: todayValue(), startTime: '', slots: [] });
      await loadClientAppointments();
      await loadSlots();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyAppointmentId('');
    }
  }

  function logout() {
    window.localStorage.removeItem('davi-barber-client-token');
    window.localStorage.removeItem('davi-barber-client-name');
    router.replace('/login');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark"><span></span><span></span><span></span></div>
          <div>
            <strong>Davi Barber</strong>
            <small>{client ? client.name : 'Area do cliente'}</small>
          </div>
        </div>
        <button className="text-action" type="button" onClick={logout}>Sair</button>
      </header>

      <section className="hero client-hero">
        <div>
          <p className="eyebrow">Area do cliente</p>
          <h1>Escolha e acompanhe seus horarios.</h1>
        </div>
      </section>

      <section className="notice">{message}</section>
      {toast.text && <div className={`toast ${toast.type}`} role="status">{toast.text}</div>}

      <section className="view active">
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Novo horario</p>
              <h2>Agendar atendimento</h2>
            </div>
            <span className="badge">{formatDate(week.monday)} - {formatDate(week.saturday)}</span>
          </div>

          <form className="grid-form" onSubmit={submitBooking}>
            <label>
              Servico
              <select value={booking.serviceId} onChange={(event) => setBooking({ ...booking, serviceId: event.target.value })} required>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.duration_minutes} min · R$ {Number(service.price).toFixed(0)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data
              <input type="date" value={booking.date} min={week.monday} max={week.saturday} onChange={(event) => setBooking({ ...booking, date: event.target.value })} required />
            </label>
            <div className="slots-block full">
              <div className="slots-head">
                <span>Horarios disponiveis</span>
                <small>{selectedService ? `${selectedService.duration_minutes} minutos` : ''}</small>
              </div>
              <div className="slots">
                {slots.length ? slots.map((slot) => (
                  <button key={slot} type="button" className={`slot ${selectedSlot === slot ? 'selected' : ''}`} onClick={() => setSelectedSlot(slot)}>
                    {slot}
                  </button>
                )) : <div className="empty-state">Nenhum horario disponivel.</div>}
              </div>
            </div>
            <button className="primary-action full" type="submit">Confirmar agendamento</button>
          </form>
        </div>

        <aside className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Meus horarios</p>
              <h2>Agendamentos</h2>
            </div>
            <button className="ghost-action" type="button" onClick={() => loadClientAppointments()}>Atualizar</button>
          </div>

          {confirmed && (
            <div className="access-card">
              <span>Codigo do agendamento</span>
              <strong>{confirmed.access_code}</strong>
              <small>{formatDate(confirmed.date)} as {confirmed.start_time.slice(0, 5)} · {confirmed.service_name}</small>
            </div>
          )}

          <div className="mini-list client-results">
            {clientAppointments.length ? clientAppointments.map((appointment) => (
              <div className="mini-card" key={appointment.id}>
                <strong>{formatDate(appointment.date)} as {appointment.start_time.slice(0, 5)}</strong>
                <span>{appointment.service_name} · {appointment.service_duration} min · {STATUS_LABELS[appointment.status]}</span>
                <small>Codigo: {appointment.access_code}</small>
                <div className="client-actions">
                  <button className="ghost-action" type="button" disabled={busyAppointmentId === appointment.id} onClick={() => startReschedule(appointment)}>Reagendar</button>
                  <button className="danger-action" type="button" disabled={busyAppointmentId === appointment.id} onClick={() => cancelAppointment(appointment.id)}>Cancelar</button>
                </div>
                {reschedule.appointmentId === appointment.id && (
                  <form className="reschedule-form" onSubmit={submitReschedule}>
                    <input
                      type="date"
                      min={week.monday}
                      max={week.saturday}
                      value={reschedule.date}
                      onChange={(event) => loadRescheduleSlots(appointment.id, event.target.value)}
                      required
                    />
                    <div className="slots compact-slots">
                      {reschedule.slots.length ? reschedule.slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={`slot ${reschedule.startTime === slot ? 'selected' : ''}`}
                          onClick={() => setReschedule((current) => ({ ...current, startTime: slot }))}
                        >
                          {slot}
                        </button>
                      )) : <div className="empty-state">Sem horarios nessa data.</div>}
                    </div>
                    <div className="client-actions">
                      <button className="primary-action" type="submit" disabled={busyAppointmentId === appointment.id}>Salvar novo horario</button>
                      <button className="ghost-action" type="button" onClick={() => setReschedule({ appointmentId: '', date: todayValue(), startTime: '', slots: [] })}>Fechar</button>
                    </div>
                  </form>
                )}
              </div>
            )) : <div className="empty-state">Voce ainda nao tem agendamentos.</div>}
          </div>
        </aside>
      </section>
    </main>
  );
}
