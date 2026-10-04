-- my_records() also names the game that holds each record (its ticket's id, which the hub keeps with
-- each game it has), so the panel under the game stars just that one. Until now it starred every
-- game that was a new record when it was checked: a 2, then a 4, each beating the one before.
--
-- Apply with: npx supabase db push

-- Its result gains a column, so it's dropped and made again (grants included)
drop function public.my_records(text);

-- The signed-in player's records in a game: their best checked run on each level (the highest score,
-- or the fastest win; the first to get there, on a tie), with what it gave and its ticket
create function public.my_records(p_game text)
returns table (mode text, score bigint, time_ms bigint, result jsonb, checked_at timestamptz, ticket_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.mode) r.mode, r.score, r.time_ms, r.result, r.checked_at, r.ticket_id
  from public.game_runs r
  where r.user_id = (select auth.uid()) and r.game_id = p_game and r.status = 'checked'
    and (r.score is not null or r.time_ms is not null)
  order by r.mode, r.score desc nulls last, r.time_ms asc nulls last, r.checked_at;
$$;

revoke execute on function public.my_records(text) from public, anon, authenticated;
grant execute on function public.my_records(text) to authenticated;
