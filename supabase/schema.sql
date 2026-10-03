-- Simpson Family Health: database setup.
-- Paste this whole file into the Supabase SQL editor and click Run.
-- BEFORE running, put each person's sign-in email in the members insert below.
-- Create their logins under Authentication → Users → Add user (see SETUP.md).
-- Anyone signed in whose email isn't listed here sees nothing.

create table if not exists public.members (
  id        text primary key,           -- matches the ids in app.js (sue, phil, chris, anna)
  full_name text not null,
  email     text unique                 -- the email they sign in with
);

create table if not exists public.results (
  id         bigint generated always as identity primary key,
  member_id  text not null references public.members(id),
  test       text not null,             -- rbc, hb, alp, ast, alt, ggt
  taken_at   timestamptz not null,
  value      numeric not null,
  ref_low    numeric not null,          -- the range printed on that person's lab report
  ref_high   numeric not null,
  note       text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists results_member_test on public.results (member_id, test, taken_at);

insert into public.members (id, full_name, email) values
  ('sue',   'Sue Simpson',   'SUE_EMAIL_HERE'),
  ('phil',  'Phil Simpson',  'PHIL_EMAIL_HERE'),
  ('chris', 'Chris Simpson', 'CHRIS_EMAIL_HERE'),
  ('anna',  'Anna Simpson',  'ANNA_EMAIL_HERE')
on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;

-- Who is signed in? (security definer so the policies below don't recurse into members' own policy)
create or replace function public.my_member_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.members where lower(email) = lower(auth.jwt() ->> 'email')
$$;

alter table public.members enable row level security;
alter table public.results enable row level security;

-- Family can see everyone; strangers see nothing.
drop policy if exists "family reads members" on public.members;
create policy "family reads members" on public.members
  for select to authenticated using (public.my_member_id() is not null);

drop policy if exists "family reads results" on public.results;
create policy "family reads results" on public.results
  for select to authenticated using (public.my_member_id() is not null);

-- Each person can only add, change or remove their own results.
drop policy if exists "add own results" on public.results;
create policy "add own results" on public.results
  for insert to authenticated with check (member_id = public.my_member_id());

drop policy if exists "edit own results" on public.results;
create policy "edit own results" on public.results
  for update to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

drop policy if exists "delete own results" on public.results;
create policy "delete own results" on public.results
  for delete to authenticated using (member_id = public.my_member_id());

-- Let signed-in users reach the tables through the API (row-level security above still decides what they see).
grant select on public.members to authenticated;
grant select, insert, update, delete on public.results to authenticated;
grant execute on function public.my_member_id() to authenticated;
