-- Tests for supabase/migrations/*_records_by_score_then_time.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- Solitaire's runs have a score and a time: a new record must be what my_records() puts first.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

delete from public.game_runs;
delete from public.run_tickets;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000009a1', 'records-player@example.com', '{"provider":"google"}');
insert into public.games (id, kind, title, description, published) values ('solitaire', 'game', 'Solitaire', 'Cards.', true)
on conflict (id) do nothing;
insert into public.run_tickets (id, user_id, game_id, seed)
select ('00000000-0000-4000-8000-0000000d' || lpad(n::text, 4, '0'))::uuid, '00000000-0000-4000-8000-0000000009a1',
  'solitaire', n
from generate_series(1, 11) n;

select ok(not has_function_privilege('anon',
  'public.record_run(uuid, uuid, text, text, text, text, bigint, bigint, jsonb, jsonb, text[], bigint, integer, bigint, jsonb)',
  'execute'), 'record_run is still only for the Worker');
select ok(not has_function_privilege('authenticated',
  'public.record_run(uuid, uuid, text, text, text, text, bigint, bigint, jsonb, jsonb, text[], bigint, integer, bigint, jsonb)',
  'execute'), '...not for players either');

-- A run on ticket n, on a level, with a score and a win's time (or none): whether it's a new record
create function pg_temp.best(n integer, mode text, score bigint, time_ms bigint)
returns boolean language sql as $$
  select best from public.record_run('00000000-0000-4000-8000-0000000009a1',
    ('00000000-0000-4000-8000-0000000d' || lpad(n::text, 4, '0'))::uuid, 'checked', null, mode,
    case when time_ms is null then 'lost' else 'won' end, score, time_ms, '[]', '[]', '{}', 1000, null, 1000, null)
$$;

set local role service_role;
-- Standard: a win's score, then its time
select is(pg_temp.best(1, 'standard-3', 3996, 204000), true, 'a first win is the record');
select is(pg_temp.best(2, 'standard-3', 3000, 150000), false, 'a faster win with a lower score isn''t');
select is(pg_temp.best(3, 'standard-3', 3996, 204000), false, 'nor the same score in the same time');
select is(pg_temp.best(4, 'standard-3', 3996, 200000), true, 'the same score, faster, is');
select is(pg_temp.best(5, 'standard-3', 4100, 300000), true, 'a higher score is, however slow');
-- Vegas: the dollars, won or not
select is(pg_temp.best(6, 'vegas-3', -32, null), true, 'a first Vegas game, lost, is the record');
select is(pg_temp.best(7, 'vegas-3', 50, 300000), true, 'more dollars, won, is');
select is(pg_temp.best(8, 'vegas-3', 20, 100000), false, 'fewer dollars, faster, isn''t');
select is(pg_temp.best(9, 'vegas-3', 50, 200000), true, 'the same dollars, faster, is');
-- No scoring: the fastest win
select is(pg_temp.best(10, 'none-1', null, 90000), true, 'a first win without scoring is the record');
select is(pg_temp.best(11, 'none-1', null, 95000), false, 'a slower one isn''t');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000009a1","role":"authenticated"}', true);
select is((select array_agg(row(mode, score, time_ms)::text order by mode) from public.my_records('solitaire')),
  array['(none-1,,90000)', '(standard-3,4100,300000)', '(vegas-3,50,200000)'],
  'my_records keeps the same runs the flags said were records');
reset role;

select * from finish();
rollback;
