-- Mock players, for the local Supabase only: `npm run db:reset` loads this after the migrations,
-- and `db push` never sends it to the hosted project. 240 made-up players, so pages like /users
-- can be seen at scale. They can't sign in (no password, and the addresses don't exist).
--
-- Each insert runs the real sign-up trigger (private.handle_new_user), so they're named the way
-- real players are: Google players get a random fun name, Discord players start from their handle.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  format('mock-player-%s@example.test', i),
  '',
  joined,
  case when discord
    then '{"provider":"discord","providers":["discord"]}'::jsonb
    else '{"provider":"google","providers":["google"]}'::jsonb
  end,
  case when discord
    then jsonb_build_object(
      'full_name', (array['NightOwl', 'PixelPirate', 'LagMaster', 'CritHit', 'NoScope', 'Speedrunner',
                          'BossFight', 'LootGoblin', 'RespawnKing', 'ComboBreaker', 'GlitchHunter', 'TankMain',
                          'HealerOnDuty', 'AfkWizard', 'RageQuit', 'SideQuest'])[1 + i % 16] || (i % 97),
      -- Discord's default pictures, the ones every account without its own gets
      'avatar_url', format('https://cdn.discordapp.com/embed/avatars/%s.png', i % 6))
    else jsonb_build_object('full_name', format('Mock Player %s', i))
  end,
  joined,
  joined,
  '', '', '', ''
from (
  -- One in three from Discord; joined at random over the past ~14 months
  select i, i % 3 = 0 as discord, now() - random() * interval '420 days' as joined
  from generate_series(1, 240) as i
) as mock;

-- Profiles start at sign-up time ("now" here): move them to when each player joined
update public.profiles p
set created_at = u.created_at
from auth.users u
where u.id = p.id and u.email like 'mock-player-%@example.test';

-- About 4 in 10 have a display name, from their username ("cosmic_narwhal42" → "Cosmic Narwhal")
update public.profiles p
set display_name = nullif(btrim(initcap(replace(regexp_replace(p.username, '[0-9]+$', ''), '_', ' '))), '')
from auth.users u
where u.id = p.id and u.email like 'mock-player-%@example.test' and random() < 0.4;

-- Most have kept or picked their name (so the welcome window wouldn't ask them), soon after joining.
-- Setting the username to itself is how "Keep this name" works: the trigger records it.
update public.profiles p
set username = p.username
from auth.users u
where u.id = p.id and u.email like 'mock-player-%@example.test' and random() < 0.85;

update public.username_history h
set set_at = p.created_at + interval '2 minutes'
from public.profiles p
join auth.users u on u.id = p.id
where p.id = h.user_id and u.email like 'mock-player-%@example.test';
