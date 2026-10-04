-- Tests for supabase/migrations/*_activity_controls.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- Inside the transaction now() doesn't move, so time passing is tested by moving sessions back.
-- A player (P) and their friend (F): P turns their play history off and on, and deletes it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

delete from public.play_sessions;
delete from public.privacy_settings;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-000000000ca1', 'controls-player@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-000000000cb2', 'controls-friend@example.com', '{"provider":"google"}');
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('00000000-0000-4000-8000-000000000ca1', '00000000-0000-4000-8000-000000000cb2',
   '00000000-0000-4000-8000-000000000ca1', 'accepted', now());

select hasnt_function('public', 'set_privacy', array['text', 'text', 'text'],
  'set_privacy takes the switch now (the old one is gone, so the two don''t clash)');

-- ---------------------------------------------------------------------------
-- Out of the box: a history
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ca1","role":"authenticated"}', true);
select is((select record_played from public.my_privacy()), true, 'a history, out of the box');
select isnt(public.start_play('snake'), null, 'start_play makes a play');
reset role;

-- The play goes on: 2 minutes so far, and still going
update public.play_sessions set seconds = 120, started_at = now() - interval '3 minutes', last_seen_at = now()
where user_id = '00000000-0000-4000-8000-000000000ca1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000cb2","role":"authenticated"}', true);
select is((select game_id from public.playing_now(array['00000000-0000-4000-8000-000000000ca1'::uuid])), 'snake',
  'a friend sees what P is playing now (playing now is for friends out of the box)');
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ca1')), 0::bigint,
  '...but not the play still going, in the Played tab');
select is((select count(*) from public.recent_activity(50) where user_id = '00000000-0000-4000-8000-000000000ca1'), 0::bigint,
  '...nor in the recent activity');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ca1","role":"authenticated"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ca1')), 1::bigint,
  'P sees their own play still going');
select is((select game_id from public.playing_now(array['00000000-0000-4000-8000-000000000ca1'::uuid])), 'snake',
  '...and what they''re playing now');
reset role;

-- No report for 2 minutes: the play is over
update public.play_sessions set last_seen_at = now() - interval '3 minutes'
where user_id = '00000000-0000-4000-8000-000000000ca1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000cb2","role":"authenticated"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ca1')), 1::bigint,
  'once it''s over, the friend sees it in the Played tab');
select is((select count(*) from public.recent_activity(50) where user_id = '00000000-0000-4000-8000-000000000ca1'), 1::bigint,
  '...and in the recent activity');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ca1')), 1::bigint,
  '...as do visitors (played games are for everyone out of the box)');
reset role;
update public.play_sessions set ended_at = now() where user_id = '00000000-0000-4000-8000-000000000ca1';

-- P plays Tetris now
insert into public.play_sessions (id, user_id, game_id, started_at, last_seen_at, seconds) values
  ('00000000-0000-4000-8000-00000000c0a2', '00000000-0000-4000-8000-000000000ca1', 'tetris',
   now() - interval '1 minute', now(), 50);

-- ---------------------------------------------------------------------------
-- Who sees what P plays now (one of the history's choices)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ca1","role":"authenticated"}', true);
select public.set_privacy(p_show_playing => 'nobody');
select is(public.report_play('00000000-0000-4000-8000-00000000c0a2', 30), 60, 'the play counts, whoever sees it');
select is((select game_id from public.playing_now(array['00000000-0000-4000-8000-000000000ca1'::uuid])), 'tetris',
  'only me: P sees what they''re playing now');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000cb2","role":"authenticated"}', true);
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-000000000ca1'::uuid])), 0::bigint,
  '...and the friend doesn''t');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ca1","role":"authenticated"}', true);
select public.set_privacy(p_show_playing => 'everyone');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select game_id from public.playing_now(array['00000000-0000-4000-8000-000000000ca1'::uuid])), 'tetris',
  'everyone: visitors see it too');
reset role;

-- ---------------------------------------------------------------------------
-- P's history: off
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ca1","role":"authenticated"}', true);
select public.set_privacy(p_record_played => false);
select is((select row(record_played, show_played, show_playing, show_activity)::text from public.my_privacy()),
  '(f,everyone,everyone,everyone)', 'turning the history off keeps who sees what, for when it''s back on');
select is(public.start_play('snake'), null, 'start_play makes no play while the history is off');
select is(public.report_play('00000000-0000-4000-8000-00000000c0a2', 30), null, '...and report_play adds nothing');
reset role;
select is((select seconds from public.play_sessions where id = '00000000-0000-4000-8000-00000000c0a2'), 60,
  '...the play going on keeps the time it had');
select is((select count(*) from public.play_sessions where user_id = '00000000-0000-4000-8000-000000000ca1'), 2::bigint,
  '...and only the plays from before are there');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000cb2","role":"authenticated"}', true);
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-000000000ca1'::uuid])), 0::bigint,
  'what P is playing now goes with the history, whoever P shows it to');
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ca1')), 0::bigint,
  'the history kept so far is only P''s now: the friend sees none of it');
select is((select count(*) from public.recent_activity(50) where user_id = '00000000-0000-4000-8000-000000000ca1'), 0::bigint,
  '...nor in the recent activity');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ca1","role":"authenticated"}', true);
select is((select array_agg(game_id order by game_id) from public.player_played('00000000-0000-4000-8000-000000000ca1')),
  array['snake', 'tetris'], 'P still sees their own');
select is((select count(*) from public.playing_now(array['00000000-0000-4000-8000-000000000ca1'::uuid])), 0::bigint,
  '...but not as playing now: GameHub doesn''t know of a play going on');
select is((select count(*) from public.recent_activity(50) where user_id = '00000000-0000-4000-8000-000000000ca1'), 2::bigint,
  '...in the recent activity too');
select public.set_privacy(p_record_played => true);
select isnt(public.start_play('snake'), null, 'back on: plays are recorded again');

-- ---------------------------------------------------------------------------
-- Deleting the history
-- ---------------------------------------------------------------------------
select is(public.delete_my_play_history(), 3, 'delete_my_play_history deletes all of P''s plays');
reset role;
select is((select count(*) from public.play_sessions where user_id = '00000000-0000-4000-8000-000000000ca1'), 0::bigint,
  '...none left');
insert into public.play_sessions (user_id, game_id, seconds) values ('00000000-0000-4000-8000-000000000cb2', 'snake', 90);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000ca1","role":"authenticated"}', true);
select is((select count(*) from public.player_played('00000000-0000-4000-8000-000000000ca1')), 0::bigint,
  '...not even for P');
select is(public.delete_my_play_history(), 0, 'deleting again: nothing left');
reset role;
select is((select count(*) from public.play_sessions where user_id = '00000000-0000-4000-8000-000000000cb2'), 1::bigint,
  'other players'' plays stay');

-- ---------------------------------------------------------------------------
-- Visitors
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.delete_my_play_history()$$, '42501', null, 'visitors can''t delete a history');
select throws_ok($$select public.set_privacy(p_record_played => false)$$, '42501', null, '...nor turn one off');
select throws_ok($$select private.keeps_history('00000000-0000-4000-8000-000000000ca1')$$, '42501', null,
  '...nor call the helpers');
reset role;

select * from finish();
rollback;
