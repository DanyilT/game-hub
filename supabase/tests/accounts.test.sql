-- Tests for supabase/migrations/*_accounts.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- Within the test everything happens at one moment (now() is the transaction's start), so the
-- 30-day wait is tested by moving history entries back in time.
begin;
create extension if not exists pgtap with schema extensions;
select plan(63);

-- ---------------------------------------------------------------------------
-- Sign-up: players arrive the way the auth server creates them (the auth server's own role
-- can't be borrowed here; signing up through the local site covers that)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'google@example.com', '{"provider":"google","providers":["google"]}',
   '{"full_name":"Dany Tymchuk","avatar_url":"https://lh3.googleusercontent.com/a/abc","picture":"https://lh3.googleusercontent.com/a/abc"}'),
  ('00000000-0000-4000-8000-00000000000b', 'discord@example.com', '{"provider":"discord","providers":["discord"]}',
   '{"full_name":"CoolGamer_99","name":"CoolGamer_99#0","avatar_url":"https://cdn.discordapp.com/avatars/1/a.png"}'),
  ('00000000-0000-4000-8000-00000000000c', 'discord2@example.com', '{"provider":"discord"}', '{"full_name":"coolgamer_99"}'),
  ('00000000-0000-4000-8000-00000000000d', 'reserved@example.com', '{"provider":"discord"}', '{"full_name":"dany.t"}'),
  ('00000000-0000-4000-8000-00000000000e', 'legacy@example.com', '{"provider":"discord"}', '{"name":"OldName#1234"}'),
  ('00000000-0000-4000-8000-00000000000f', 'nometa@example.com', '{"provider":"google"}', null);

select matches((select username from public.profiles where id = '00000000-0000-4000-8000-00000000000a'),
  '^[a-z]+_[a-z]+[0-9]{1,2}$', 'Google: starts with a random fun name, not the real name');
select is((select avatar_url from public.profiles where id = '00000000-0000-4000-8000-00000000000a'),
  'https://lh3.googleusercontent.com/a/abc', 'Google: keeps the provider picture');
select is((select count(*) from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a'),
  0::bigint, 'a starting name is not in the history until the player keeps it');
select is((select username from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  'coolgamer_99', 'Discord: starts from the Discord username');
select is((select username from public.profiles where id = '00000000-0000-4000-8000-00000000000c'),
  'coolgamer_991', 'Discord: a taken name gets a number');
select isnt((select username from public.profiles where id = '00000000-0000-4000-8000-00000000000d'),
  'danyt', 'Discord: a reserved name ("dany.t" → "danyt") becomes a random one');
select is((select username from public.profiles where id = '00000000-0000-4000-8000-00000000000e'),
  'oldname', 'Discord: an old name#1234 handle loses the tag');
select ok(exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000000f'),
  'no metadata at all still signs up');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS on');
select ok((select relrowsecurity from pg_class where oid = 'public.reserved_usernames'::regclass),
  'reserved_usernames has RLS on');
select ok((select relrowsecurity from pg_class where oid = 'public.username_history'::regclass),
  'username_history has RLS on');

-- ---------------------------------------------------------------------------
-- Visitors (anon)
-- ---------------------------------------------------------------------------
set local role anon;
select ok((select count(*) from public.profiles) >= 6, 'anyone can read profiles');
select throws_ok($$update public.profiles set display_name = 'x'$$, '42501', null, 'visitors cannot edit profiles');
select throws_ok($$select * from public.username_history$$, '42501', null, 'visitors cannot read username histories');
select is(public.ping(), 1, 'ping() works for visitors (keep-alive)');
select is(public.is_username_available('fresh_name'), true, 'is_username_available: a free name');
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'visitors cannot call delete_my_account');
reset role;

-- ---------------------------------------------------------------------------
-- A signed-in player editing their own profile
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select lives_ok($$update public.profiles set display_name = 'Dany'
  where id = '00000000-0000-4000-8000-00000000000a'$$, 'edit your own display name');
select is((select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 'Dany', '...saved');
update public.profiles set display_name = 'hacked' where id = '00000000-0000-4000-8000-00000000000b';
select is((select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), null,
  'someone else''s profile is untouched (RLS)');

select throws_ok($$update public.profiles set username = 'admin' where id = '00000000-0000-4000-8000-00000000000a'$$,
  'P0001', 'The username "admin" is reserved', 'reserved usernames are refused');
select throws_ok($$update public.profiles set username = 'coolgamer_99' where id = '00000000-0000-4000-8000-00000000000a'$$,
  '23505', null, 'taken usernames are refused');
select throws_ok($$update public.profiles set username = 'Bad Name' where id = '00000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'usernames must match ^[a-z0-9_]{3,20}$');
select throws_ok($$update public.profiles set display_name = '  Dany  ' where id = '00000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'display names are stored trimmed');
select throws_ok($$update public.profiles set display_name = repeat('x', 41) where id = '00000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'display names are at most 40 characters');

-- Usernames and their history
select lives_ok($$update public.profiles set username = 'dany_player' where id = '00000000-0000-4000-8000-00000000000a'$$,
  'the first pick is allowed straight away');
select results_eq($$select username from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a' order by id$$,
  array['dany_player'], '...and is the first entry in the history (the starting name never was)');
select throws_ok($$update public.profiles set username = 'dany_player2' where id = '00000000-0000-4000-8000-00000000000a'$$,
  'P0001', 'Usernames can be changed once every 30 days', 'a second change within 30 days is refused');
select lives_ok($$update public.profiles set username = 'dany_player' where id = '00000000-0000-4000-8000-00000000000a'$$,
  'sending the current name again is fine');
select is((select count(*) from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a'),
  1::bigint, '...and adds nothing to the history');

select throws_ok($$insert into public.username_history (user_id, username)
  values ('00000000-0000-4000-8000-00000000000a', 'fake')$$, '42501', null, 'players cannot add to their history');
select throws_ok($$update public.username_history set set_at = now() - interval '1 year'$$,
  '42501', null, 'players cannot back-date their history (no grant)');
select throws_ok($$delete from public.username_history$$, '42501', null, 'players cannot clear their history (no grant)');
-- Second lock: even with grants (e.g. a later migration's mistake), there are no write policies
reset role;
grant insert, update, delete on public.username_history to authenticated;
set local role authenticated;
select throws_ok($$insert into public.username_history (user_id, username)
  values ('00000000-0000-4000-8000-00000000000a', 'fake')$$, '42501', null, '...and RLS stops it even if a grant slips through');
delete from public.username_history;
select is((select count(*) from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a'),
  1::bigint, '...deleting through such a grant removes nothing');
reset role;
revoke insert, update, delete on public.username_history from authenticated;

-- 30 days later (the entry is moved back in time), the name can change again
update public.username_history set set_at = now() - interval '31 days'
where user_id = '00000000-0000-4000-8000-00000000000a';
set local role authenticated;
select lives_ok($$update public.profiles set username = 'dany_player2' where id = '00000000-0000-4000-8000-00000000000a'$$,
  'after 30 days the username can change again');
select results_eq($$select username from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a' order by id$$,
  array['dany_player', 'dany_player2'], '...and both names are in the history');

select throws_ok($$update public.profiles set avatar_url = 'https://evil.example/x.png'
  where id = '00000000-0000-4000-8000-00000000000a'$$, 'P0001', null, 'the picture cannot point anywhere else');
select lives_ok($$update public.profiles set avatar_url = null where id = '00000000-0000-4000-8000-00000000000a'$$,
  'the picture can be removed');
select lives_ok($$update public.profiles set avatar_url = 'https://lh3.googleusercontent.com/a/abc'
  where id = '00000000-0000-4000-8000-00000000000a'$$, 'the provider''s picture can be put back');
select throws_ok($$update public.profiles set avatar_url = 'https://cdn.discordapp.com/avatars/1/a.png'
  where id = '00000000-0000-4000-8000-00000000000a'$$, 'P0001', null, 'another player''s picture is refused');

select throws_ok($$update public.profiles set created_at = now() where id = '00000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'columns without a grant (created_at) are read-only');
select throws_ok($$insert into public.profiles (id, username) values (gen_random_uuid(), 'sneaky_one')$$,
  '42501', null, 'players cannot create profiles');
select throws_ok($$delete from public.profiles where id = '00000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'players cannot delete profile rows directly');
select throws_ok($$insert into public.reserved_usernames values ('mine')$$, '42501', null, 'the reserved list is read-only');
select throws_ok($$select private.random_username()$$, '42501', null, 'private helpers are not callable');
select is(public.is_username_available('coolgamer_99'), false, 'is_username_available: a taken name');
select is(public.is_username_available('dany'), false, 'is_username_available: a reserved name');

-- "Keep this name": a new player sends their starting name back unchanged
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select lives_ok($$update public.profiles set username = username where id = '00000000-0000-4000-8000-00000000000c'$$,
  '"keep this name" sends the same name back');
select results_eq($$select username from public.username_history where user_id = '00000000-0000-4000-8000-00000000000c'$$,
  array['coolgamer_991'], '...which puts the starting name in the history');
select throws_ok($$update public.profiles set username = 'c_new_name' where id = '00000000-0000-4000-8000-00000000000c'$$,
  'P0001', 'Usernames can be changed once every 30 days', 'keeping a name starts the 30-day wait too');
select is((select count(*) from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a'),
  0::bigint, 'players only see their own history');
reset role;

-- ---------------------------------------------------------------------------
-- History limit: 20 names, always including the first. As the SQL editor (no signed-in
-- player), which skips the 30-day wait.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
do $$
begin
  for i in 1..25 loop
    update public.profiles set username = 'a_name_' || i where id = '00000000-0000-4000-8000-00000000000a';
  end loop;
end
$$;
select is((select count(*) from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a'),
  20::bigint, 'the history keeps 20 names at most');
select is((select username from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a' order by id limit 1),
  'dany_player', '...always including the first one');
select is((select username from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a' order by id desc limit 1),
  'a_name_25', '...and the latest');
select ok(not exists (select 1 from public.username_history
  where user_id = '00000000-0000-4000-8000-00000000000a' and username in ('dany_player2', 'a_name_6')),
  '...dropping the oldest ones after the first');

-- ---------------------------------------------------------------------------
-- Settings → Delete account
-- ---------------------------------------------------------------------------
update public.profiles set username = username where id = '00000000-0000-4000-8000-00000000000b';
select is((select count(*) from public.username_history where user_id = '00000000-0000-4000-8000-00000000000b'),
  1::bigint, 'the player about to leave has a history');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select lives_ok($$select public.delete_my_account()$$, 'a player can delete their account');
reset role;
select set_config('request.jwt.claims', '', true);
select ok(not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-00000000000b'),
  '...which removes the sign-in account');
select ok(not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  '...the profile');
select ok(not exists (select 1 from public.username_history where user_id = '00000000-0000-4000-8000-00000000000b'),
  '...and the username history');

-- The site owner, in the SQL editor (no signed-in player), can claim a reserved name
select lives_ok($$update public.profiles set username = 'dany' where id = '00000000-0000-4000-8000-00000000000a'$$,
  'the SQL editor can give out a reserved name');
select is((select username from public.username_history where user_id = '00000000-0000-4000-8000-00000000000a' order by id desc limit 1),
  'dany', '...which goes into the history too');

select * from finish();
rollback;
