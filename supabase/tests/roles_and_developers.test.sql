-- Tests for supabase/migrations/*_roles_and_developers.sql, on the local Supabase database.
-- Run with `npm run test:db` (after `npm run db:start`). Everything is rolled back at the end.
-- The test starts from no roles, developer profiles or reports (inside the transaction, so nothing is really deleted).
begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

delete from public.user_roles;
delete from public.developer_profiles;
delete from public.player_reports;

-- A is an admin, D will be a developer, P and Q are players
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-00000000ad01', 'roles-admin@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-00000000de02', 'roles-dev@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-00000000aa03', 'roles-player@example.com', '{"provider":"google"}'),
  ('00000000-0000-4000-8000-00000000bb04', 'roles-other@example.com', '{"provider":"google"}');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-00000000ad01', 'admin');

select is((select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass), true,
  'user_roles has row level security');
select is((select relrowsecurity from pg_class where oid = 'public.developer_profiles'::regclass), true,
  'developer_profiles has row level security');
select is((select reloptions from pg_class where oid = 'public.developers'::regclass), array['security_invoker=true'],
  'the developers view reads the tables as whoever asks');
select ok(not has_function_privilege('anon', 'public.set_developer(uuid, boolean)', 'execute'),
  'anon can''t run set_developer');
select ok(not has_function_privilege('anon', 'public.admin_reports(boolean)', 'execute'), '...nor admin_reports');
select ok(not has_function_privilege('authenticated', 'private.has_role(uuid, text)', 'execute'),
  'the private helpers aren''t for players');

-- ---------------------------------------------------------------------------
-- Who sees which roles
-- ---------------------------------------------------------------------------
set local role anon;
select is((select count(*) from public.user_roles where role = 'admin'), 0::bigint, 'anon doesn''t see who''s an admin');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000aa03","role":"authenticated"}', true);
select is((select count(*) from public.user_roles where role = 'admin'), 0::bigint, '...nor does another player');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ad01","role":"authenticated"}', true);
select is((select count(*) from public.user_roles where role = 'admin'), 1::bigint, 'an admin sees their own role');

-- ---------------------------------------------------------------------------
-- Making a player a developer
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000aa03","role":"authenticated"}', true);
select throws_ok($$select public.set_developer('00000000-0000-4000-8000-00000000de02', true)$$,
  '42501', 'Only admins can do that', 'a player can''t make anyone a developer');
select throws_ok($$select public.set_developer('00000000-0000-4000-8000-00000000aa03', true)$$,
  '42501', 'Only admins can do that', '...not even themselves');
select throws_ok($$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-00000000aa03', 'admin')$$,
  '42501', null, 'nor give themselves a role in the table');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ad01","role":"authenticated"}', true);
select is(public.set_developer('00000000-0000-4000-8000-00000000de02', true), true, 'an admin makes D a developer');
select is(public.set_developer('00000000-0000-4000-8000-00000000de02', true), false, '...once');
select throws_ok($$select public.set_developer('00000000-0000-4000-8000-0000000fffff', true)$$,
  'P0001', 'There''s no such player', 'not someone who doesn''t exist');
reset role;
select is((select granted_by from public.user_roles where user_id = '00000000-0000-4000-8000-00000000de02'),
  '00000000-0000-4000-8000-00000000ad01'::uuid, 'the role says which admin gave it');
select is((select bio from public.developer_profiles where user_id = '00000000-0000-4000-8000-00000000de02'), '',
  '...and D has an empty bio to fill in');

-- ---------------------------------------------------------------------------
-- A developer's bio and links
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000aa03","role":"authenticated"}', true);
select throws_ok($$select public.update_developer_profile('Hi', '{}')$$,
  '42501', 'Only developers have a bio and links', 'a player has no bio to write');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000de02","role":"authenticated"}', true);
select lives_ok($$select public.update_developer_profile('  I make games.  ',
  array[' https://github.com/dev ', '', null, 'https://dev.itch.io'])$$, 'D writes a bio and links');
select is((select bio from public.developer_profiles where user_id = '00000000-0000-4000-8000-00000000de02'),
  'I make games.', '...the bio trimmed');
select is((select links from public.developer_profiles where user_id = '00000000-0000-4000-8000-00000000de02'),
  array['https://github.com/dev', 'https://dev.itch.io'], '...and the links trimmed, empty ones dropped, in order');
select throws_ok($$select public.update_developer_profile('', array['http://github.com/dev'])$$,
  'P0001', 'Links are https addresses, like https://github.com/you', 'a link must be https');
select throws_ok($$select public.update_developer_profile('', array['https://github'])$$,
  'P0001', 'Links are https addresses, like https://github.com/you', '...with a site name that has a dot');
select throws_ok($$select public.update_developer_profile('', array['javascript:alert(1)'])$$,
  'P0001', 'Links are https addresses, like https://github.com/you', '...and nothing else');
select throws_ok($$select public.update_developer_profile('', array['https://a.io/1', 'https://a.io/2', 'https://a.io/3',
  'https://a.io/4', 'https://a.io/5', 'https://a.io/6', 'https://a.io/7'])$$,
  'P0001', 'Up to 6 links', 'at most 6 links');
select throws_ok($$select public.update_developer_profile(repeat('x', 501), '{}')$$,
  'P0001', 'The bio can be up to 500 characters', 'a bio of at most 500 characters');

set local role anon;
select is((select bio from public.developer_profiles where user_id = '00000000-0000-4000-8000-00000000de02'),
  'I make games.', 'anyone reads a developer''s bio');
select is((select count(*) from public.developers where id = '00000000-0000-4000-8000-00000000de02'), 1::bigint,
  '...and finds them in the developers view');
select is((select links from public.developers where id = '00000000-0000-4000-8000-00000000de02'),
  array['https://github.com/dev', 'https://dev.itch.io'], '...with their links');
select is((select count(*) from public.developers where id = '00000000-0000-4000-8000-00000000ad01'), 0::bigint,
  'an admin who isn''t a developer isn''t listed');
select is((select count(*) from public.user_roles where user_id = '00000000-0000-4000-8000-00000000de02'), 1::bigint,
  'that D is a developer is public');
reset role;

-- ---------------------------------------------------------------------------
-- Taking it away
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ad01","role":"authenticated"}', true);
select is(public.set_developer('00000000-0000-4000-8000-00000000de02', false), true, 'an admin takes the role away');
select is(public.set_developer('00000000-0000-4000-8000-00000000de02', false), false, '...once');
set local role anon;
select is((select count(*) from public.developer_profiles where user_id = '00000000-0000-4000-8000-00000000de02'),
  0::bigint, 'the bio is hidden then');
select is((select count(*) from public.developers where id = '00000000-0000-4000-8000-00000000de02'), 0::bigint,
  '...and D is no longer listed');
reset role;
select is((select bio from public.developer_profiles where user_id = '00000000-0000-4000-8000-00000000de02'),
  'I make games.', '...but it''s kept, in case the role comes back');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ad01","role":"authenticated"}', true);
select is(public.set_developer('00000000-0000-4000-8000-00000000de02', true), true, 'D is a developer again');
reset role;

-- ---------------------------------------------------------------------------
-- Reports, for admins
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000aa03","role":"authenticated"}', true);
select lives_ok($$select public.report_player('00000000-0000-4000-8000-00000000bb04', 'other', null, 'Rude name')$$,
  'P reports Q');
select throws_ok($$select * from public.admin_reports()$$, '42501', 'Only admins can do that', 'P can''t read reports');
select throws_ok($$select public.open_report_count()$$, '42501', 'Only admins can do that', '...nor count them');
select throws_ok($$select public.resolve_report(1, true)$$, '42501', 'Only admins can do that', '...nor resolve one');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ad01","role":"authenticated"}', true);
select is(public.open_report_count(), 1::bigint, 'an admin sees one open report');
select is((select reporter_username || ' > ' || reported_username || ': ' || message from public.admin_reports()),
  (select (select username from public.profiles where id = '00000000-0000-4000-8000-00000000aa03') || ' > '
    || (select username from public.profiles where id = '00000000-0000-4000-8000-00000000bb04') || ': Rude name'),
  '...with who sent it, who it''s about and what they wrote');
select is(public.resolve_report((select id from public.admin_reports()), true), true, 'the admin resolves it');
select is(public.open_report_count(), 0::bigint, '...so none are open');
select is((select count(*) from public.admin_reports(true)), 1::bigint, '...and it''s with the resolved ones');
select is((select resolved_by_username from public.admin_reports(null)),
  (select username from public.profiles where id = '00000000-0000-4000-8000-00000000ad01'), '...saying who resolved it');
select is(public.resolve_report((select id from public.admin_reports(null)), false), true, 'reopening it');
select is((select resolved_at from public.admin_reports(false)), null, '...forgets when it was resolved');
select is(public.resolve_report(-1, true), false, 'a report that doesn''t exist');
reset role;

-- ---------------------------------------------------------------------------
-- Games name their developer's account
-- ---------------------------------------------------------------------------
update public.games set developer_id = '00000000-0000-4000-8000-00000000de02' where id = 'snake';
update private.site_rebuild set requested_at = null;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000de02","role":"authenticated"}', true);
update public.profiles set username = 'roles_dev_new' where id = '00000000-0000-4000-8000-00000000de02';
reset role;
select isnt((select requested_at from private.site_rebuild), null, 'a developer''s new username rebuilds the site');
update private.site_rebuild set requested_at = null;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000bb04","role":"authenticated"}', true);
update public.profiles set username = 'roles_other_new' where id = '00000000-0000-4000-8000-00000000bb04';
reset role;
select is((select requested_at from private.site_rebuild), null, '...another player''s doesn''t');

delete from auth.users where id = '00000000-0000-4000-8000-00000000de02';
select is((select developer_id from public.games where id = 'snake'), null,
  'a deleted account leaves the game without one');
select is((select count(*) from public.user_roles where user_id = '00000000-0000-4000-8000-00000000de02'), 0::bigint,
  '...and its roles go with it');

select * from finish();
rollback;
