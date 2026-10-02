-- Tests for supabase/migrations/*_games_developer_and_sizes.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_column('public', 'games', 'developer', 'games have a developer');
select is(
  (select count(*) from public.games where developer ->> 'name' = 'Dany' and developer ->> 'url' = 'https://github.com/DanyilT'),
  6::bigint,
  'the six games name Dany, with a link'
);
select is(
  (select array_agg(key) from public.games, json_object_keys(developer) as key where id = 'snake'),
  array['name', 'url'],
  'the developer keeps its keys in the order they were written'
);

select is((select count(*) from public.games where dimensions ->> 'w' is not null), 0::bigint,
  'no game keeps the old one-size dimensions');
select is(
  (select array_agg(key) from public.games, json_object_keys(dimensions) as key where id = 'tetris'),
  array['sizes', 'center'],
  'dimensions are sizes, then center'
);
select is(
  (select array_agg((size ->> 'w')::int || 'x' || (size ->> 'h')::int order by i)
   from public.games, json_array_elements(dimensions -> 'sizes') with ordinality as s(size, i) where id = 'tetris'),
  array['320x1130', '400x1150', '650x770'],
  'Tetris is tall up to 650 pixels wide, and short from 651'
);

select * from finish();
rollback;
