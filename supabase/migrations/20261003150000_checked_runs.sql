-- Checked runs: records nobody can make up.
--
-- Saves are the player's own: they live in their browser and can say anything. So records come only
-- from runs GameHub has played again itself. A game in the hub (its js/gamehub.js, version 3)
-- records each run: the random seed it played with, and each input that changed it.
-- 1. Tickets. Each signed-in player gets a few tickets per game: a seed the server chose, kept here,
--    good for 14 days. The hub keeps them in the browser, and the game takes one for each run, also
--    offline (the hub tells the server it's taken then, or once back online, so it isn't handed out
--    again). A run without a ticket (a guest's, or offline once they've run out) stays the player's
--    own, on their device: it's never a record.
-- 2. Checking. When a run on a ticket ends (or once back online), the hub sends it to the site's
--    Worker (worker/verify-run.js), which plays it again from the ticket's seed with the game's own
--    rules (worker/games/) and records what *its* replay gave, with record_run(): never the game's
--    claim. A ticket is good for one run, and a run can't have lasted longer than the time since its
--    ticket was issued (or started, online). Runs that don't play out are kept too, refused.
-- 3. Records: each player's best checked run in each game, per level (my_records()).
-- A run's inputs are kept 30 days, or as long as it's the player's record, for a second look at
-- runs flagged odd. Everything here is deleted with the account.
--
-- Apply with: npx supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.run_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on update cascade on delete cascade,
  seed bigint not null constraint ticket_seed check (seed between 0 and 4294967295),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  taken_at timestamptz, -- a game took it for a run: no longer handed out (told later, for a run started offline)
  started_at timestamptz, -- that run started online, then: it can only have lasted as long as the time since
  used_at timestamptz -- its run was checked (or refused)
);

create index run_tickets_unused on public.run_tickets (user_id, game_id) where used_at is null;

alter table public.run_tickets enable row level security;
-- No policies and no grants: only the functions below read and write it
revoke all on public.run_tickets from anon, authenticated;

create table public.game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on update cascade on delete cascade,
  ticket_id uuid not null unique references public.run_tickets (id) on delete cascade,
  mode text, -- the level, for games that have levels
  status text not null constraint run_status check (status in ('checked', 'refused')),
  reason text, -- why it was refused (worker/games/: 'not-over', 'too-long'…)
  outcome text constraint run_outcome check (outcome in ('won', 'lost', 'over')),
  score bigint, -- higher is better (Snake, Tetris)
  time_ms bigint, -- a win's time, lower is better (Minesweeper, Sudoku)
  result jsonb not null default '[]', -- what the replay gave, as the game shows it: [{ label, value, format }]
  claimed jsonb not null default '[]', -- what the game said
  flags text[] not null default '{}', -- odd, for a second look: 'claim' (the game said otherwise), 'fast'
  played_ms bigint not null constraint run_played check (played_ms >= 0), -- how long it lasted
  tick integer, -- ms per step, for games that move by themselves
  length bigint not null, -- steps, or ms
  inputs jsonb, -- the run itself (its seed is the ticket's): kept 30 days, or while it's a record
  checked_at timestamptz not null default now()
);

create index game_runs_records on public.game_runs (user_id, game_id, mode) where status = 'checked';

alter table public.game_runs enable row level security;
-- Read through my_records() only; written by the Worker through record_run()
revoke all on public.game_runs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions the site calls (supabase.rpc)
-- ---------------------------------------------------------------------------

-- The signed-in player's ready tickets for a published game, topped up to 10 first (ready: neither
-- taken nor used, and in date). At most 300 a day per game, which real play never reaches.
create function public.issue_tickets(p_game text)
returns table (id uuid, seed bigint, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ready integer;
  today integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select from public.games g where g.id = p_game and g.published) then
    raise exception 'No such game' using errcode = 'P0002';
  end if;
  select count(*) into ready from public.run_tickets t
  where t.user_id = uid and t.game_id = p_game and t.taken_at is null and t.used_at is null and t.expires_at > now();
  select count(*) into today from public.run_tickets t
  where t.user_id = uid and t.game_id = p_game and t.issued_at > now() - interval '1 day';
  insert into public.run_tickets (user_id, game_id, seed)
  select uid, p_game, floor(random() * 4294967296)::bigint
  from generate_series(1, greatest(0, least(10 - ready, 300 - today)));
  return query
    select t.id, t.seed, t.expires_at from public.run_tickets t
    where t.user_id = uid and t.game_id = p_game and t.taken_at is null and t.used_at is null and t.expires_at > now()
    order by t.issued_at, t.id;
end;
$$;

