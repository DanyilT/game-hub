-- Tests for supabase/migrations/*_runs_on_any_browser.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- A player (P) with five runs of Snake and one of Tetris, and another player (O) with one of Snake.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

delete from public.game_runs;
delete from public.run_tickets;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-000000000da1', 'runs-player@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-000000000db2', 'runs-other@example.com', '{"provider":"google"}');

-- Tickets dd01… dd07, one for each run, with seeds 1 to 7
insert into public.run_tickets (id, user_id, game_id, seed, used_at)
select ('00000000-0000-4000-8000-00000000dd0' || n)::uuid,
  case when n = 7 then '00000000-0000-4000-8000-000000000db2'::uuid else '00000000-0000-4000-8000-000000000da1'::uuid end,
  case when n = 6 then 'tetris' else 'snake' end,
  n, now()
from generate_series(1, 7) as n;

-- P's Snake: 1, a score of 10 forty days ago (its moves gone); 2, 50 forty days ago (the record: kept); 3, 20 two
-- days ago; 4, refused yesterday; 5, 30 an hour ago. P's Tetris: 6. O's Snake: 7.
insert into public.game_runs (id, user_id, game_id, ticket_id, mode, status, reason, outcome, score, result, claimed,
  played_ms, tick, length, inputs, checked_at)
select ('00000000-0000-4000-8000-00000000de0' || n)::uuid,
  case when n = 7 then '00000000-0000-4000-8000-000000000db2'::uuid else '00000000-0000-4000-8000-000000000da1'::uuid end,
  case when n = 6 then 'tetris' else 'snake' end,
  ('00000000-0000-4000-8000-00000000dd0' || n)::uuid,
  null,
  case when n = 4 then 'refused' else 'checked' end,
  case when n = 4 then 'not-over' end,
  case when n = 4 then null else 'lost' end,
  case n when 1 then 10 when 2 then 50 when 3 then 20 when 5 then 30 when 6 then 100 when 7 then 90 end,
  case when n = 4 then '[]'::jsonb else jsonb_build_array(jsonb_build_object('label', 'Score', 'value', n * 10)) end,
  jsonb_build_array(jsonb_build_object('label', 'Score', 'value', n * 10)),
  60000, 100, 600,
  case when n = 1 then null else jsonb_build_array(0, 'up', n, 'left') end,
  now() - case n when 1 then interval '40 days' when 2 then interval '40 days' when 3 then interval '2 days'
    when 4 then interval '1 day' else interval '1 hour' end
from generate_series(1, 7) as n;

-- ---------------------------------------------------------------------------
-- Visitors
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.my_runs('snake')$$, '42501', null, 'visitors have no runs');
select throws_ok($$select public.my_run_inputs('00000000-0000-4000-8000-00000000de02')$$, '42501', null,
  '...nor read a run''s moves');
reset role;

-- ---------------------------------------------------------------------------
-- The list
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000da1","role":"authenticated"}', true);
select is((select array_agg(run_id::text order by ordinality) from public.my_runs('snake') with ordinality),
  array['00000000-0000-4000-8000-00000000de02', '00000000-0000-4000-8000-00000000de05',
    '00000000-0000-4000-8000-00000000de04', '00000000-0000-4000-8000-00000000de03'],
  'my_runs lists the runs whose moves are kept, the record first, then the newest (not the one whose moves went)');
select is((select record from public.my_runs('snake') where run_id = '00000000-0000-4000-8000-00000000de02'), true,
  'the best checked run is the record');
select is((select count(*) from public.my_runs('snake') where record), 1::bigint, '...and the only one');
select is((select keep_until from public.my_runs('snake') where run_id = '00000000-0000-4000-8000-00000000de02'), null,
  'a record is kept while it''s one');
select is((select keep_until from public.my_runs('snake') where run_id = '00000000-0000-4000-8000-00000000de03'),
  now() - interval '2 days' + interval '30 days', 'another run, 30 days after it was checked');
select is((select seed from public.my_runs('snake') where run_id = '00000000-0000-4000-8000-00000000de03'), 3::bigint,
  'with its ticket''s seed');
select is((select ticket_id::text from public.my_runs('snake') where run_id = '00000000-0000-4000-8000-00000000de03'),
  '00000000-0000-4000-8000-00000000dd03', '...and the ticket');
select is((select row(status, reason, outcome)::text from public.my_runs('snake')
  where run_id = '00000000-0000-4000-8000-00000000de04'), '(refused,not-over,)', 'a refused run is there too, with why');
select is((select claimed from public.my_runs('snake') where run_id = '00000000-0000-4000-8000-00000000de04'),
  '[{"label": "Score", "value": 40}]'::jsonb, '...and what the game said');
select is((select count(*) from public.my_runs('tetris')), 1::bigint, 'each game has its own');

-- ---------------------------------------------------------------------------
-- A run's moves
-- ---------------------------------------------------------------------------
select is(public.my_run_inputs('00000000-0000-4000-8000-00000000de03'), '[0, "up", 3, "left"]'::jsonb,
  'my_run_inputs gives a run''s moves');
select is(public.my_run_inputs('00000000-0000-4000-8000-00000000de01'), null, '...none once they''ve gone');
select is(public.my_run_inputs('00000000-0000-4000-8000-00000000de07'), null, '...nor another player''s');
select is(public.my_run_inputs('00000000-0000-4000-8000-0000000000ff'), null, '...nor a run that isn''t there');

-- The other player
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000db2","role":"authenticated"}', true);
select is((select array_agg(run_id::text) from public.my_runs('snake')), array['00000000-0000-4000-8000-00000000de07'],
  'another player has only theirs');
reset role;

-- The tidy-up keeps the moves of exactly the runs my_runs() calls records
select private.tidy_runs();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000da1","role":"authenticated"}', true);
select is((select count(*) from public.my_runs('snake') where record), 1::bigint,
  'after the tidy-up, the record''s moves are still there');
reset role;

select * from finish();
rollback;
