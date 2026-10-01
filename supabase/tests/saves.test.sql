-- Tests for supabase/migrations/*_saves.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- The test starts from an empty table (inside the transaction, so nothing is really deleted), like
-- the other tests, so saves made while trying the site locally can't change its counts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

delete from public.game_saves;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000005a1', 'saver@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-0000000005b2', 'other@example.com', '{"provider":"google"}');

select has_table('public', 'game_saves', 'the game_saves table exists');
select is((select relrowsecurity from pg_class where oid = 'public.game_saves'::regclass), true,
  'game_saves has row level security');

-- ---------------------------------------------------------------------------
-- Visitors (anon)
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.game_saves$$, '42501', null, 'visitors cannot read saves');
select throws_ok($$select public.save_game('snake', '{"highScore": 1}')$$, '42501', null, 'visitors cannot save');
select throws_ok($$select public.delete_game_save('snake')$$, '42501', null, 'visitors cannot delete saves');
reset role;

-- ---------------------------------------------------------------------------
-- A signed-in player
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000005a1","role":"authenticated"}', true);

select isnt(public.save_game('snake', '{"highScore": 12}'), null, 'save_game keeps a save and says when');
select is((select data from public.game_saves where game_id = 'snake'), '{"highScore": 12}'::jsonb,
  '...which the player can read back');
select lives_ok($$select public.save_game('snake', '{"highScore": 30}')$$, 'saving again');
select is((select count(*) from public.game_saves), 1::bigint, '...replaces the save (one per game)');
select is((select data ->> 'highScore' from public.game_saves where game_id = 'snake'), '30', '...with the new data');
select lives_ok($$select public.save_game('sudoku', '{"level": "hard", "board": null}')$$, 'each game has a save of its own');

select throws_ok($$select public.save_game('snake', '[1, 2, 3]')$$, '23514', null, 'a save must be an object (not an array)');
select throws_ok($$select public.save_game('snake', '12')$$, '23514', null, '...nor a number');
select throws_ok($$select public.save_game('snake', null)$$, '23502', null, '...nor nothing');
select throws_ok($$select public.save_game('snake', jsonb_build_object('big', repeat('x', 140000)))$$,
  '23514', null, 'saves over the size limit are refused');
select throws_ok($$select public.save_game('no-such-game', '{}')$$, '23503', null, 'saves for unknown games are refused');

select throws_ok($$insert into public.game_saves (user_id, game_id, data)
  values ('00000000-0000-4000-8000-0000000005a1', 'tetris', '{}')$$, '42501', null, 'no writing to the table directly');
select throws_ok($$update public.game_saves set data = '{}'$$, '42501', null, '...or changing it');

-- Another player sees none of it
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000005b2","role":"authenticated"}', true);
select is((select count(*) from public.game_saves), 0::bigint, 'players cannot read each other''s saves');
select is(public.delete_game_save('snake'), false, 'nor delete them (there''s nothing of theirs to delete)');

-- Reset progress
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000005a1","role":"authenticated"}', true);
select is(public.delete_game_save('snake'), true, 'delete_game_save removes the player''s save');
select is((select array_agg(game_id) from public.game_saves), array['sudoku'], '...and only that game''s');
select is(public.delete_game_save('snake'), false, '...and says when there was none');
reset role;

-- ---------------------------------------------------------------------------
-- Deleting the account deletes the saves
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-8000-0000000005a1';
select is((select count(*) from public.game_saves where user_id = '00000000-0000-4000-8000-0000000005a1'), 0::bigint,
  'a deleted account''s saves go with it');

select * from finish();
rollback;
