const DEFAULT_SERVICES = [
  { id: 'corte', name: 'Corte', price: 35, duration_minutes: 30, active: true },
  { id: 'barba', name: 'Barba', price: 25, duration_minutes: 30, active: true },
  { id: 'corte-barba', name: 'Corte + barba', price: 55, duration_minutes: 60, active: true },
  { id: 'corte-penteado', name: 'Corte com penteado', price: 65, duration_minutes: 60, active: true }
];

const BUSINESS_HOURS = {
  start: '09:00',
  end: '19:00',
  slotMinutes: 30,
  breaks: [{ start: '12:00', end: '13:00' }],
  closedWeekdays: [0]
};

const STATUS_LABELS = {
  scheduled: 'Agendado',
  completed: 'Concluído',
  canceled: 'Cancelado'
};

const state = {
  services: [],
  clients: [],
  appointments: [],
  selectedSlot: '',
  supabase: null,
  useSupabase: false
};

const els = {
  tabs: document.querySelectorAll('.tab'),
  views: {
    client: document.querySelector('#clientView'),
    admin: document.querySelector('#adminView')
  },
  storageStatus: document.querySelector('#storageStatus'),
  todayCount: document.querySelector('#todayCount'),
  clientCount: document.querySelector('#clientCount'),
  serviceCount: document.querySelector('#serviceCount'),
  bookingForm: document.querySelector('#bookingForm'),
  clientName: document.querySelector('#clientName'),
  clientPhone: document.querySelector('#clientPhone'),
  serviceSelect: document.querySelector('#serviceSelect'),
  dateInput: document.querySelector('#dateInput'),
  durationHint: document.querySelector('#durationHint'),
  slots: document.querySelector('#slots'),
  selectedTime: document.querySelector('#selectedTime'),
  lookupForm: document.querySelector('#lookupForm'),
  lookupPhone: document.querySelector('#lookupPhone'),
  clientAppointments: document.querySelector('#clientAppointments'),
  adminDate: document.querySelector('#adminDate'),
  adminTimeline: document.querySelector('#adminTimeline'),
  serviceForm: document.querySelector('#serviceForm'),
  serviceName: document.querySelector('#serviceName'),
  servicePrice: document.querySelector('#servicePrice'),
  serviceDuration: document.querySelector('#serviceDuration'),
  serviceList: document.querySelector('#serviceList'),
  emptyTemplate: document.querySelector('#emptyStateTemplate')
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  configureDates();
  setupSupabase();
  bindEvents();
  await loadData();
  renderAll();
}

function setupSupabase() {
  const config = window.DAVI_BARBER_SUPABASE || {};
  const hasConfig = config.url && config.anonKey && window.supabase;

  if (!hasConfig) {
    els.storageStatus.textContent = 'Modo local ativo. Configure Supabase para produção.';
    return;
  }

  state.supabase = window.supabase.createClient(config.url, config.anonKey);
  state.useSupabase = true;
  els.storageStatus.textContent = 'Supabase conectado. Dados serão salvos no banco.';
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => setView(tab.dataset.view));
  });

  els.serviceSelect.addEventListener('change', renderSlots);
  els.dateInput.addEventListener('change', renderSlots);
  els.adminDate.addEventListener('change', renderAdminTimeline);
  els.bookingForm.addEventListener('submit', handleBookingSubmit);
  els.lookupForm.addEventListener('submit', handleLookup);
  els.serviceForm.addEventListener('submit', handleServiceSubmit);
}

function configureDates() {
  const today = toDateInputValue(new Date());
  els.dateInput.value = today;
  els.dateInput.min = today;
  els.adminDate.value = today;
}

async function loadData() {
  if (state.useSupabase) {
    const [services, clients, appointments] = await Promise.all([
      state.supabase.from('services').select('*').order('name'),
      state.supabase.from('clients').select('*').order('name'),
      state.supabase.from('appointments').select('*').order('date').order('start_time')
    ]);

    if (services.error || clients.error || appointments.error) {
      els.storageStatus.textContent = 'Erro ao ler Supabase. Usando modo local nesta sessão.';
      state.useSupabase = false;
      loadLocalData();
      return;
    }

    state.services = services.data.length ? services.data : DEFAULT_SERVICES;
    state.clients = clients.data;
    state.appointments = appointments.data;
    return;
  }

  loadLocalData();
}

function loadLocalData() {
  state.services = readLocal('services', DEFAULT_SERVICES);
  state.clients = readLocal('clients', []);
  state.appointments = readLocal('appointments', []);
}

function readLocal(key, fallback) {
  const value = localStorage.getItem(`davi-barber:${key}`);
  return value ? JSON.parse(value) : fallback;
}

function saveLocal(key, value) {
  localStorage.setItem(`davi-barber:${key}`, JSON.stringify(value));
}

