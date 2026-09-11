create table if not exists public.kniffel_games (
  id text primary key,
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kniffel_games enable row level security;

create policy "kniffel_games_select" on public.kniffel_games
  for select to anon, authenticated using (true);
create policy "kniffel_games_insert" on public.kniffel_games
  for insert to anon, authenticated with check (true);
create policy "kniffel_games_update" on public.kniffel_games
  for update to anon, authenticated using (true) with check (true);

alter table public.kniffel_games replica identity full;
alter publication supabase_realtime add table public.kniffel_games;
