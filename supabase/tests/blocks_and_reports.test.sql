-- Tests for supabase/migrations/*_blocks_and_reports.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- The test starts from empty blocks, reports, friendships and play sessions (inside the transaction,
-- so nothing is really deleted), so what's tried on the local site doesn't change its counts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(58);

delete from public.blocks;
delete from public.player_reports;
delete from public.friendships;
delete from public.play_sessions;
delete from public.privacy_settings;

-- A blocks B; C is someone else. Ten more players for the reports' daily limit.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-000000000ba1', 'block-a@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-000000000bb2', 'block-b@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-000000000bc3', 'block-c@example.com', '{"provider":"google"}');
insert into auth.users (id, email, raw_app_meta_data)
select ('00000000-0000-4000-8000-0000000012' || lpad(n::text, 2, '0'))::uuid, format('reported-%s@example.com', n),
  '{"provider":"google"}'
from generate_series(1, 10) as n;

-- A and B are friends, and C has asked A
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('00000000-0000-4000-8000-000000000ba1', '00000000-0000-4000-8000-000000000bb2',
   '00000000-0000-4000-8000-000000000ba1', 'accepted', now()),
  ('00000000-0000-4000-8000-000000000ba1', '00000000-0000-4000-8000-000000000bc3',
   '00000000-0000-4000-8000-000000000bc3', 'pending', null);
-- A and B have each played Snake for 2 minutes, and A is playing it now, for everyone to see
insert into public.play_sessions (user_id, game_id, started_at, last_seen_at, seconds, ended_at) values
  ('00000000-0000-4000-8000-000000000ba1', 'snake', now() - interval '3 minutes', now(), 120, null),
  ('00000000-0000-4000-8000-000000000bb2', 'snake', now() - interval '1 hour', now() - interval '50 minutes', 120,
   now() - interval '50 minutes');
insert into public.privacy_settings (user_id, show_playing) values ('00000000-0000-4000-8000-000000000ba1', 'everyone');

select is((select relrowsecurity from pg_class where oid = 'public.blocks'::regclass), true,
  'blocks has row level security');
select is((select relrowsecurity from pg_class where oid = 'public.player_reports'::regclass), true,
  'player_reports has row level security');

-- ---------------------------------------------------------------------------
-- Before: B sees what A plays
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000bb2","role":"authenticated"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ba1')), 1::bigint,
  'before: B sees A''s games played');
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-000000000ba1'::uuid])), 1::bigint,
  '...that A is playing now');
select is((select count(*) from public.recent_activity(50) where user_id = '00000000-0000-4000-8000-000000000ba1'),
  1::bigint, '...and A''s plays in the recent activity');

-- ---------------------------------------------------------------------------
-- A blocks B
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ba1","role":"authenticated"}', true);
select is(public.block_player('00000000-0000-4000-8000-000000000bb2'), true, 'A blocks B');
select is(public.block_player('00000000-0000-4000-8000-000000000bb2'), false, '...blocking again changes nothing');
select is((select count(*) from public.player_friends('00000000-0000-4000-8000-000000000ba1')
           where id = '00000000-0000-4000-8000-000000000bb2'), 0::bigint, '...and they aren''t friends any more');
select results_eq($$select blocked from public.blocks$$, $$values ('00000000-0000-4000-8000-000000000bb2'::uuid)$$,
  'A sees their block');
select throws_ok($$select public.send_friend_request('00000000-0000-4000-8000-000000000bb2')$$, 'P0001',
  'You''ve blocked this player. Unblock them first.', 'A can''t ask B to be friends while blocking them');
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000bb2')), 0::bigint,
  'A doesn''t see B''s games played');
select is((select count(*) from public.recent_activity(50) where user_id = '00000000-0000-4000-8000-000000000bb2'),
  0::bigint, '...nor B''s plays in the recent activity');
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ba1')), 1::bigint,
  '...but still their own');
select throws_ok($$select public.block_player('00000000-0000-4000-8000-000000000ba1')$$, 'P0001', null,
  'no blocking yourself');
select throws_ok($$select public.block_player('00000000-0000-4000-8000-00000000ffff')$$, 'P0001', null,
  '...nor players who don''t exist');
select throws_ok($$insert into public.blocks (blocker, blocked) values
  ('00000000-0000-4000-8000-000000000ba1', '00000000-0000-4000-8000-000000000bc3')$$, '42501', null,
  'no writing to the table directly');
select throws_ok($$delete from public.blocks$$, '42501', null, '...nor deleting from it');

-- B, blocked
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000bb2","role":"authenticated"}', true);
select is((select count(*) from public.blocks), 0::bigint, 'B can''t see that A blocked them');
select throws_ok($$select public.send_friend_request('00000000-0000-4000-8000-000000000ba1')$$, 'P0001',
  'You can''t add this player as a friend.', 'B can''t ask A to be friends, and isn''t told why');
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ba1')), 0::bigint,
  'B doesn''t see A''s games played any more');
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-000000000ba1'::uuid])), 0::bigint,
  '...nor that A is playing now');
select is((select count(*) from public.recent_activity(50) where user_id = '00000000-0000-4000-8000-000000000ba1'),
  0::bigint, '...nor A''s plays in the recent activity');
select is(public.unblock_player('00000000-0000-4000-8000-000000000ba1'), false, 'B can''t lift A''s block');

-- C, someone else, still sees both
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000bc3","role":"authenticated"}', true);
select is((select count(*) from public.blocks), 0::bigint, 'others can''t see the block either');
select is((select count(*) from public.recent_activity(50)), 2::bigint, '...and still see both players'' plays');
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-000000000ba1'::uuid])), 1::bigint,
  '...and that A is playing now');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.blocks$$, '42501', null, 'visitors can''t read blocks');
select throws_ok($$select public.block_player('00000000-0000-4000-8000-000000000ba1')$$, '42501', null,
  '...nor block anyone');
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ba1')), 1::bigint,
  'visitors still see A''s games played');
reset role;

-- ---------------------------------------------------------------------------
-- A request either way is dropped; unblocking
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ba1","role":"authenticated"}', true);
select is(public.block_player('00000000-0000-4000-8000-000000000bc3'), true, 'A blocks C, who had asked them');
select is((select count(*) from public.my_friend_requests()), 0::bigint, '...and C''s request is gone');
select is(public.unblock_player('00000000-0000-4000-8000-000000000bb2'), true, 'A unblocks B');
select is(public.unblock_player('00000000-0000-4000-8000-000000000bb2'), false, '...unblocking again changes nothing');
select results_eq($$select blocked from public.blocks$$, $$values ('00000000-0000-4000-8000-000000000bc3'::uuid)$$,
  '...C is still blocked');
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000bb2')), 1::bigint,
  'A sees B''s games again');
select is((select count(*) from public.player_friends('00000000-0000-4000-8000-000000000ba1')
           where id = '00000000-0000-4000-8000-000000000bb2'), 0::bigint, '...but they aren''t friends again by themselves');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000bb2","role":"authenticated"}', true);
select is(public.send_friend_request('00000000-0000-4000-8000-000000000ba1'), 'pending', 'B can ask A to be friends again');

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000bc3","role":"authenticated"}', true);
select lives_ok($$select public.report_player('00000000-0000-4000-8000-000000000ba1', 'cheating', 'snake',
  '  Their Snake record is 9999  ')$$, 'C reports A for cheating at Snake (A blocking C doesn''t stop it)');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000000ba1', 'other', null, 'And their name')$$,
  'P0001', 'You''ve already reported this player today. The developer will look into it.',
  'one report a day about the same player');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000000bb2', 'other', null, '   ')$$, 'P0001',
  'Say what happened, so the developer knows what to look for.', 'something else needs a message');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000000bb2', 'other')$$, 'P0001',
  'Say what happened, so the developer knows what to look for.', '...even with none given');
select lives_ok($$select public.report_player('00000000-0000-4000-8000-000000000bb2', 'other', 'tetris',
  'Their picture is offensive')$$, 'C reports B for something else');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000001210', 'rude', null, 'Hm')$$, '23514',
  null, 'only the two reasons');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000001210', 'other', null, repeat('x', 2001))$$,
  '23514', null, 'a message is at most 2,000 characters');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000001210', 'cheating', 'no-such-game')$$,
  '23503', null, 'the game has to be one of the games');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000000bc3', 'cheating')$$, 'P0001', null,
  'no reporting yourself');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-00000000ffff', 'cheating')$$, 'P0001', null,
  '...nor players who don''t exist');
select lives_ok($$select public.report_player(('00000000-0000-4000-8000-0000000012' || lpad(n::text, 2, '0'))::uuid,
  'cheating') from generate_series(1, 8) as n$$, 'C reports 8 more players: 10 in a day');
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000001209', 'cheating')$$, 'P0001',
  'That''s a lot of reports for one day. Try again tomorrow.', 'at most 10 reports a day');
select throws_ok($$select * from public.player_reports$$, '42501', null, 'players can''t read reports back');
select throws_ok($$insert into public.player_reports (reporter, reported, reason) values
  ('00000000-0000-4000-8000-000000000bc3', '00000000-0000-4000-8000-000000001210', 'cheating')$$, '42501', null,
  '...nor write them directly');
reset role;

set local role anon;
select throws_ok($$select public.report_player('00000000-0000-4000-8000-000000000ba1', 'cheating')$$, '42501', null,
  'visitors can''t report');
reset role;

-- What the developer sees, in the table editor
select results_eq(
  $$select reason, game_id, message from public.player_reports where reported = '00000000-0000-4000-8000-000000000ba1'$$,
  $$values ('cheating', 'snake', 'Their Snake record is 9999')$$,
  'a report keeps the reason, the game and the message, trimmed');
select is((select game_id from public.player_reports where reported = '00000000-0000-4000-8000-000000000bb2'), null,
  '...the game only for cheating');
select is((select count(*) from public.player_reports where reporter = '00000000-0000-4000-8000-000000000bc3'),
  10::bigint, 'C''s 10 reports are kept');

-- ---------------------------------------------------------------------------
-- Deleting an account
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-8000-000000000ba1';
select is((select count(*) from public.blocks where '00000000-0000-4000-8000-000000000ba1' in (blocker, blocked)),
  0::bigint, 'deleting an account deletes its blocks');
select is((select count(*) from public.player_reports where reported = '00000000-0000-4000-8000-000000000ba1'),
  0::bigint, '...and the reports about it');
delete from auth.users where id = '00000000-0000-4000-8000-000000000bc3';
select is((select count(*) from public.player_reports), 0::bigint, '...and the reports it sent');

select * from finish();
rollback;
