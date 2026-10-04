-- Tests for supabase/migrations/*_play_activity.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- Inside the transaction now() doesn't move, so time passing is tested by moving sessions back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

delete from public.play_sessions;
delete from public.privacy_settings;

-- A player, their friend, and a stranger
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000007a1', 'player@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-0000000007b2', 'friend@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-0000000007c3', 'stranger@example.com', '{"provider":"google"}');
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-0000000007b2',
   '00000000-0000-4000-8000-0000000007a1', 'accepted', now());
update public.games set published = false where id = 'minesweeper';

select has_table('public', 'play_sessions', 'the play_sessions table exists');
select is((select relrowsecurity from pg_class where oid = 'public.play_sessions'::regclass), true,
  'play_sessions has row level security');
select has_table('public', 'privacy_settings', 'the privacy_settings table exists');
select is((select relrowsecurity from pg_class where oid = 'public.privacy_settings'::regclass), true,
  'privacy_settings has row level security');

-- ---------------------------------------------------------------------------
-- Visitors
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.play_sessions$$, '42501', null, 'visitors can''t read play sessions');
select throws_ok($$select * from public.privacy_settings$$, '42501', null, '...nor privacy settings');
select throws_ok($$select public.start_play('snake')$$, '42501', null, 'visitors can''t start a play session');
select throws_ok($$select * from public.my_privacy()$$, '42501', null, '...nor have privacy settings');
reset role;

-- ---------------------------------------------------------------------------
-- Starting a session
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);

select throws_ok($$select * from public.play_sessions$$, '42501', null, 'players can''t read the table either');
select is((select row(show_played, show_playing, show_activity)::text from public.my_privacy()),
  '(everyone,friends,everyone)', 'the defaults: played games and activity for everyone, playing now for friends');
select isnt(public.start_play('snake'), null, 'start_play starts a session and gives its id');
select throws_ok($$select public.start_play('no-such-game')$$, 'P0002', null, 'not for a game that doesn''t exist');
select throws_ok($$select public.start_play('minesweeper')$$, 'P0002', null, '...or isn''t published');
reset role;

select is((select count(*) from public.play_sessions
  where user_id = '00000000-0000-4000-8000-0000000007a1' and game_id = 'snake' and seconds = 0), 1::bigint,
  'the new session is the player''s, with no time yet');

-- ---------------------------------------------------------------------------
-- Reporting time
-- ---------------------------------------------------------------------------
delete from public.play_sessions;
insert into public.play_sessions (id, user_id, game_id, started_at, last_seen_at, seconds) values
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-0000000007a1', 'snake', now(), now(), 0),
  ('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-0000000007a1', 'snake',
   now() - interval '7 hours', now() - interval '1 minute', 0),
  ('00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-0000000007a1', 'snake',
   now() - interval '5 hours', now() - interval '10 minutes', 21590),
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000007b2', 'snake', now(), now(), 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select is(public.report_play('00000000-0000-4000-8000-00000000a001', 60), 10,
  'a report adds no more than the time since the last one (here none), plus 10 s');
reset role;
update public.play_sessions set last_seen_at = now() - interval '90 seconds'
where id = '00000000-0000-4000-8000-00000000a001';
set local role authenticated;
select is(public.report_play('00000000-0000-4000-8000-00000000a001', 100), 110, 'after 90 s, 100 s fit');
reset role;
update public.play_sessions set last_seen_at = now() - interval '10 minutes'
where id = '00000000-0000-4000-8000-00000000a001';
set local role authenticated;
select is(public.report_play('00000000-0000-4000-8000-00000000a001', 500), 230, 'a report adds at most 120 s');
select is(public.report_play('00000000-0000-4000-8000-00000000a001', -50), 230, 'negative time adds nothing');
select is(public.report_play('00000000-0000-4000-8000-00000000a001', 0, true), 230, 'the last report ends the session');
select is(public.report_play('00000000-0000-4000-8000-00000000a001', 5), null, '...and an ended session takes no more');
select is(public.report_play('00000000-0000-4000-8000-00000000a002', 30), null,
  'a session that started over 6 hours ago takes no more');
select is(public.report_play('00000000-0000-4000-8000-00000000a003', 120), 21600, 'a session holds 6 hours at most');
select is(public.report_play('00000000-0000-4000-8000-00000000b001', 30), null, 'players can''t report on another''s session');
reset role;
select is((select seconds from public.play_sessions where id = '00000000-0000-4000-8000-00000000b001'), 0,
  '...which keeps its time');

-- At most 30 sessions an hour
insert into public.play_sessions (user_id, game_id, started_at)
select '00000000-0000-4000-8000-0000000007c3', 'snake', now() - interval '10 minutes' from generate_series(1, 30);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007c3","role":"authenticated"}', true);
select throws_ok($$select public.start_play('snake')$$, 'P0001', null, 'at most 30 play sessions an hour');
reset role;

-- ---------------------------------------------------------------------------
-- Who sees the games a player has played
-- ---------------------------------------------------------------------------
-- The player has played snake (a001 and a003, both over now) and tetris (a005, just over), and is
-- playing tetris again right now (a006: since the activity controls migration, a play still going
-- shows only as playing now)
update public.play_sessions set ended_at = now() where id = '00000000-0000-4000-8000-00000000a003';
insert into public.play_sessions (id, user_id, game_id, started_at, last_seen_at, seconds, ended_at) values
  ('00000000-0000-4000-8000-00000000a005', '00000000-0000-4000-8000-0000000007a1', 'tetris',
   now() - interval '5 minutes', now() - interval '30 seconds', 70, now() - interval '30 seconds'),
  ('00000000-0000-4000-8000-00000000a006', '00000000-0000-4000-8000-0000000007a1', 'tetris',
   now() - interval '20 seconds', now() - interval '10 seconds', 10, null);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(game_id order by game_id) from public.player_played('00000000-0000-4000-8000-0000000007a1')),
  array['snake', 'tetris'], 'everyone sees the games a player has played, by default');
select is((select plays from public.player_played('00000000-0000-4000-8000-0000000007a1') where game_id = 'snake'), 2,
  '...how many times (sessions of a minute or more)');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select public.set_privacy(p_show_played => 'friends');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-0000000007a1')), 0::bigint,
  'friends only: visitors don''t see them');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007c3","role":"authenticated"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-0000000007a1')), 0::bigint,
  '...nor strangers');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007b2","role":"authenticated"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-0000000007a1')), 2::bigint,
  '...but friends do');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select public.set_privacy(p_show_played => 'nobody');
select is((select count(*) from public.player_played('00000000-0000-4000-8000-0000000007a1')), 2::bigint,
  'only me: the player still sees their own');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007b2","role":"authenticated"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-0000000007a1')), 0::bigint,
  '...and friends don''t');

-- ---------------------------------------------------------------------------
-- Who sees what a player is playing now
-- ---------------------------------------------------------------------------
select is((select game_id from public.playing_now(array['00000000-0000-4000-8000-0000000007a1'::uuid])), 'tetris',
  'friends see what a player is playing now, by default');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007c3","role":"authenticated"}', true);
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-0000000007a1'::uuid])), 0::bigint,
  '...strangers don''t');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select public.set_privacy(p_show_playing => 'everyone');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007c3","role":"authenticated"}', true);
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-0000000007a1'::uuid])), 1::bigint,
  'everyone: strangers do too');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-0000000007a1'::uuid])), 1::bigint,
  '...and visitors');
reset role;
update public.play_sessions set last_seen_at = now() - interval '3 minutes'
where id = '00000000-0000-4000-8000-00000000a006';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-0000000007a1'::uuid])), 0::bigint,
  'no report for 2 minutes: not playing any more');
reset role;

-- ---------------------------------------------------------------------------
-- Who sees a player in the recent activity
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(game_id order by game_id) from public.recent_activity()), array['snake', 'tetris'],
  'recent activity: one row per player and game, plays of a minute or more, for everyone by default');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select public.set_privacy(p_show_activity => 'friends');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007c3","role":"authenticated"}', true);
select is((select count(*) from public.recent_activity()), 0::bigint, 'friends only: strangers don''t see them in it');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007b2","role":"authenticated"}', true);
select is((select count(*) from public.recent_activity()), 2::bigint, '...friends do');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select public.set_privacy(p_show_activity => 'nobody');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007b2","role":"authenticated"}', true);
select is((select count(*) from public.recent_activity()), 0::bigint, 'only me: friends don''t either');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select is((select count(*) from public.recent_activity()), 2::bigint, '...the player still sees their own');

-- ---------------------------------------------------------------------------
-- Privacy settings
-- ---------------------------------------------------------------------------
select is((select row(show_played, show_playing, show_activity)::text from public.my_privacy()),
  '(nobody,everyone,nobody)', 'each change kept the other two');
select throws_ok($$select public.set_privacy(p_show_played => 'public')$$, '23514', null,
  'a choice is everyone, friends or nobody');
reset role;
select is((select count(*) from public.privacy_settings), 1::bigint, 'one row per player who changed something');

-- ---------------------------------------------------------------------------
-- Deleted with the account
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-8000-0000000007a1';
select is((select count(*) from public.play_sessions where user_id = '00000000-0000-4000-8000-0000000007a1'), 0::bigint,
  'deleting the account deletes its play sessions');
select is((select count(*) from public.privacy_settings where user_id = '00000000-0000-4000-8000-0000000007a1'), 0::bigint,
  '...and its privacy settings');

select * from finish();
rollback;
