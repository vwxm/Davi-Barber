-- Walk-in appointments booked by the admin for clients without an account.
-- client_id becomes optional; a guest is identified by name (+ optional phone).
alter table public.appointments alter column client_id drop not null;
alter table public.appointments add column if not exists guest_name text;
alter table public.appointments add column if not exists guest_phone text;

-- Every appointment must belong to a registered client or name a guest.
alter table public.appointments
  add constraint appointments_client_or_guest
  check (client_id is not null or guest_name is not null);
