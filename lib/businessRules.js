export const BUSINESS_HOURS = {
  start: '09:00',
  end: '19:00',
  slotMinutes: 30,
  breaks: [{ start: '12:00', end: '13:00' }],
  closedWeekdays: [0]
};

export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

export const STATUS_LABELS = {
  scheduled: 'Agendado',
  completed: 'Concluído',
  canceled: 'Cancelado'
};

export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total) {
  const hours = Math.floor(total / 60).toString().padStart(2, '0');
  const minutes = (total % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function toDateInputValue(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function toPlainDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getBusinessDate(now = new Date()) {
  const [year, month, day] = toDateInputValue(now).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getBusinessClockMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

export function getCurrentWeekWindow(now = new Date()) {
  const base = getBusinessDate(now);
  const day = base.getDay();
  const distanceFromMonday = day === 0 ? 1 : 1 - day;

  const monday = new Date(base);
  monday.setDate(base.getDate() + distanceFromMonday);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  return {
    monday: toPlainDateInputValue(monday),
    saturday: toPlainDateInputValue(saturday)
  };
}

export function getClientBookingWindow(now = new Date()) {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const { monday, saturday } = getCurrentWeekWindow(base);
  const today = toPlainDateInputValue(base);

  return {
    start: today > monday ? today : monday,
    end: saturday
  };
}

export function getCurrentMonthWindow(now = new Date()) {
  const today = toDateInputValue(now);
  const [year, month] = today.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    start: today,
    end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  };
}

export function isDateInCurrentBookingWeek(date, now = new Date()) {
  const { monday, saturday } = getCurrentWeekWindow(now);
  return date >= monday && date <= saturday;
}

export function isDateInClientBookingWindow(date, now = new Date()) {
  const { start, end } = getClientBookingWindow(now);
  return date >= start && date <= end;
}

export function isDateTodayOrFuture(date, now = new Date()) {
  return date >= toDateInputValue(now);
}

export function addDays(dateValue, days) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toPlainDateInputValue(date);
}

export function getDateRange(startDate, endDate, maxDays = 90) {
  if (!startDate || !endDate || endDate < startDate) return [];

  const dates = [];
  let cursor = startDate;
  while (cursor <= endDate && dates.length < maxDays) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function getRemainingMonthDatesByWeekday(weekday, now = new Date()) {
  const today = toDateInputValue(now);
  const [year, month] = today.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const dates = [];

  for (let day = Number(today.slice(8)); day <= lastDay; day += 1) {
    const date = toPlainDateInputValue(new Date(year, month - 1, day));
    if (new Date(`${date}T00:00:00`).getDay() === weekday) dates.push(date);
  }

  return dates;
}

export function isSunday(now = new Date()) {
  return now.getDay() === 0;
}

export function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

export function sortByDateTime(a, b) {
  return `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`);
}

export function getAvailableSlots(date, duration, appointments, blocks, now = new Date(), options = {}) {
  if (options.allowAnyFutureDate) {
    if (!isDateTodayOrFuture(date, now)) return [];
  } else if (!isDateInClientBookingWindow(date, now)) {
    return [];
  }

  const weekday = new Date(`${date}T00:00:00`).getDay();
  if (BUSINESS_HOURS.closedWeekdays.includes(weekday)) return [];

  const slots = [];
  const start = timeToMinutes(BUSINESS_HOURS.start);
  const end = timeToMinutes(BUSINESS_HOURS.end);
  const today = toDateInputValue(now);
  const minimumStart = date === today ? getBusinessClockMinutes(now) : start;

  for (let cursor = start; cursor + duration <= end; cursor += BUSINESS_HOURS.slotMinutes) {
    if (cursor <= minimumStart) continue;
    const slotStart = cursor;
    const slotEnd = cursor + duration;
    if (isBlockedByBreak(slotStart, slotEnd)) continue;
    if (hasBlockConflict(date, slotStart, slotEnd, blocks)) continue;
    if (hasAppointmentConflict(date, slotStart, slotEnd, appointments)) continue;
    slots.push(minutesToTime(slotStart));
  }

  return slots;
}

export function isBlockedByBreak(start, end) {
  return BUSINESS_HOURS.breaks.some((item) => {
    const breakStart = timeToMinutes(item.start);
    const breakEnd = timeToMinutes(item.end);
    return rangesOverlap(start, end, breakStart, breakEnd);
  });
}

export function hasAppointmentConflict(date, start, end, appointments) {
  return appointments.some((appointment) => {
    if (appointment.date !== date || appointment.status === 'canceled') return false;
    const appointmentStart = timeToMinutes(appointment.start_time.slice(0, 5));
    const appointmentEnd = timeToMinutes(appointment.end_time.slice(0, 5));
    return rangesOverlap(start, end, appointmentStart, appointmentEnd);
  });
}

export function hasBlockConflict(date, start, end, blocks) {
  return blocks.some((block) => {
    if (!block.active || block.date !== date) return false;
    if (block.full_day) return true;
    const blockStart = timeToMinutes(block.start_time.slice(0, 5));
    const blockEnd = timeToMinutes(block.end_time.slice(0, 5));
    return rangesOverlap(start, end, blockStart, blockEnd);
  });
}
