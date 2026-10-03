-- Tests for supabase/migrations/*_checked_runs.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- Inside the transaction now() doesn't move, so time passing is tested by moving tickets and runs back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(59);

delete from public.game_runs;
delete from public.run_tickets;

-- A player and another one
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000008a1', 'player@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-0000000008b2', 'other@example.com', '{"provider":"google"}');
update public.games set published = false where id = 'flashback-arcade';

select has_table('public', 'run_tickets', 'the run_tickets table exists');
select is((select relrowsecurity from pg_class where oid = 'public.run_tickets'::regclass), true,
  'run_tickets has row level security');
select has_table('public', 'game_runs', 'the game_runs table exists');
select is((select relrowsecurity from pg_class where oid = 'public.game_runs'::regclass), true,
  'game_runs has row level security');

-- ---------------------------------------------------------------------------
-- Visitors
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.run_tickets$$, '42501', null, 'visitors can''t read tickets');
select throws_ok($$select * from public.game_runs$$, '42501', null, '...nor runs');
select throws_ok($$select * from public.issue_tickets('snake')$$, '42501', null, '...nor get tickets');
select throws_ok($$select public.start_ticket(gen_random_uuid())$$, '42501', null, '...nor start one');
select throws_ok($$select * from public.my_records('snake')$$, '42501', null, '...nor have records');
reset role;

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);

select throws_ok($$select * from public.run_tickets$$, '42501', null, 'players can''t read the tickets table either');
select is((select count(*) from public.issue_tickets('snake')), 10::bigint, 'issue_tickets gives a player 10 tickets');
select is((select count(*) from public.issue_tickets('snake')), 10::bigint, '...and the same 10 again');
select throws_ok($$select * from public.issue_tickets('no-such-game')$$, 'P0002', null,
  'not for a game that doesn''t exist');
select throws_ok($$select * from public.issue_tickets('flashback-arcade')$$, 'P0002', null, '...or isn''t published');
select throws_ok($$select * from public.ticket_to_check('00000000-0000-4000-8000-0000000008a1', gen_random_uuid())$$,
  '42501', null, 'players can''t look a ticket up the Worker''s way');
select throws_ok($$select * from public.record_run('00000000-0000-4000-8000-0000000008a1', gen_random_uuid(), 'checked',
  null, null, 'over', 99999, null, '[]', '[]', '{}', 1000, 100, 10, null)$$,
  '42501', null, '...nor record a run themselves');
reset role;

select is((select count(*) from public.run_tickets where user_id = '00000000-0000-4000-8000-0000000008a1'), 10::bigint,
  'only 10 were made');
select is((select count(*) from public.run_tickets where seed between 0 and 4294967295), 10::bigint,
  'each seed is 32 bits');
select is((select count(distinct seed) from public.run_tickets), 10::bigint, '...and they differ');
select is((select count(*) from public.run_tickets
  where expires_at > now() + interval '13 days' and expires_at < now() + interval '15 days'), 10::bigint,
  'tickets are good for 14 days');

create temporary table picked as select id from public.run_tickets order by issued_at, id limit 1;
grant select on picked to authenticated, service_role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);
select is(public.start_ticket((select id from picked)), true, 'start_ticket starts a ready ticket');
select is(public.start_ticket((select id from picked)), false, '...once');
select is((select count(*) from public.issue_tickets('snake')), 10::bigint, 'a started ticket is no longer ready: 10 again');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008b2","role":"authenticated"}', true);
select is(public.start_ticket((select id from picked)), false, 'nobody else can start a player''s ticket');
reset role;

select is((select count(*) from public.run_tickets where user_id = '00000000-0000-4000-8000-0000000008a1'), 11::bigint,
  'one more was made to stand in for it');
-- (two more for the two taken below: 13)
select isnt((select started_at from public.run_tickets where id = (select id from picked)), null,
  'the ticket says when it was started');
select isnt((select taken_at from public.run_tickets where id = (select id from picked)), null, '...and that it''s taken');

-- Tickets taken offline, told once back online
create temporary table offline_taken as
  select id from public.run_tickets
  where user_id = '00000000-0000-4000-8000-0000000008a1' and game_id = 'snake' and taken_at is null
  order by issued_at, id limit 2;
grant select on offline_taken to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008b2","role":"authenticated"}', true);
select is(public.take_tickets(array(select id from offline_taken)), 0, 'nobody else can take a player''s tickets');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);
select is(public.take_tickets(array(select id from offline_taken)), 2, 'take_tickets takes the player''s tickets');
select is(public.take_tickets(array(select id from offline_taken)), 0, '...once');
select is((select count(*) from public.issue_tickets('snake')), 10::bigint, 'taken tickets are no longer ready: 10 again');
reset role;
select is((select count(*) from public.run_tickets where id in (select id from offline_taken) and started_at is null
  and taken_at is not null), 2::bigint, 'taken offline, they have no start: their runs count from when they were issued');

-- At most 300 a day per game
insert into public.run_tickets (user_id, game_id, seed, used_at)
select '00000000-0000-4000-8000-0000000008a1', 'tetris', 1, now() from generate_series(1, 295);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);
select is((select count(*) from public.issue_tickets('tetris')), 5::bigint, 'up to 300 tickets a day per game');
select is((select count(*) from public.issue_tickets('tetris')), 5::bigint, '...and no more');
reset role;

-- ---------------------------------------------------------------------------
-- The Worker: looking a ticket up, recording runs
-- ---------------------------------------------------------------------------
set local role service_role;
select is((select seed from public.ticket_to_check('00000000-0000-4000-8000-0000000008a1', (select id from picked))),
  (select seed from public.run_tickets where id = (select id from picked)), 'the Worker gets a player''s ticket and its seed');
select is((select count(*) from public.ticket_to_check('00000000-0000-4000-8000-0000000008b2', (select id from picked))),
  0::bigint, '...only for that player');
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008a1', (select id from picked), 'checked',
  null, null, 'over', 12, null, '[{"label":"Score","value":12}]', '[{"label":"Score","value":12}]', '{}', 14700, 100,
  147, '[0,"L"]')), true, 'a player''s first checked run is their record');
reset role;

select isnt((select used_at from public.run_tickets where id = (select id from picked)), null, 'its ticket is used');
select is((select row(game_id, status, score, played_ms, inputs)::text from public.game_runs),
  '(snake,checked,12,14700,"[0, ""L""]")', 'the run is kept, with what the replay gave');

-- Three more of the player's snake tickets, to record runs on
create temporary table more_tickets as
  select id, row_number() over (order by issued_at, id) as n from public.run_tickets
  where user_id = '00000000-0000-4000-8000-0000000008a1' and game_id = 'snake' and used_at is null
  order by issued_at, id limit 3;
grant select on more_tickets to service_role;
create function pg_temp.ticket(n integer) returns uuid language sql as $$ select id from more_tickets where more_tickets.n = $1 $$;

set local role service_role;
select throws_ok($$select * from public.record_run('00000000-0000-4000-8000-0000000008a1', (select id from picked), 'checked',
  null, null, 'over', 50, null, '[]', '[]', '{}', 1000, 100, 10, null)$$, 'P0002', null, 'a ticket is good for one run');
select throws_ok(format($$select * from public.record_run('00000000-0000-4000-8000-0000000008b2', %L, 'checked',
  null, null, 'over', 50, null, '[]', '[]', '{}', 1000, 100, 10, null)$$, pg_temp.ticket(1)), 'P0002', null,
  '...and only the player''s own');
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008a1', pg_temp.ticket(1), 'checked',
  null, null, 'over', 5, null, '[]', '[]', '{}', 1000, 100, 10, null)), false, 'a lower score isn''t a record');
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008a1', pg_temp.ticket(2), 'refused',
  'not-over', null, null, null, null, '[]', '[{"label":"Score","value":900}]', '{}', 1000, 100, 10, null)), false,
  'nor is a refused run');
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008a1', pg_temp.ticket(3), 'checked',
  null, null, 'over', 40, null, '[{"label":"Score","value":40}]', '[]', '{claim}', 2000, 100, 20, null)), true,
  'a higher score is a new record');
reset role;

update public.run_tickets set expires_at = now() - interval '1 minute'
where id = (select id from public.run_tickets where user_id = '00000000-0000-4000-8000-0000000008a1' and game_id = 'snake'
  and used_at is null order by issued_at, id limit 1);
set local role service_role;
select throws_ok(format($$select * from public.record_run('00000000-0000-4000-8000-0000000008a1', %L, 'checked',
  null, null, 'over', 50, null, '[]', '[]', '{}', 1000, 100, 10, null)$$,
  (select id from public.run_tickets where expires_at < now())), 'P0002', null, 'nor a ticket that ran out');
reset role;

-- Times: lower is better, per level
insert into public.run_tickets (id, user_id, game_id, seed) values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000008a1', 'sudoku', 1),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-0000000008a1', 'sudoku', 2),
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-0000000008a1', 'sudoku', 3),
  ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-0000000008a1', 'sudoku', 4),
  ('00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-0000000008b2', 'snake', 5);
set local role service_role;
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-00000000c001',
  'checked', null, 'easy', 'won', null, 60000, '[{"label":"Time","value":60}]', '[]', '{}', 60000, null, 60000, null)),
  true, 'a first win on a level is a record');
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-00000000c002',
  'checked', null, 'easy', 'won', null, 70000, '[]', '[]', '{}', 70000, null, 70000, null)), false, 'a slower one isn''t');
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-00000000c003',
  'checked', null, 'easy', 'won', null, 50000, '[{"label":"Time","value":50}]', '[]', '{}', 50000, null, 50000, null)),
  true, 'a faster one is');
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-00000000c004',
  'checked', null, 'hard', 'won', null, 90000, '[{"label":"Time","value":90}]', '[]', '{}', 90000, null, 90000, null)),
  true, 'each level has its own record');
select is((select best from public.record_run('00000000-0000-4000-8000-0000000008b2', '00000000-0000-4000-8000-00000000c005',
  'checked', null, null, 'over', 900, null, '[{"label":"Score","value":900}]', '[]', '{}', 9000, 100, 90, null)), true,
  'each player has their own');
reset role;

-- ---------------------------------------------------------------------------
-- Records
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);
select is((select row(mode, score, result)::text from public.my_records('snake')),
  '(,40,"[{""label"": ""Score"", ""value"": 40}]")', 'my_records: the best checked score (not refused, not another player''s)');
select is((select array_agg(row(mode, time_ms)::text order by mode) from public.my_records('sudoku')),
  array['(easy,50000)', '(hard,90000)'], '...and the fastest win on each level');
select is((select count(*) from public.my_records('tetris')), 0::bigint, '...none where nothing was checked');
reset role;

-- ---------------------------------------------------------------------------
-- Tidying up
-- ---------------------------------------------------------------------------
update public.game_runs set checked_at = now() - interval '31 days', inputs = '[0,"L"]';
update public.run_tickets set expires_at = now() - interval '31 days'
where user_id = '00000000-0000-4000-8000-0000000008a1' and game_id = 'tetris' and used_at is null;
select private.tidy_runs();
select is((select count(*) from public.game_runs where inputs is not null), 4::bigint,
  'tidy_runs keeps the inputs of each player''s records (snake, two levels of sudoku, the other player)');
select is((select count(*) from public.game_runs where inputs is null), 5::bigint, '...and lets the rest go after 30 days');
select is((select count(*) from public.run_tickets where game_id = 'tetris' and used_at is null), 0::bigint,
  'tickets that ran out over a month ago, unused, go');
select is((select count(*) from public.run_tickets where game_id = 'tetris'), 295::bigint, '...used ones stay');

-- ---------------------------------------------------------------------------
-- Deleted with the account
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-8000-0000000008a1';
select is((select count(*) from public.run_tickets where user_id = '00000000-0000-4000-8000-0000000008a1'), 0::bigint,
  'deleting the account deletes its tickets');
select is((select count(*) from public.game_runs where user_id = '00000000-0000-4000-8000-0000000008a1'), 0::bigint,
  '...and its runs');

select * from finish();
rollback;
