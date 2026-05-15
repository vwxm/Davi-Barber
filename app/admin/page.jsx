'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS } from '../../lib/businessRules';

const MODULES = [
  ['agenda', 'Agenda'],
  ['manual', 'Marcar cliente'],
  ['blocks', 'Bloqueios'],
  ['services', 'Servicos'],
  ['monthly', 'Mensalistas'],
  ['integrations', 'Integracoes']
];

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

export default function AdminPage() {
  const router = useRouter();
  const [activeModule, setActiveModule] = useState('agenda');
  const [message, setMessage] = useState('Carregando painel administrativo.');
  const [toast, setToast] = useState({ text: '', type: 'info' });
  const [adminToken, setAdminToken] = useState('');
  const [adminDate, setAdminDate] = useState(todayValue());
  const [week, setWeek] = useState({ monday: todayValue(), saturday: todayValue() });
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showMonthlyForm, setShowMonthlyForm] = useState(false);
  const [editingMonthly, setEditingMonthly] = useState(null);
  const [adminData, setAdminData] = useState({ appointments: [], services: [], monthlyClients: [], blocks: [] });
  const [newService, setNewService] = useState({ name: '', price: '', durationMinutes: '' });
  const [editingService, setEditingService] = useState(null);
  const [manualAppointment, setManualAppointment] = useState({ name: '', phone: '', serviceId: '', date: todayValue(), startTime: '' });
  const [manualSlots, setManualSlots] = useState([]);
  const [reschedule, setReschedule] = useState({ appointmentId: '', date: todayValue(), startTime: '', slots: [] });
  const [monthlyClient, setMonthlyClient] = useState({ name: '', phone: '', notes: '', serviceId: '', weekday: '1', startTime: '09:00' });
  const [block, setBlock] = useState({ startDate: todayValue(), endDate: todayValue(), fullDay: true, startTime: '09:00', endTime: '19:00', reason: '' });

  useEffect(() => {
    const savedToken = window.localStorage.getItem('davi-barber-admin-token') || '';
    if (!savedToken) {
      router.replace('/admin/login');
      return;
    }
    setAdminToken(savedToken);
    loadAdmin(savedToken);
  }, []);

  useEffect(() => {
    if (!message) return;
    const type = /falh|erro|negado|invalid|indispon/i.test(message) ? 'error' : /carregado|conectado|cadastr|criad|cancel|conclu|salv|reagend/i.test(message) ? 'success' : 'info';
    setToast({ text: message, type });
    const timer = window.setTimeout(() => setToast({ text: '', type: 'info' }), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (adminToken && manualAppointment.date && manualAppointment.serviceId) {
      loadManualSlots(manualAppointment.date, manualAppointment.serviceId);
    }
  }, [adminToken, manualAppointment.date, manualAppointment.serviceId]);

  async function loadAdmin(token = adminToken) {
    try {
      const data = await parseResponse(await fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } }));
      window.localStorage.setItem('davi-barber-admin-token', token);
      setAdminData(data);
      setWeek(data.week);
      setAdminDate((current) => current && current >= todayValue() ? current : todayValue());
      setBlock((current) => ({ ...current, startDate: todayValue(), endDate: todayValue() }));
      setManualAppointment((current) => ({ ...current, date: current.date && current.date >= todayValue() ? current.date : todayValue(), serviceId: current.serviceId || data.services[0]?.id || '' }));
      setMonthlyClient((current) => ({ ...current, serviceId: current.serviceId || data.services[0]?.id || '' }));
      setMessage('Painel administrativo carregado.');
    } catch (error) {
      if (token) window.localStorage.removeItem('davi-barber-admin-token');
      setMessage(error.message);
      router.replace('/admin/login');
    }
  }

  function logout() {
    window.localStorage.removeItem('davi-barber-admin-token');
    router.replace('/admin/login');
  }

  async function loadManualSlots(date, serviceId) {
    try {
      const params = new URLSearchParams({ date, serviceId });
      const data = await parseResponse(await fetch(`/api/admin/slots?${params}`, { headers: { Authorization: `Bearer ${adminToken}` } }));
      setManualSlots(data.slots);
      setManualAppointment((current) => ({ ...current, startTime: data.slots.includes(current.startTime) ? current.startTime : '' }));
    } catch (error) {
      setManualSlots([]);
      setMessage(error.message);
    }
  }

  async function startReschedule(appointment) {
    setReschedule({ appointmentId: appointment.id, date: appointment.date, startTime: '', slots: [] });
    await loadRescheduleSlots(appointment.id, appointment.date);
  }

  async function loadRescheduleSlots(appointmentId, date) {
    try {
      const params = new URLSearchParams({ appointmentId, date });
      const data = await parseResponse(await fetch(`/api/admin/slots?${params}`, { headers: { Authorization: `Bearer ${adminToken}` } }));
      setReschedule((current) => ({ ...current, appointmentId, date, startTime: '', slots: data.slots }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitReschedule(event) {
    event.preventDefault();
    if (!reschedule.startTime) {
      setMessage('Escolha o novo horario.');
      return;
    }
    await adminPatch(`/api/admin/appointments/${reschedule.appointmentId}`, {
      action: 'reschedule',
      date: reschedule.date,
      startTime: reschedule.startTime
    });
    setReschedule({ appointmentId: '', date: todayValue(), startTime: '', slots: [] });
  }

  async function submitService(event) {
    event.preventDefault();
    await adminPost('/api/admin/services', newService);
    setNewService({ name: '', price: '', durationMinutes: '' });
    setShowServiceForm(false);
  }

  async function submitServiceEdit(event) {
    event.preventDefault();
    if (!editingService) return;
    await adminPatch(`/api/admin/services/${editingService.id}`, editingService);
    setEditingService(null);
  }

  async function submitManualAppointment(event) {
    event.preventDefault();
    if (!manualAppointment.startTime) {
      setMessage('Escolha um horario disponivel.');
      return;
    }
    await adminPost('/api/admin/appointments', manualAppointment);
    setManualAppointment((current) => ({ ...current, name: '', phone: '', startTime: '' }));
    await loadManualSlots(manualAppointment.date, manualAppointment.serviceId);
  }

  async function submitMonthlyClient(event) {
    event.preventDefault();
    await adminPost('/api/admin/monthly-clients', monthlyClient);
    setMonthlyClient((current) => ({ ...current, name: '', phone: '', notes: '' }));
    setShowMonthlyForm(false);
  }

  async function submitMonthlyEdit(event) {
    event.preventDefault();
    if (!editingMonthly) return;
    await adminPatch(`/api/admin/monthly-clients/${editingMonthly.id}`, editingMonthly);
    setEditingMonthly(null);
  }

  async function removeMonthlyClient(id) {
    try {
      await parseResponse(await fetch(`/api/admin/monthly-clients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      }));
      await loadAdmin();
      setMessage('Mensalista removido e horarios futuros cancelados.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitBlock(event) {
    event.preventDefault();
    await adminPost('/api/admin/blocks', block);
  }

  async function updateAppointmentStatus(id, status) {
    await adminPatch(`/api/admin/appointments/${id}`, { status });
  }

  async function testGoogleCalendar() {
    try {
      const data = await parseResponse(await fetch('/api/admin/google-calendar/status', { headers: { Authorization: `Bearer ${adminToken}` } }));
      setMessage(`Google Agenda conectado: ${data.calendar.summary}`);
    } catch (error) {
      setMessage(`Google Agenda falhou: ${error.message}`);
    }
  }

  async function adminPost(url, payload) {
    try {
      const data = await parseResponse(await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(payload)
      }));
      await loadAdmin();
      if (url === '/api/admin/monthly-clients') {
        const created = data.created?.length || 0;
        const skipped = data.skipped?.length || 0;
        if (data.created?.[0]?.date) {
          setAdminDate(data.created[0].date);
          setActiveModule('agenda');
        }
        const details = data.skipped?.length ? ` Conflitos: ${data.skipped.map((item) => `${item.date} ${item.startTime || ''}`).join(', ')}.` : '';
        setMessage(`Mensalista salvo. ${created} horario(s) criado(s)/vinculado(s), ${skipped} conflito(s).${details}`);
      } else {
        setMessage('Alteracao salva.');
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function adminPatch(url, payload) {
    try {
      const data = await parseResponse(await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(payload)
      }));
      await loadAdmin();
      if (url.includes('/api/admin/monthly-clients/')) {
        const created = data.created?.length || 0;
        const skipped = data.skipped?.length || 0;
        if (data.created?.[0]?.date) {
          setAdminDate(data.created[0].date);
          setActiveModule('agenda');
        }
        const details = data.skipped?.length ? ` Conflitos: ${data.skipped.map((item) => `${item.date} ${item.startTime || ''}`).join(', ')}.` : '';
        setMessage(`Mensalista atualizado. ${created} horario(s) criado(s)/vinculado(s), ${skipped} conflito(s).${details}`);
      } else {
        setMessage('Alteracao salva.');
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  const filteredAppointments = adminData.appointments.filter((appointment) => appointment.date === adminDate);
  const activeServices = adminData.services.filter((service) => service.active);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark"><span></span><span></span><span></span></div>
          <div>
            <strong>Davi Barber</strong>
            <small>Painel admin</small>
          </div>
        </div>
        <button className="text-action" type="button" onClick={logout}>Sair</button>
      </header>

      <section className="hero admin-hero">
        <div>
          <p className="eyebrow">Administracao</p>
          <h1>Controle operacional da agenda.</h1>
        </div>
      </section>

      <section className="notice">{message}</section>
      {toast.text && <div className={`toast ${toast.type}`} role="status">{toast.text}</div>}

      <nav className="admin-module-nav" aria-label="Modulos do painel">
        {MODULES.map(([id, label]) => (
          <button key={id} className={activeModule === id ? 'active' : ''} type="button" onClick={() => setActiveModule(id)}>
            {label}
          </button>
        ))}
      </nav>

      <section className="admin-module-shell">
        {activeModule === 'agenda' && (
          <div className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Agenda</p>
                <h2>Agenda do dia</h2>
              </div>
              <input type="date" value={adminDate} min={todayValue()} onChange={(event) => setAdminDate(event.target.value)} />
            </div>
            <div className="timeline">
              {filteredAppointments.length ? filteredAppointments.map((appointment) => (
                <div className="timeline-row" key={appointment.id}>
                  <div className="time-chip">{appointment.start_time.slice(0, 5)}</div>
                  <div>
                    <strong>{appointment.client_name}</strong>
                    <span>{appointment.client_phone} · {appointment.service_name} · {appointment.service_duration} min · {STATUS_LABELS[appointment.status]} · Google: {appointment.sync_status === 'synced' ? 'sincronizado' : appointment.sync_status === 'google_error' ? 'erro' : 'pendente'}</span>
                  </div>
                  <div className="actions">
                    <button className="ghost-action" onClick={() => startReschedule(appointment)}>Reagendar</button>
                    <button className="ghost-action" onClick={() => updateAppointmentStatus(appointment.id, 'completed')}>Concluir</button>
                    <button className="danger-action" onClick={() => updateAppointmentStatus(appointment.id, 'canceled')}>Cancelar</button>
                  </div>
                  {reschedule.appointmentId === appointment.id && (
                    <form className="reschedule-form timeline-reschedule" onSubmit={submitReschedule}>
                      <input
                        type="date"
                        min={todayValue()}
                        value={reschedule.date}
                        onChange={(event) => loadRescheduleSlots(appointment.id, event.target.value)}
                        required
                      />
                      <div className="slots compact-slots">
                        {reschedule.slots.length ? reschedule.slots.map((slot) => (
                          <button key={slot} type="button" className={`slot ${reschedule.startTime === slot ? 'selected' : ''}`} onClick={() => setReschedule((current) => ({ ...current, startTime: slot }))}>
                            {slot}
                          </button>
                        )) : <div className="empty-state">Sem horarios nessa data.</div>}
                      </div>
                      <div className="client-actions">
                        <button className="primary-action" type="submit">Salvar novo horario</button>
                        <button className="ghost-action" type="button" onClick={() => setReschedule({ appointmentId: '', date: todayValue(), startTime: '', slots: [] })}>Fechar</button>
                      </div>
                    </form>
                  )}
                </div>
              )) : <div className="empty-state">Nenhum agendamento para esta data.</div>}
            </div>
          </div>
        )}

        {activeModule === 'manual' && (
          <div className="panel module-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Manual</p>
                <h2>Marcar cliente</h2>
              </div>
            </div>
            <form className="grid-form" onSubmit={submitManualAppointment}>
              <input value={manualAppointment.name} onChange={(event) => setManualAppointment({ ...manualAppointment, name: event.target.value })} placeholder="Nome do cliente" required />
              <input value={manualAppointment.phone} onChange={(event) => setManualAppointment({ ...manualAppointment, phone: event.target.value })} inputMode="tel" placeholder="Telefone" required />
              <select value={manualAppointment.serviceId} onChange={(event) => setManualAppointment({ ...manualAppointment, serviceId: event.target.value, startTime: '' })} required>
                {activeServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}
              </select>
              <input type="date" min={todayValue()} value={manualAppointment.date} onChange={(event) => setManualAppointment({ ...manualAppointment, date: event.target.value, startTime: '' })} required />
              <div className="slots-block full">
                <div className="slots-head"><span>Horarios disponiveis</span></div>
                <div className="slots">
                  {manualSlots.length ? manualSlots.map((slot) => (
                    <button key={slot} type="button" className={`slot ${manualAppointment.startTime === slot ? 'selected' : ''}`} onClick={() => setManualAppointment({ ...manualAppointment, startTime: slot })}>
                      {slot}
                    </button>
                  )) : <div className="empty-state">Nenhum horario disponivel.</div>}
                </div>
              </div>
              <button className="primary-action full" type="submit">Criar agendamento</button>
            </form>
          </div>
        )}

        {activeModule === 'blocks' && (
          <div className="panel module-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Bloqueios</p>
                <h2>Travar agenda</h2>
              </div>
              <span className="badge">Periodo</span>
            </div>
            <form className="lock-form" onSubmit={submitBlock}>
              <input type="date" min={todayValue()} value={block.startDate} onChange={(event) => setBlock({ ...block, startDate: event.target.value, endDate: block.endDate < event.target.value ? event.target.value : block.endDate })} required />
              <input type="date" min={block.startDate} value={block.endDate} onChange={(event) => setBlock({ ...block, endDate: event.target.value })} required />
              <select value={block.fullDay ? 'day' : 'hours'} onChange={(event) => setBlock({ ...block, fullDay: event.target.value === 'day' })}>
                <option value="day">Dia inteiro</option>
                <option value="hours">Horario especifico</option>
              </select>
              <input value={block.reason} onChange={(event) => setBlock({ ...block, reason: event.target.value })} placeholder="Motivo" />
              {!block.fullDay && (
                <>
                  <input type="time" value={block.startTime} onChange={(event) => setBlock({ ...block, startTime: event.target.value })} />
                  <input type="time" value={block.endTime} onChange={(event) => setBlock({ ...block, endTime: event.target.value })} />
                </>
              )}
              <button className="primary-action wide" type="submit">Criar bloqueio</button>
            </form>
            <div className="lock-list">
              {adminData.blocks.length ? adminData.blocks.map((item) => (
                <div className="lock-row" key={item.id}>
                  <div>
                    <strong>{formatDate(item.date)}</strong>
                    <span>{item.full_day ? 'Dia inteiro' : `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}`} · {item.reason || 'Sem motivo informado'}</span>
                  </div>
                </div>
              )) : <div className="empty-state">Nenhum bloqueio cadastrado.</div>}
            </div>
          </div>
        )}

        {activeModule === 'services' && (
          <div className="panel module-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Servicos</p>
                <h2>Catalogo</h2>
              </div>
              <button className="secondary-action compact-button" type="button" onClick={() => setShowServiceForm((current) => !current)}>
                {showServiceForm ? 'Fechar' : 'Adicionar'}
              </button>
            </div>
            {showServiceForm && (
              <form className="compact-form module-form" onSubmit={submitService}>
                <input value={newService.name} onChange={(event) => setNewService({ ...newService, name: event.target.value })} placeholder="Servico" required />
                <input value={newService.price} onChange={(event) => setNewService({ ...newService, price: event.target.value })} type="number" min="0" placeholder="Preco" required />
                <input value={newService.durationMinutes} onChange={(event) => setNewService({ ...newService, durationMinutes: event.target.value })} type="number" min="15" step="15" placeholder="Min" required />
                <button className="primary-action wide" type="submit">Adicionar servico</button>
              </form>
            )}
            <div className="service-list">
              {editingService && (
                <form className="compact-form" onSubmit={submitServiceEdit}>
                  <input value={editingService.name} onChange={(event) => setEditingService({ ...editingService, name: event.target.value })} placeholder="Servico" required />
                  <input value={editingService.price} onChange={(event) => setEditingService({ ...editingService, price: event.target.value })} type="number" min="0" placeholder="Preco" required />
                  <input value={editingService.durationMinutes} onChange={(event) => setEditingService({ ...editingService, durationMinutes: event.target.value })} type="number" min="15" step="15" placeholder="Min" required />
                  <button className="primary-action wide" type="submit">Salvar alteracoes</button>
                  <button className="secondary-action wide" type="button" onClick={() => setEditingService(null)}>Cancelar edicao</button>
                </form>
              )}
              {adminData.services.length ? adminData.services.map((service) => (
                <div className="service-row" key={service.id}>
                  <div>
                    <strong>{service.name}</strong>
                    <span>{service.duration_minutes} min · R$ {Number(service.price).toFixed(0)}</span>
                  </div>
                  <button className="ghost-action" type="button" onClick={() => setEditingService({ id: service.id, name: service.name, price: service.price, durationMinutes: service.duration_minutes, active: service.active })}>Editar</button>
                </div>
              )) : <div className="empty-state">Nenhum servico cadastrado.</div>}
            </div>
          </div>
        )}

        {activeModule === 'monthly' && (
          <div className="panel module-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Mensalistas</p>
                <h2>Clientes mensais</h2>
              </div>
              <button className="secondary-action compact-button" type="button" onClick={() => setShowMonthlyForm((current) => !current)}>
                {showMonthlyForm ? 'Fechar' : 'Cadastrar'}
              </button>
            </div>
            {showMonthlyForm && (
              <form className="grid-form module-form" onSubmit={submitMonthlyClient}>
                <input value={monthlyClient.name} onChange={(event) => setMonthlyClient({ ...monthlyClient, name: event.target.value })} placeholder="Nome" required />
                <input value={monthlyClient.phone} onChange={(event) => setMonthlyClient({ ...monthlyClient, phone: event.target.value })} inputMode="tel" placeholder="Telefone" required />
                <select value={monthlyClient.serviceId} onChange={(event) => setMonthlyClient({ ...monthlyClient, serviceId: event.target.value })} required>
                  {activeServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}
                </select>
                <select value={monthlyClient.weekday} onChange={(event) => setMonthlyClient({ ...monthlyClient, weekday: event.target.value })} required>
                  <option value="1">Segunda</option>
                  <option value="2">Terca</option>
                  <option value="3">Quarta</option>
                  <option value="4">Quinta</option>
                  <option value="5">Sexta</option>
                  <option value="6">Sabado</option>
                </select>
                <input type="time" step="1800" value={monthlyClient.startTime} onChange={(event) => setMonthlyClient({ ...monthlyClient, startTime: event.target.value })} required />
                <input value={monthlyClient.notes} onChange={(event) => setMonthlyClient({ ...monthlyClient, notes: event.target.value })} placeholder="Observacoes" />
                <button className="primary-action full" type="submit">Cadastrar e gerar mes</button>
              </form>
            )}
            <div className="monthly-list client-results">
              {editingMonthly && (
                <form className="grid-form module-form" onSubmit={submitMonthlyEdit}>
                  <input value={editingMonthly.name} onChange={(event) => setEditingMonthly({ ...editingMonthly, name: event.target.value })} placeholder="Nome" required />
                  <input value={editingMonthly.phone} onChange={(event) => setEditingMonthly({ ...editingMonthly, phone: event.target.value })} inputMode="tel" placeholder="Telefone" required />
                  <select value={editingMonthly.serviceId} onChange={(event) => setEditingMonthly({ ...editingMonthly, serviceId: event.target.value })} required>
                    {activeServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}
                  </select>
                  <select value={editingMonthly.weekday} onChange={(event) => setEditingMonthly({ ...editingMonthly, weekday: event.target.value })} required>
                    <option value="1">Segunda</option>
                    <option value="2">Terca</option>
                    <option value="3">Quarta</option>
                    <option value="4">Quinta</option>
                    <option value="5">Sexta</option>
                    <option value="6">Sabado</option>
                  </select>
                  <input type="time" step="1800" value={editingMonthly.startTime} onChange={(event) => setEditingMonthly({ ...editingMonthly, startTime: event.target.value })} required />
                  <input value={editingMonthly.notes} onChange={(event) => setEditingMonthly({ ...editingMonthly, notes: event.target.value })} placeholder="Observacoes" />
                  <button className="primary-action full" type="submit">Salvar e regerar mes</button>
                  <button className="secondary-action full" type="button" onClick={() => setEditingMonthly(null)}>Cancelar edicao</button>
                </form>
              )}
              {adminData.monthlyClients.length ? adminData.monthlyClients.map((client) => (
                <div className="monthly-row" key={client.id}>
                  <div>
                    <strong>{client.name}</strong>
                    <span>{client.phone} · {client.service_name || 'Servico nao definido'} · {client.start_time ? client.start_time.slice(0, 5) : 'Horario nao definido'} · {client.notes || 'Sem observacoes'}</span>
                  </div>
                  <div className="actions">
                    <button className="ghost-action" type="button" onClick={() => setEditingMonthly({
                      id: client.id,
                      name: client.name,
                      phone: client.phone,
                      notes: client.notes || '',
                      serviceId: client.service_id || activeServices[0]?.id || '',
                      weekday: String(client.weekday ?? '1'),
                      startTime: client.start_time ? client.start_time.slice(0, 5) : '09:00'
                    })}>Editar</button>
                    <button className="danger-action" type="button" onClick={() => removeMonthlyClient(client.id)}>Remover</button>
                  </div>
                </div>
              )) : <div className="empty-state">Nenhum mensalista cadastrado.</div>}
            </div>
          </div>
        )}

        {activeModule === 'integrations' && (
          <div className="panel module-panel">
            <p className="eyebrow">Integracoes</p>
            <h2>Google Agenda</h2>
            <button className="secondary-action calendar-test-action" type="button" onClick={testGoogleCalendar}>Testar conexao</button>
          </div>
        )}
      </section>
    </main>
  );
}