async function persistService(service) {
  if (state.useSupabase) {
    const { data, error } = await state.supabase.from('services').insert(service).select().single();
    if (error) throw error;
    state.services.push(data);
    return;
  }

  state.services.push(service);
  saveLocal('services', state.services);
}

async function persistClient(client) {
  if (state.useSupabase) {
    const { data, error } = await state.supabase
      .from('clients')
      .upsert(client, { onConflict: 'phone' })
      .select()
      .single();
    if (error) throw error;
    upsertInState(state.clients, data);
    return data;
  }

  const existing = state.clients.find((item) => item.phone === client.phone);
  if (existing) {
    existing.name = client.name;
    saveLocal('clients', state.clients);
    return existing;
  }

  state.clients.push(client);
  saveLocal('clients', state.clients);
  return client;
}

async function persistAppointment(appointment) {
  if (state.useSupabase) {
    const { data, error } = await state.supabase.from('appointments').insert(appointment).select().single();
    if (error) throw error;
    state.appointments.push(data);
    return;
  }

  state.appointments.push(appointment);
  saveLocal('appointments', state.appointments);
}

async function updateAppointmentStatus(id, status) {
  const appointment = state.appointments.find((item) => item.id === id);
  if (!appointment) return;

  if (state.useSupabase) {
    const { data, error } = await state.supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    Object.assign(appointment, data);
  } else {
    appointment.status = status;
    saveLocal('appointments', state.appointments);
  }

  renderAll();
}

function upsertInState(list, item) {
  const index = list.findIndex((current) => current.id === item.id);
  if (index >= 0) list[index] = item;
  else list.push(item);
}

function renderAll() {
  renderServiceOptions();
  renderSlots();
  renderAdminTimeline();
  renderServiceList();
  renderStats();
}

function renderServiceOptions() {
  const activeServices = state.services.filter((service) => service.active !== false);
  els.serviceSelect.innerHTML = activeServices
    .map((service) => `<option value="${service.id}">${service.name} · ${service.duration_minutes} min · R$ ${Number(service.price).toFixed(0)}</option>`)
    .join('');
}

function renderSlots() {
  const service = getSelectedService();
  const date = els.dateInput.value;
  state.selectedSlot = '';
  els.selectedTime.value = '';

  if (!service || !date) {
    renderEmpty(els.slots, 'Selecione serviço e data.');
    return;
  }

  els.durationHint.textContent = `${service.duration_minutes} minutos`;
  const slots = getAvailableSlots(date, service.duration_minutes);

  if (!slots.length) {
    renderEmpty(els.slots, 'Nenhum horário disponível nessa data.');
    return;
  }

  els.slots.innerHTML = slots
    .map((slot) => `<button class="slot" type="button" data-time="${slot}">${slot}</button>`)
    .join('');

  els.slots.querySelectorAll('.slot').forEach((button) => {
    button.addEventListener('click', () => {
      els.slots.querySelectorAll('.slot').forEach((slot) => slot.classList.remove('selected'));
      button.classList.add('selected');
      state.selectedSlot = button.dataset.time;
      els.selectedTime.value = button.dataset.time;
    });
  });
}

function getAvailableSlots(date, duration) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  if (BUSINESS_HOURS.closedWeekdays.includes(weekday)) return [];

  const slots = [];
  const start = timeToMinutes(BUSINESS_HOURS.start);
  const end = timeToMinutes(BUSINESS_HOURS.end);

  for (let cursor = start; cursor + duration <= end; cursor += BUSINESS_HOURS.slotMinutes) {
    const slotStart = cursor;
    const slotEnd = cursor + duration;
    if (isBlockedByBreak(slotStart, slotEnd)) continue;
    if (hasConflict(date, slotStart, slotEnd)) continue;
    slots.push(minutesToTime(slotStart));
  }

  return slots;
}

function isBlockedByBreak(start, end) {
  return BUSINESS_HOURS.breaks.some((item) => {
    const breakStart = timeToMinutes(item.start);
    const breakEnd = timeToMinutes(item.end);
    return rangesOverlap(start, end, breakStart, breakEnd);
  });
}

