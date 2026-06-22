-- Run this in your Supabase SQL editor (one paste, one click)

create table clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text not null unique
);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  coach_note text,
  exercises jsonb default '[]',
  links jsonb default '[]'
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  session_id uuid references workout_sessions(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  feel text,
  note text,
  logged_exercises jsonb default '[]',
  coach_read boolean default false
);

-- Allow authenticated users to read/write their own data
alter table clients enable row level security;
alter table workout_sessions enable row level security;
alter table feedback enable row level security;

create policy "clients visible to auth" on clients for select using (auth.role() = 'authenticated');
create policy "clients insert auth" on clients for insert with check (auth.role() = 'authenticated');
create policy "clients update auth" on clients for update using (auth.role() = 'authenticated');

create policy "sessions visible to auth" on workout_sessions for select using (auth.role() = 'authenticated');
create policy "sessions insert auth" on workout_sessions for insert with check (auth.role() = 'authenticated');
create policy "sessions update auth" on workout_sessions for update using (auth.role() = 'authenticated');

create policy "feedback visible to auth" on feedback for select using (auth.role() = 'authenticated');
create policy "feedback insert auth" on feedback for insert with check (auth.role() = 'authenticated');
create policy "feedback update auth" on feedback for update using (auth.role() = 'authenticated');
