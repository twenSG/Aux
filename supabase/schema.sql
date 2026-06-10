-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Jam',
  guest_token text not null unique,
  host_token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  video_id text not null,
  title text not null,
  artist text,
  thumbnail text,
  duration text,
  added_by text,
  votes int not null default 0,
  -- queued | playing | played
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

create index if not exists tracks_room_idx on tracks (room_id, status);

-- Reads are open (room links are unguessable tokens). All writes go
-- through the Next.js API routes using the service role key.
alter table rooms enable row level security;
alter table tracks enable row level security;

drop policy if exists "public read rooms" on rooms;
create policy "public read rooms" on rooms for select using (true);

drop policy if exists "public read tracks" on tracks;
create policy "public read tracks" on tracks for select using (true);

-- Atomic vote increment, called server-side
create or replace function increment_votes(track_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update tracks set votes = votes + 1 where id = track_id;
$$;

-- Broadcast track changes to clients
do $$
begin
  alter publication supabase_realtime add table tracks;
exception when duplicate_object then null;
end $$;
