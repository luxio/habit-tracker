-- Habit Tracker — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent): uses IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per habit, owned by a user.
create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  emoji      text not null default '',
  color      text not null default '',
  type       text not null default 'binary' check (type in ('binary', 'volume')),
  target     integer not null default 1 check (target >= 1),
  created_at timestamptz not null default now()
);

-- One row per (habit, day) with the number of completions logged that day.
-- The client reconstructs each habit's `history: Record<'YYYY-MM-DD', number>`
-- from these rows.
create table if not exists public.habit_logs (
  id       uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day      date not null,
  count    integer not null default 0 check (count >= 0),
  unique (habit_id, day)
);

-- At most one active challenge per user (enforced by the unique index below).
create table if not exists public.challenges (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null,
  length_days    integer not null check (length_days >= 1),
  start_key      date not null,
  reward_claimed boolean not null default false,
  created_at     timestamptz not null default now()
);

create unique index if not exists challenges_one_per_user on public.challenges (user_id);
create index if not exists habit_logs_user_day_idx on public.habit_logs (user_id, day);
create index if not exists habits_user_idx on public.habits (user_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security: a user can only ever see/touch their own rows.
-- ---------------------------------------------------------------------------

alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;
alter table public.challenges enable row level security;

drop policy if exists "habits owner access" on public.habits;
create policy "habits owner access" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habit_logs owner access" on public.habit_logs;
create policy "habit_logs owner access" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "challenges owner access" on public.challenges;
create policy "challenges owner access" on public.challenges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed default habits exactly once, when a new account is created.
-- Runs as the table owner (security definer) so it can insert on the user's
-- behalf during sign-up, before they have a session.
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_habits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.habits (user_id, name, emoji, color, type, target) values
    (new.id, 'Drink water', '💧', '#3c87f7', 'volume', 8),
    (new.id, 'Move 20 min', '🏃', '#34c759', 'binary', 1),
    (new.id, 'Read',        '📚', '#ff9500', 'binary', 1);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_default_habits();
