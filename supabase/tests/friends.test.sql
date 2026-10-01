-- Tests for supabase/migrations/*_friends.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- The test starts from an empty friendships table (inside the transaction, so nothing is really
-- deleted): friendships made while trying the site locally would otherwise change its counts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

delete from public.friendships;

-- A, B and C, plus 21 more players for the request limit
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-000000000fa1', 'friend-a@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-000000000fb2', 'friend-b@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-000000000fc3', 'friend-c@example.com', '{"provider":"google"}');
insert into auth.users (id, email, raw_app_meta_data)
select ('00000000-0000-4000-8000-0000000010' || lpad(n::text, 2, '0'))::uuid, format('many-%s@example.com', n),
  '{"provider":"google"}'
from generate_series(1, 21) as n;

select is((select relrowsecurity from pg_class where oid = 'public.friendships'::regclass), true,
  'friendships has row level security');

-- ---------------------------------------------------------------------------
-- A asks B
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000fa1","role":"authenticated"}', true);
select is(public.send_friend_request('00000000-0000-4000-8000-000000000fb2'), 'pending', 'A asks B: the request waits');
select is(public.send_friend_request('00000000-0000-4000-8000-000000000fb2'), 'pending', 'asking again changes nothing');
select is((select count(*) from public.friendships), 1::bigint, '...one row for the pair');
select is((select direction from public.my_friend_requests()), 'outgoing', 'A sees the request as outgoing');
select throws_ok($$select public.send_friend_request('00000000-0000-4000-8000-000000000fa1')$$, 'P0001', null,
  'no befriending yourself');
select throws_ok($$select public.send_friend_request('00000000-0000-4000-8000-00000000ffff')$$, 'P0001', null,
  'no befriending players who don''t exist');
select throws_ok($$insert into public.friendships (user_a, user_b, requested_by) values
  ('00000000-0000-4000-8000-000000000fa1', '00000000-0000-4000-8000-000000000fc3', '00000000-0000-4000-8000-000000000fa1')$$,
  '42501', null, 'no writing to the table directly');
select is(public.accept_friend_request('00000000-0000-4000-8000-000000000fb2'), false,
  'A cannot accept their own request');

-- Others don't see a pending request
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000fc3","role":"authenticated"}', true);
select is((select count(*) from public.friendships), 0::bigint, 'a third player cannot see the request');
reset role;
set local role anon;
select is((select count(*) from public.friendships), 0::bigint, 'nor can visitors');
reset role;

-- B answers
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000fb2","role":"authenticated"}', true);
select results_eq($$select id, direction from public.my_friend_requests()$$,
  $$values ('00000000-0000-4000-8000-000000000fa1'::uuid, 'incoming')$$, 'B sees the request as incoming, from A');
select is(public.accept_friend_request('00000000-0000-4000-8000-000000000fa1'), true, 'B accepts');
select is((select status from public.friendships), 'accepted', '...and they are friends');
select is((select count(*) from public.my_friend_requests()), 0::bigint, '...with no request left waiting');
reset role;

set local role anon;
select is((select count(*) from public.friendships), 1::bigint, 'friendships are public');
select results_eq($$select username from public.player_friends('00000000-0000-4000-8000-000000000fa1')$$,
  $$select username from public.profiles where id = '00000000-0000-4000-8000-000000000fb2'$$,
  'anyone can list A''s friends: B');
select results_eq($$select username from public.player_friends('00000000-0000-4000-8000-000000000fb2')$$,
  $$select username from public.profiles where id = '00000000-0000-4000-8000-000000000fa1'$$,
  '...and B''s: A');
select throws_ok($$select public.send_friend_request('00000000-0000-4000-8000-000000000fa1')$$, '42501', null,
  'visitors cannot send requests');
reset role;

-- ---------------------------------------------------------------------------
-- Asking someone who already asked you is a yes; removing
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000fc3","role":"authenticated"}', true);
select is(public.send_friend_request('00000000-0000-4000-8000-000000000fa1'), 'pending', 'C asks A');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000fa1","role":"authenticated"}', true);
select is(public.send_friend_request('00000000-0000-4000-8000-000000000fc3'), 'accepted',
  'A asks C back: they are friends straight away');
select is((select count(*) from public.player_friends('00000000-0000-4000-8000-000000000fa1')), 2::bigint,
  'A has two friends');
select is(public.remove_friend('00000000-0000-4000-8000-000000000fc3'), true, 'A removes C');
select is(public.remove_friend('00000000-0000-4000-8000-000000000fc3'), false, '...once');
select is((select count(*) from public.player_friends('00000000-0000-4000-8000-000000000fa1')), 1::bigint,
  '...leaving one friend');

-- Declining is removing, from the other side
select is(public.send_friend_request('00000000-0000-4000-8000-000000000fc3'), 'pending', 'A asks C again');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000fc3","role":"authenticated"}', true);
select is(public.remove_friend('00000000-0000-4000-8000-000000000fa1'), true, 'C declines');

-- At most 20 requests waiting
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000fa1","role":"authenticated"}', true);
select lives_ok($$select public.send_friend_request(('00000000-0000-4000-8000-0000000010' || lpad(n::text, 2, '0'))::uuid)
  from generate_series(1, 20) as n$$, 'A sends 20 requests');
select throws_ok($$select public.send_friend_request('00000000-0000-4000-8000-000000001021')$$, 'P0001', null,
  '...and a 21st waits until some are answered');
reset role;

-- ---------------------------------------------------------------------------
-- Deleting an account ends its friendships
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-8000-000000000fb2';
select is((select count(*) from public.friendships where '00000000-0000-4000-8000-000000000fb2' in (user_a, user_b)),
  0::bigint, 'a deleted account''s friendships go with it');

select * from finish();
rollback;
