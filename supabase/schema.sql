-- Shared-Flat Finder schema. Apply with:
--   npm run db:setup
-- (runs this file then supabase/seed.sql against $SUPABASE_DB_URL)

create extension if not exists pgcrypto;

create table groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  round int not null default 1,
  locked_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  position int not null,               -- 0,1,2 ; position 0 = organiser
  token text unique not null,
  is_organiser boolean not null default false,
  answers jsonb,
  submitted_at timestamptz
);

create table listings (
  id serial primary key,
  group_id uuid references groups(id) on delete cascade,  -- null = shared sample listing
  title text not null,
  area text not null,
  rent int not null,                   -- total monthly rent, INR
  floor int not null,
  lift boolean, parking boolean, pets boolean,            -- null = unknown
  bathrooms int,                        -- null = unknown
  furnished boolean, balcony boolean, gym boolean, near_metro boolean, newer boolean,
  url text,
  is_sample boolean not null default false,
  status text not null default 'active' check (status in ('active','gone'))
);

create table commute (
  area text not null, landmark text not null, minutes int not null,
  primary key (area, landmark)
);

create table round_changes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  round int not null, member_id uuid not null references members(id) on delete cascade,
  field text not null, old_value jsonb, new_value jsonb,
  private boolean not null default false,
  changed_at timestamptz not null default now()
);

-- Per-group override of a *sample* listing's status (marking a shared
-- sample listing "gone" only affects the group that marked it).
create table group_listing_status (
  group_id uuid not null references groups(id) on delete cascade,
  listing_id int not null references listings(id) on delete cascade,
  status text not null check (status in ('active','gone')),
  primary key (group_id, listing_id)
);

alter table groups enable row level security;
alter table members enable row level security;
alter table listings enable row level security;
alter table commute enable row level security;
alter table round_changes enable row level security;
alter table group_listing_status enable row level security;

-- No anon policies are added anywhere: every table is reachable only via
-- the server, using the service role key, which bypasses RLS. Browsers
-- never talk to Supabase directly.
