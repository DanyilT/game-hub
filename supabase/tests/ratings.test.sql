-- Tests for supabase/migrations/*_ratings.sql (ratings, favorites, bookmarks, feedback), on the local
-- Supabase database. Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back.
-- The test starts from empty tables (inside the transaction, so nothing is really deleted): ratings
-- and favorites made while trying the site locally would otherwise change its counts and totals.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

delete from public.ratings;
delete from public.favorites;
delete from public.bookmarks;
delete from public.feedback;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000007a1', 'rater1@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-0000000007b2', 'rater2@example.com', '{"provider":"google"}');

select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.ratings'::regclass, 'public.favorites'::regclass, 'public.bookmarks'::regclass,
                'public.feedback'::regclass)), 'ratings, favorites, bookmarks and feedback have row level security');

-- ---------------------------------------------------------------------------
-- Ratings
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select lives_ok($$select public.rate_game('snake', 4::smallint)$$, 'a player rates a game');
select is((select score from public.ratings where game_id = 'snake'), 4::smallint, '...and sees their rating');
select lives_ok($$select public.rate_game('snake', 5::smallint)$$, 'rating again');
select is((select count(*) from public.ratings), 1::bigint, '...changes the rating (one per game)');
select is((select score from public.ratings where game_id = 'snake'), 5::smallint, '...to the new score');
select throws_ok($$select public.rate_game('snake', 0::smallint)$$, '23514', null, 'scores start at 1');
select throws_ok($$select public.rate_game('snake', 6::smallint)$$, '23514', null, '...and stop at 5');
select throws_ok($$select public.rate_game('nope', 3::smallint)$$, '23503', null, 'unknown games cannot be rated');
select throws_ok($$insert into public.ratings (user_id, game_id, score)
  values ('00000000-0000-4000-8000-0000000007b2', 'tetris', 1)$$, '42501', null, 'no writing ratings directly');
select lives_ok($$select public.rate_game('tetris', 2::smallint)$$, 'rating another game');
select lives_ok($$select public.rate_game('tetris', null)$$, 'no score removes the rating');
select is((select array_agg(game_id) from public.ratings), array['snake'], '...so only the first rating is left');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007b2","role":"authenticated"}', true);
select is((select count(*) from public.ratings), 0::bigint, 'players cannot see each other''s ratings');
select lives_ok($$select public.rate_game('snake', 2::smallint)$$, 'a second player rates the same game');
reset role;

-- ---------------------------------------------------------------------------
-- Favorites and bookmarks
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select lives_ok($$insert into public.favorites (game_id) values ('snake')$$, 'a player adds a game to their favorites');
select is((select user_id from public.favorites where game_id = 'snake'), '00000000-0000-4000-8000-0000000007a1'::uuid,
  '...as themselves');
select throws_ok($$insert into public.favorites (game_id) values ('snake')$$, '23505', null, 'a game is a favorite once');
select throws_ok($$insert into public.favorites (user_id, game_id) values ('00000000-0000-4000-8000-0000000007b2', 'tetris')$$,
  '42501', null, 'no adding favorites for someone else');
select lives_ok($$insert into public.bookmarks (game_id) values ('snake'), ('sudoku')$$, 'a player bookmarks games');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007b2","role":"authenticated"}', true);
select is((select count(*) from public.favorites where user_id = '00000000-0000-4000-8000-0000000007a1'), 1::bigint,
  'favorites are public to other players');
select is((select count(*) from public.bookmarks), 0::bigint, 'bookmarks are private');
delete from public.favorites where game_id = 'snake';
select is((select count(*) from public.favorites), 1::bigint, 'players cannot remove someone else''s favorite');
select lives_ok($$insert into public.bookmarks (game_id) values ('snake')$$, 'the second player bookmarks a game too');
reset role;

set local role anon;
select is((select count(*) from public.favorites), 1::bigint, 'visitors can see favorites');
select throws_ok($$select * from public.bookmarks$$, '42501', null, 'visitors cannot see bookmarks');
select throws_ok($$insert into public.favorites (game_id) values ('tetris')$$, '42501', null, 'visitors cannot add favorites');
select throws_ok($$select public.rate_game('snake', 3::smallint)$$, '42501', null, 'visitors cannot rate');

-- Everyone sees the totals
select results_eq(
  $$select rating_count, rating_average, score_counts, favorite_count, bookmark_count from public.game_stats('snake')$$,
  $$values (2, 3.5::numeric, array[0, 1, 0, 0, 1], 1, 2)$$,
  'game_stats: two ratings (2 and 5), one favorite, two bookmarks'
);
select results_eq(
  $$select rating_count, rating_average, score_counts, favorite_count, bookmark_count from public.game_stats('tetris')$$,
  $$values (0, null::numeric, array[0, 0, 0, 0, 0], 0, 0)$$,
  'game_stats: a game nobody has rated yet'
);
select is((select count(*) from public.game_stats()), (select count(*) from public.games where published),
  'game_stats with no game: every published game');
reset role;

update public.games set published = false where id = 'tetris';
select is((select count(*) from public.game_stats('tetris')), 0::bigint, 'unpublished games have no stats');

-- ---------------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
select lives_ok($$insert into public.feedback (game_id, kind, score, message) values ('snake', 'rating', 2, 'Too fast')$$,
  'a player sends feedback');
select throws_ok($$select * from public.feedback$$, '42501', null, '...but cannot read it back');
select throws_ok($$insert into public.feedback (kind, message) values ('rating', '  padded  ')$$,
  '23514', null, 'messages are stored trimmed');
select throws_ok($$insert into public.feedback (kind, message) values ('spam', 'hi')$$, '23514', null, 'known kinds only');
select throws_ok($$insert into public.feedback (user_id, kind, message)
  values ('00000000-0000-4000-8000-0000000007b2', 'other', 'hi')$$, '42501', null, 'no sending as someone else');
select lives_ok($$insert into public.feedback (kind, message, browser)
  select 'bug', 'Bug ' || n, 'Mozilla/5.0' from generate_series(1, 19) as n$$, 'up to 20 messages a day');
select throws_ok($$insert into public.feedback (kind, message) values ('other', 'One more')$$,
  'P0001', null, '...and no more');
reset role;

set local role anon;
select throws_ok($$insert into public.feedback (kind, message) values ('other', 'hi')$$, '42501', null,
  'visitors cannot send feedback');
reset role;

-- ---------------------------------------------------------------------------
-- Deleting the account deletes all of it
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-8000-0000000007a1';
select is(
  (select array[(select count(*) from public.ratings where user_id = '00000000-0000-4000-8000-0000000007a1'),
                (select count(*) from public.favorites where user_id = '00000000-0000-4000-8000-0000000007a1'),
                (select count(*) from public.bookmarks where user_id = '00000000-0000-4000-8000-0000000007a1'),
                (select count(*) from public.feedback where user_id = '00000000-0000-4000-8000-0000000007a1')]),
  array[0, 0, 0, 0]::bigint[],
  'a deleted account''s ratings, favorites, bookmarks and feedback go with it'
);

select * from finish();
rollback;