function hasConflict(date, start, end) {
  return state.appointments.some((appointment) => {
    if (appointment.date !== date || appointment.status === 'canceled') return false;
    const appointmentStart = timeToMinutes(appointment.start_time);
    const appointmentEnd = timeToMinutes(appointment.end_time);
    return rangesOverlap(start, end, appointmentStart, appointmentEnd);
  });
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

async function handleBookingSubmit(event) {
  event.preventDefault();

  const service = getSelectedService();
  const date = els.dateInput.value;
  const startTime = els.selectedTime.value;

  if (!service || !date || !startTime) {
    alert('Escolha um horário disponível antes de confirmar.');
    return;
  }

  const start = timeToMinutes(startTime);
  const end = start + Number(service.duration_minutes);

  if (hasConflict(date, start, end)) {
    alert('Esse horário acabou de ser ocupado. Escolha outro horário.');
    renderSlots();
    return;
  }

  const phone = normalizePhone(els.clientPhone.value);
  const client = {
    id: phone,
    name: els.clientName.value.trim(),
    phone,
    created_at: new Date().toISOString()
  };

  const savedClient = await persistClient(client);
  await persistAppointment({
    id: crypto.randomUUID(),
    client_id: savedClient.id,
    client_name: savedClient.name,
    client_phone: savedClient.phone,
    service_id: service.id,
    service_name: service.name,
    service_duration: Number(service.duration_minutes),
    service_price: Number(service.price),
    date,
    start_time: startTime,
    end_time: minutesToTime(end),
    status: 'scheduled',
    created_at: new Date().toISOString()
  });

  els.bookingForm.reset();
  configureDates();
  alert('Agendamento confirmado.');
  renderAll();
}

function handleLookup(event) {
  event.preventDefault();
  const phone = normalizePhone(els.lookupPhone.value);
  const appointments = state.appointments
    .filter((appointment) => appointment.client_phone === phone && appointment.status !== 'canceled')
    .sort(sortByDateTime);

  renderAppointmentCards(els.clientAppointments, appointments);
}

async function handleServiceSubmit(event) {
  event.preventDefault();
  const duration = Number(els.serviceDuration.value);

  if (duration % 15 !== 0) {
    alert('Use durações em múltiplos de 15 minutos.');
    return;
  }

  await persistService({
    id: crypto.randomUUID(),
    name: els.serviceName.value.trim(),
    price: Number(els.servicePrice.value),
    duration_minutes: duration,
    active: true,
    created_at: new Date().toISOString()
  });

  els.serviceForm.reset();
  renderAll();
}

function renderAdminTimeline() {
  const date = els.adminDate.value;
  const appointments = state.appointments
    .filter((appointment) => appointment.date === date)
    .sort(sortByDateTime);

  if (!appointments.length) {
    renderEmpty(els.adminTimeline, 'Nenhum agendamento para esta data.');
    return;
  }

  els.adminTimeline.innerHTML = appointments.map((appointment) => `
    <div class="timeline-row">
      <div class="time-chip">${appointment.start_time}</div>
      <div>
        <strong>${appointment.client_name}</strong>
        <span>${appointment.service_name} · ${appointment.service_duration} min · ${STATUS_LABELS[appointment.status]}</span>
      </div>
      <div class="timeline-actions">
        <button class="ghost-action" type="button" data-action="completed" data-id="${appointment.id}">Concluir</button>
        <button class="danger-action" type="button" data-action="canceled" data-id="${appointment.id}">Cancelar</button>
      </div>
    </div>
  `).join('');

  els.adminTimeline.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => updateAppointmentStatus(button.dataset.id, button.dataset.action));
  });
}

function renderServiceList() {
  if (!state.services.length) {
    renderEmpty(els.serviceList, 'Nenhum serviço cadastrado.');
    return;
  }

  els.serviceList.innerHTML = state.services.map((service) => `
    <div class="service-row">
      <div>
        <strong>${service.name}</strong><br>
        <span>${service.duration_minutes} min · R$ ${Number(service.price).toFixed(0)}</span>
      </div>
      <span>${service.active === false ? 'Inativo' : 'Ativo'}</span>
    </div>
  `).join('');
}

function renderAppointmentCards(container, appointments) {
  if (!appointments.length) {
    renderEmpty(container, 'Nenhum horário encontrado para esse telefone.');
    return;
  }

  container.innerHTML = appointments.map((appointment) => `
    <div class="mini-card">
      <strong>${formatDate(appointment.date)} às ${appointment.start_time}</strong>
      <span>${appointment.service_name} · ${appointment.service_duration} min · ${STATUS_LABELS[appointment.status]}</span>
    </div>
  `).join('');
}

function renderStats() {
  const today = toDateInputValue(new Date());
  els.todayCount.textContent = state.appointments.filter((item) => item.date === today && item.status !== 'canceled').length;
  els.clientCount.textContent = state.clients.length;
  els.serviceCount.textContent = state.services.filter((item) => item.active !== false).length;
}

function renderEmpty(container, message) {
  container.innerHTML = '';
  const empty = els.emptyTemplate.content.firstElementChild.cloneNode(true);
  empty.textContent = message;
  container.appendChild(empty);
}

function setView(view) {
  els.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
  Object.entries(els.views).forEach(([key, element]) => {
    element.classList.toggle('active', key === view);
  });
}

function getSelectedService() {
  return state.services.find((service) => service.id === els.serviceSelect.value);
}

function normalizePhone(value) {
  return value.replace(/\D/g, '');
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(total) {
  const hours = Math.floor(total / 60).toString().padStart(2, '0');
  const minutes = (total % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function sortByDateTime(a, b) {
  return `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(`${date}T00:00:00`));
}
