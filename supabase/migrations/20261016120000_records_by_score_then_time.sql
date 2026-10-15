-- A new record is a run that comes before the player's record in the records' own order: the higher score, then, for
-- the same score (or none), the faster win.
--
-- record_run() said "a higher score, or a faster time". That's the same for games with a score only (Snake, Tetris,
-- Flappy Bird, Tic-Tac-Toe) or a time only (Minesweeper, Sudoku). For a game with both, like Solitaire (Standard: a
-- win's score and time; Vegas: the dollars, and a win's time), it called a faster win with a lower score a new record,
-- though my_records() kept the higher score.
--
-- The same function and grants; only the last comparison changes.

create or replace function public.record_run(
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

  -- A new record when it comes first in that order (a tie stays with the earlier run)
  return query select new_run, counts and (
    previous.id is null
    or (p_score is not null and (previous.score is null or p_score > previous.score))
    or (p_score is not distinct from previous.score and p_time_ms is not null
      and (previous.time_ms is null or p_time_ms < previous.time_ms))
  );
end;
$$;
