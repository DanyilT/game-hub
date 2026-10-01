-- Tests for supabase/migrations/*_games.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end, so
-- the test's deploy hook secret and queued request never leave the transaction.
-- Within the test everything happens at one moment (now() is the transaction's start), so the
-- 30-second quiet period is tested by moving the rebuild request back in time.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ---------------------------------------------------------------------------
-- The table and its starting rows
-- ---------------------------------------------------------------------------
select has_table('public', 'games', 'the games table exists');
select is((select relrowsecurity from pg_class where oid = 'public.games'::regclass), true, 'games has row level security');
select is((select count(*) from public.games where published), 6::bigint, 'the six games of games.json are there, published');
select is(
  (select array_agg(id order by position) from public.games),
  array['snake', 'tetris', 'minesweeper', 'sudoku', 'chillzone', 'flashback-arcade'],
  'in games.json''s order'
);
select is(
  (select array_agg(key) from public.games, json_object_keys(platforms -> 0) as key where id = 'snake'),
  array['type', 'url', 'embed'],
  'json columns keep their keys in the order they were written'
);
select is(
  (select array[style is null, dimensions is null, website is null, released is null, icon_url is null]
   from public.games where id = 'flashback-arcade'),
  array[true, true, true, true, true],
  'fields an entry leaves out stay empty'
);
select is(
  (select array[released::text, icon_url] from public.games where id = 'snake'),
  array['2025-04-24', 'https://snake.dt-games.pages.dev/img/snake.png'],
  'the release date is a date, and the icon came across'
);

-- ---------------------------------------------------------------------------
-- Who can read and write
-- ---------------------------------------------------------------------------
update public.games set published = false where id = 'tetris';

set local role anon;
select is((select count(*) from public.games), 5::bigint, 'visitors see the published games only');
select throws_ok($$insert into public.games (id, kind, title, description) values ('hack', 'game', 'x', 'x')$$,
  '42501', null, 'visitors can''t add a game');
reset role;

set local role authenticated;
select is((select count(*) from public.games), 5::bigint, 'players see the published games only');
select throws_ok($$update public.games set title = 'Hacked' where id = 'snake'$$,
  '42501', null, 'players can''t change a game');
select throws_ok($$delete from public.games where id = 'snake'$$,
  '42501', null, 'players can''t delete a game');
reset role;

select is(has_table_privilege('anon', 'private.site_rebuild', 'select'), false, 'the rebuild bookkeeping isn''t readable');
select is(has_function_privilege('authenticated', 'private.send_site_rebuild()', 'execute'), false,
  'players can''t start a rebuild');

-- ---------------------------------------------------------------------------
-- Rules for new rows
-- ---------------------------------------------------------------------------
insert into public.games (id, kind, title, description) values ('new-game', 'game', 'New game', 'Coming soon.');
select is(
  (select array[published::text, position::text, genre::text, platforms::text] from public.games where id = 'new-game'),
  array['false', '0', '{}', '[]'],
  'a new game starts unpublished, first in the order, with empty lists'
);
select throws_ok($$insert into public.games (id, kind, title, description) values ('Bad Id', 'game', 'x', 'x')$$,
  '23514', null, 'ids are 2-40 characters of a-z, 0-9 and -');
select throws_ok($$insert into public.games (id, kind, title, description) values ('app-game', 'app', 'x', 'x')$$,
  '23514', null, 'kind is game or portal');
select throws_ok($$insert into public.games (id, kind, title, description, difficulty) values ('hard-game', 'game', 'x', 'x', 'extreme')$$,
  '23514', null, 'difficulty is easy, medium or hard');

update public.games set title = 'Snake', updated_at = '2000-01-01' where id = 'snake';
select is((select updated_at from public.games where id = 'snake'), now(), 'an edit stamps updated_at, whatever it says');

-- ---------------------------------------------------------------------------
-- Rebuilding the site
-- ---------------------------------------------------------------------------
select is((select requested_at from private.site_rebuild), now(), 'an edit asks for a rebuild');

select private.send_site_rebuild();
select is((select sent_at from private.site_rebuild), null, 'nothing is sent while the edits are fresh');

update private.site_rebuild set requested_at = now() - interval '1 minute';
select private.send_site_rebuild();
select is((select sent_at from private.site_rebuild), null, 'nothing is sent without the deploy hook secret');

select vault.create_secret('https://hooks.example.invalid/build', 'deploy_hook_url');
select private.send_site_rebuild();
select is(
  (select array[(select sent_at from private.site_rebuild) = now(),
                exists (select from net.http_request_queue where url = 'https://hooks.example.invalid/build')]),
  array[true, true],
  'once quiet, the deploy hook is called'
);

select private.send_site_rebuild();
select is((select count(*) from net.http_request_queue where url = 'https://hooks.example.invalid/build'), 1::bigint,
  'and only once for the same edits');

select is((select count(*) from cron.job where jobname = 'gamehub-site-rebuild' and schedule = '* * * * *'), 1::bigint,
  'pg_cron checks for a rebuild every minute');

select * from finish();
rollback;
