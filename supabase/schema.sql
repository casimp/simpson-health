-- Simpson Family Health: database setup.
-- Paste this whole file into the Supabase SQL editor and click Run. Nothing needs editing.
-- Safe to run again: it won't duplicate or wipe anything.
--
-- How access works:
--   * Anyone can create an account in the app, but sees nothing until they join the family.
--   * Joining means picking which person you are. The very first person to join needs no code;
--     everyone after that needs the family code, which family members can see in the app.
--   * Everyone in the family sees all results; each person can only add, change or remove their own.

create extension if not exists pgcrypto;

-- People ------------------------------------------------------------------------------------------
create table if not exists public.members (
  id         text primary key default gen_random_uuid()::text,
  full_name  text not null check (length(trim(full_name)) between 1 and 80),
  short_name text not null check (length(trim(short_name)) between 1 and 30),
  colour     text not null default 'teal',             -- a palette name from src/people.ts
  user_id    uuid unique references auth.users(id) on delete set null,   -- the login linked to this person
  created_at timestamptz not null default now()
);

insert into public.members (id, full_name, short_name, colour) values
  ('sue',   'Sue Simpson',   'Sue',   'rose'),
  ('phil',  'Phil Simpson',  'Phil',  'amber'),
  ('chris', 'Chris Simpson', 'Chris', 'teal'),
  ('anna',  'Anna Simpson',  'Anna',  'violet')
on conflict (id) do nothing;

-- The family code (one row) -----------------------------------------------------------------------
create table if not exists public.family (
  id        boolean primary key default true check (id),
  join_code text not null
);
create or replace function public.make_join_code() returns text
language sql volatile set search_path = public, extensions as $$
  -- 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L); the app shows it as XXXX-XXXX
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from gen_random_bytes(8) b, generate_series(0, 7) i
$$;
insert into public.family (id, join_code) values (true, public.make_join_code()) on conflict (id) do nothing;

-- Results -----------------------------------------------------------------------------------------
create table if not exists public.results (
  id         bigint generated always as identity primary key,
  member_id  text not null references public.members(id) on delete cascade,
  test       text not null,             -- a key from src/tests.ts (rbc, hb, alp, ast, alt, ggt)
  taken_at   timestamptz not null,
  value      numeric not null,
  ref_low    numeric not null,          -- the range printed on that person's lab report
  ref_high   numeric not null check (ref_high > ref_low),
  note       text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists results_member_test on public.results (member_id, test, taken_at);

-- Who is signed in? -------------------------------------------------------------------------------
-- security definer so the policies below can use it without recursing into members' own policy.
create or replace function public.my_member_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid()
$$;

create or replace function public.code_ok(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.members where user_id is not null)   -- first person in
      or exists (select 1 from public.family
                 where join_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')))
$$;

-- Before joining: who can I pick? Needs a valid code, so strangers learn nothing.
create or replace function public.join_options(p_code text)
returns table (id text, full_name text, taken boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.code_ok(p_code) then raise exception 'wrong_code'; end if;
  return query select m.id, m.full_name, m.user_id is not null from public.members m order by m.created_at, m.full_name;
end $$;

-- Join as an existing person (p_member_id) or as someone new (p_full_name + p_short_name).
create or replace function public.join_family(p_code text, p_member_id text default null,
                                              p_full_name text default null, p_short_name text default null)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare mid text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  mid := public.my_member_id();
  if mid is not null then return mid; end if;
  if not public.code_ok(p_code) then raise exception 'wrong_code'; end if;
  if p_member_id is not null then
    update public.members set user_id = auth.uid() where id = p_member_id and user_id is null returning id into mid;
    if mid is null then raise exception 'taken'; end if;
  else
    insert into public.members (full_name, short_name, colour, user_id)
    values (trim(p_full_name), trim(p_short_name),
            (array['rose','amber','teal','violet','green','blue','slate'])[1 + (select count(*) from public.members) % 7],
            auth.uid())
    returning id into mid;
  end if;
  return mid;
end $$;

create or replace function public.new_join_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  if public.my_member_id() is null then raise exception 'not_family'; end if;
  update public.family set join_code = public.make_join_code() where id returning join_code into c;
  return c;
end $$;

-- Row-level security ------------------------------------------------------------------------------
alter table public.members enable row level security;
alter table public.family  enable row level security;
alter table public.results enable row level security;

drop policy if exists "family reads members" on public.members;
create policy "family reads members" on public.members
  for select to authenticated using (public.my_member_id() is not null);
drop policy if exists "family reads code" on public.family;
create policy "family reads code" on public.family
  for select to authenticated using (public.my_member_id() is not null);

drop policy if exists "family reads results" on public.results;
create policy "family reads results" on public.results
  for select to authenticated using (public.my_member_id() is not null);
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

-- API access (row-level security above still decides what each person sees) -----------------------
revoke all on public.members, public.family, public.results from anon;
grant select on public.members to authenticated;
grant select on public.family to authenticated;
grant select, insert, update, delete on public.results to authenticated;

revoke execute on function public.make_join_code(), public.my_member_id(), public.code_ok(text),
  public.join_options(text), public.join_family(text, text, text, text), public.new_join_code() from public, anon;
grant execute on function public.my_member_id(), public.join_options(text),
  public.join_family(text, text, text, text), public.new_join_code() to authenticated;
