create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

create table if not exists public.user_word_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  status text,
  familiarity text,
  review_count integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  streak integer not null default 0,
  last_reviewed_at bigint,
  next_review_at bigint,
  interval double precision not null default 0,
  ease double precision not null default 2.3,
  difficulty double precision not null default .5,
  lapses integer not null default 0,
  favorite boolean not null default false,
  favorite_folders jsonb not null default '[]'::jsonb,
  mistake_count integer not null default 0,
  first_learned_at bigint,
  mastered_at bigint,
  updated_at bigint not null default 0,
  primary key (user_id, word_id)
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_word_states enable row level security;

create policy "profiles own rows" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "settings own rows" on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "word states own rows" on public.user_word_states for all using (user_id = auth.uid()) with check (user_id = auth.uid());