-- A run started online on one of the signed-in player's tickets: it's taken, and from now on its run
-- can only have lasted as long as the time since. True when it was ready.
create function public.start_ticket(p_ticket uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.run_tickets t set taken_at = now(), started_at = now()
  where t.id = p_ticket and t.user_id = (select auth.uid())
    and t.taken_at is null and t.used_at is null and t.expires_at > now();
  return found;
end;
$$;

-- Runs started offline on these of the signed-in player's tickets, told once back online: they're
-- taken (their runs' time counts from when the tickets were issued). Returns how many were ready.
create function public.take_tickets(p_tickets uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken integer;
begin
  update public.run_tickets t set taken_at = now()
  where t.id = any (p_tickets) and t.user_id = (select auth.uid()) and t.taken_at is null and t.used_at is null;
  get diagnostics taken = row_count;
  return taken;
end;
$$;

-- The signed-in player's records in a game: their best checked run on each level (the highest
-- score, or the fastest win), with what it gave
create function public.my_records(p_game text)
returns table (mode text, score bigint, time_ms bigint, result jsonb, checked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.mode) r.mode, r.score, r.time_ms, r.result, r.checked_at
  from public.game_runs r
  where r.user_id = (select auth.uid()) and r.game_id = p_game and r.status = 'checked'
    and (r.score is not null or r.time_ms is not null)
  order by r.mode, r.score desc nulls last, r.time_ms asc nulls last, r.checked_at;
$$;

-- ---------------------------------------------------------------------------
-- Functions the Worker calls (with the secret key: service_role)
-- ---------------------------------------------------------------------------

-- A player's ticket, to check a run on it: its game, seed and times (none when it isn't theirs)
create function public.ticket_to_check(p_user uuid, p_ticket uuid)
returns table (game_id text, seed bigint, issued_at timestamptz, started_at timestamptz, expires_at timestamptz,
  used_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.game_id, t.seed, t.issued_at, t.started_at, t.expires_at, t.used_at
  from public.run_tickets t
  where t.id = p_ticket and t.user_id = p_user;
$$;

-- Records a run the Worker has played again, using up its ticket (it must be the player's, unused and
-- in date). Returns the run's id, and whether it's the player's new record in that game and level.
create function public.record_run(
  p_user uuid,
  p_ticket uuid,
  p_status text,
  p_reason text,
  p_mode text,
  p_outcome text,
  p_score bigint,
  p_time_ms bigint,
  p_result jsonb,
  p_claimed jsonb,
  p_flags text[],
  p_played_ms bigint,
  p_tick integer,
  p_length bigint,
  p_inputs jsonb
)
returns table (run_id uuid, best boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket public.run_tickets;
  previous public.game_runs;
  new_run uuid;
  counts boolean := p_status = 'checked' and (p_score is not null or p_time_ms is not null);
begin
  update public.run_tickets t set used_at = now()
  where t.id = p_ticket and t.user_id = p_user and t.used_at is null and t.expires_at > now()
  returning * into ticket;
  if not found then
    raise exception 'No such ticket, or it''s been used or is out of date' using errcode = 'P0002', hint = 'ticket';
  end if;

  -- The player's record before this run
  select * into previous from public.game_runs r
  where r.user_id = p_user and r.game_id = ticket.game_id and r.mode is not distinct from p_mode
    and r.status = 'checked' and (r.score is not null or r.time_ms is not null)
  order by r.score desc nulls last, r.time_ms asc nulls last, r.checked_at
  limit 1;

  insert into public.game_runs (user_id, game_id, ticket_id, mode, status, reason, outcome, score, time_ms, result,
    claimed, flags, played_ms, tick, length, inputs)
  values (p_user, ticket.game_id, p_ticket, p_mode, p_status, p_reason, p_outcome, p_score, p_time_ms,
    coalesce(p_result, '[]'), coalesce(p_claimed, '[]'), coalesce(p_flags, '{}'), p_played_ms, p_tick, p_length, p_inputs)
  returning id into new_run;

  return query select new_run, counts and (
    previous.id is null
    or (p_score is not null and p_score > previous.score)
    or (p_time_ms is not null and p_time_ms < previous.time_ms)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Tidying up, daily
-- ---------------------------------------------------------------------------
-- A run's inputs go after 30 days, unless it's a player's record; tickets that never got a run go a
-- month after they ran out
create function private.tidy_runs()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.game_runs r set inputs = null
  where r.inputs is not null and r.checked_at < now() - interval '30 days'
    and r.id not in (
      select distinct on (b.user_id, b.game_id, b.mode) b.id
      from public.game_runs b
      where b.status = 'checked' and (b.score is not null or b.time_ms is not null)
      order by b.user_id, b.game_id, b.mode, b.score desc nulls last, b.time_ms asc nulls last, b.checked_at
    );
  delete from public.run_tickets t where t.used_at is null and t.expires_at < now() - interval '30 days';
$$;

select cron.schedule('gamehub-tidy-runs', '41 3 * * *', 'select private.tidy_runs()');

-- Nothing is executable by default; grant only what each role needs
revoke execute on function
  public.issue_tickets(text),
  public.start_ticket(uuid),
  public.take_tickets(uuid[]),
  public.my_records(text),
  public.ticket_to_check(uuid, uuid),
  public.record_run(uuid, uuid, text, text, text, text, bigint, bigint, jsonb, jsonb, text[], bigint, integer, bigint, jsonb),
  private.tidy_runs()
from public, anon, authenticated;

grant execute on function
  public.issue_tickets(text),
  public.start_ticket(uuid),
  public.take_tickets(uuid[]),
  public.my_records(text)
to authenticated;
grant execute on function
  public.ticket_to_check(uuid, uuid),
  public.record_run(uuid, uuid, text, text, text, text, bigint, bigint, jsonb, jsonb, text[], bigint, integer, bigint, jsonb)
to service_role;
