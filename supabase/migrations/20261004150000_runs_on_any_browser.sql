-- A signed-in player's runs, in any browser. Until now a run could be watched again only in the browser
-- that played it, though the ones played on a ticket are kept on GameHub's server too: their moves
-- for 30 days, or as long as the run is the player's record (see the checked runs migration). Now
-- my_runs() lists the ones whose moves are still kept, and my_run_inputs() gives one's moves, to
-- watch it.
--
-- Apply with: npx supabase db push

-- The signed-in player's runs of a game whose moves are still kept: their records first (each
-- level's, as my_records() and the daily tidy-up pick them), then the newest, 100 at most. Each with
-- what's needed to play it again but its moves (my_run_inputs()), whether it's a record, and when its
-- moves go (keep_until: none for a record, kept while it is one; else 30 days after it was checked,
-- at the first tidy-up after that).
create function public.my_runs(p_game text)
returns table (
  run_id uuid,
  ticket_id uuid,
  seed bigint,
  mode text,
  status text,
  reason text,
  outcome text,
  result jsonb,
  claimed jsonb,
  tick integer,
  length bigint,
  checked_at timestamptz,
  record boolean,
  keep_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.ticket_id, t.seed, r.mode, r.status, r.reason, r.outcome, r.result, r.claimed, r.tick, r.length,
    r.checked_at, k.id is not null,
    case when k.id is null then r.checked_at + interval '30 days' end
  from public.game_runs r
  join public.run_tickets t on t.id = r.ticket_id
  left join (
    select distinct on (b.mode) b.id
    from public.game_runs b
    where b.user_id = (select auth.uid()) and b.game_id = p_game and b.status = 'checked'
      and (b.score is not null or b.time_ms is not null)
    order by b.mode, b.score desc nulls last, b.time_ms asc nulls last, b.checked_at
  ) k on k.id = r.id
  where r.user_id = (select auth.uid()) and r.game_id = p_game and r.inputs is not null
  order by k.id is not null desc, r.checked_at desc
  limit 100;
$$;

-- One of the signed-in player's runs' moves, to watch it again: null once they're no longer kept (or
-- when the run isn't theirs)
create function public.my_run_inputs(p_run uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select r.inputs from public.game_runs r where r.id = p_run and r.user_id = (select auth.uid());
$$;

revoke execute on function public.my_runs(text), public.my_run_inputs(uuid) from public, anon, authenticated;
grant execute on function public.my_runs(text), public.my_run_inputs(uuid) to authenticated;
