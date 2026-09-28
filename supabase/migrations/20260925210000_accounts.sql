-- A profile row per signed-in player (created automatically at sign-up), public usernames and
-- each player's private username history, and the few functions the site calls.
--
-- House rules for every migration:
--   - each table starts with REVOKE ALL, then explicit GRANTs: new tables can arrive with full
--     rights for anon/authenticated (the local stack, or projects that expose tables automatically);
--   - every table has row level security (RLS) with explicit policies;
--   - functions are only executable by the roles that need them;
--   - helpers the Data API must never expose live in the `private` schema.
-- Apply with: npx supabase db push

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Reserved usernames (not secret: the list is in this file)
-- ---------------------------------------------------------------------------
create table public.reserved_usernames (
  username text primary key
);

alter table public.reserved_usernames enable row level security;
create policy "Reserved usernames are public"
  on public.reserved_usernames for select to anon, authenticated
  using (true);
revoke all on public.reserved_usernames from anon, authenticated;
grant select on public.reserved_usernames to anon, authenticated;

-- 'dany'-based names are the site owner's (claim one from the SQL editor, which skips the player rules)
insert into public.reserved_usernames (username) values
  ('admin'), ('root'), ('system'), ('moderator'), ('null'), ('undefined'), ('test'), ('user'),
  ('game'), ('gamehub'), ('game_hub'), ('official'), ('qwerty'), ('dany'), ('danyt'), ('danyilt');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    constraint username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  -- Stored trimmed, so padding can't get around the length limit
  display_name text
    constraint display_name_length check (display_name = btrim(display_name) and char_length(display_name) between 1 and 40),
  -- Picture from the sign-in provider (Google / Discord). Players can remove it or put the
  -- provider's current one back, but can't point it anywhere else.
  avatar_url text
    constraint avatar_url_https check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Profiles are public"
  on public.profiles for select to anon, authenticated
  using (true);
create policy "Players update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
-- No insert/delete policies: rows are created by the sign-up trigger and removed with the account

-- Players may only change these columns. (Without the REVOKE, a default table-wide UPDATE right
-- would let them edit any column of their own row, e.g. created_at.)
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Username history: the usernames a player has picked or kept, and when. Private: each player
-- sees only their own (other players only ever see the current one, in profiles).
-- A new player's starting name isn't in it until they keep it, so an empty history means they
-- haven't chosen yet (the site then asks). The newest entry starts the 30-day wait.
-- At most 20 rows per player: their first choice ever, plus the latest 19.
-- ---------------------------------------------------------------------------
create table public.username_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  username text not null,
  set_at timestamptz not null default now()
);

create index username_history_user on public.username_history (user_id, id);

alter table public.username_history enable row level security;
create policy "Players see their own username history"
  on public.username_history for select to authenticated
  using ((select auth.uid()) = user_id);
-- No write policies: only the username trigger below adds and removes rows

revoke all on public.username_history from anon, authenticated;
grant select on public.username_history to authenticated;

-- ---------------------------------------------------------------------------
-- New players: a profile with a starting username
-- ---------------------------------------------------------------------------

-- e.g. "cosmic_narwhal42" (word lists from the first GameHub rewrite; longest result is 19 chars)
create function private.random_username()
returns text
language sql
volatile
set search_path = ''
as $$
  select (array['fluffy', 'speedy', 'sneaky', 'mighty', 'lazy', 'crazy', 'happy', 'grumpy',
                'bouncy', 'sleepy', 'hungry', 'dizzy', 'fuzzy', 'silly', 'witty', 'jolly',
                'spicy', 'cosmic', 'mystic', 'epic', 'legendary', 'turbo', 'mega', 'ultra',
                'chunky', 'sparkly', 'wobbly', 'zippy', 'zany', 'quirky', 'funky', 'wacky'])[1 + floor(random() * 32)::int]
      || '_'
      || (array['panda', 'ninja', 'unicorn', 'dragon', 'potato', 'waffle', 'penguin', 'taco',
                'wizard', 'pirate', 'robot', 'banana', 'muffin', 'pickle', 'noodle', 'donut',
                'cactus', 'llama', 'koala', 'sloth', 'phoenix', 'narwhal', 'yeti', 'gremlin',
                'goblin', 'toaster', 'nugget', 'burrito', 'pretzel', 'hamster', 'raccoon', 'fox'])[1 + floor(random() * 32)::int]
      || floor(random() * 100)::int;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  picture text := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
  base text;
  candidate text;
  n int := 0;
begin
  -- Discord usernames are public already, so start from that. Google only gives a real name,
  -- which shouldn't become a public handle: those players start with a random name.
  if new.raw_app_meta_data ->> 'provider' = 'discord' then
    base := regexp_replace(
      lower(split_part(coalesce(meta ->> 'full_name', meta ->> 'name', ''), '#', 1)),
      '[^a-z0-9_]', '', 'g');
  end if;
  if coalesce(char_length(base), 0) < 3
     or exists (select 1 from public.reserved_usernames r where r.username = base) then
    base := private.random_username();
  end if;
  base := left(base, 20);

  candidate := base;
  while exists (select 1 from public.profiles p where p.username = candidate)
     or exists (select 1 from public.reserved_usernames r where r.username = candidate) loop
    n := n + 1;
    candidate := left(base, 20 - char_length(n::text)) || n;
  end loop;

  insert into public.profiles (id, username, avatar_url)
  values (new.id, candidate, case when picture ~ '^https://' then picture end);
  return new;
end;
$$;

-- If this trigger fails, sign-ups fail: keep it simple
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Profile edits: picture rules, updated_at (usernames: the next trigger)
-- ---------------------------------------------------------------------------
create function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();

  -- Edits without a signed-in player (SQL editor, service role) skip the player rules
  if (select auth.uid()) is null then
    return new;
  end if;

  -- Never the player's to change (the column grants already say so; this is the second lock)
  new.id := old.id;
  new.created_at := old.created_at;

  if new.avatar_url is distinct from old.avatar_url and new.avatar_url is not null
     and not exists (
       select 1 from auth.users u
       where u.id = new.id
         and new.avatar_url in (u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
     ) then
    raise exception 'The profile picture can only be removed, or reset to your Google or Discord picture'
      using errcode = 'P0001', hint = 'avatar';
  end if;

  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Setting the username: the player rules, then the history. Runs whenever an UPDATE sets the
-- username column, even to the name it already has: that's how a new player keeps their
-- starting name ("Keep this name" sends it back unchanged).
-- ---------------------------------------------------------------------------
create function private.set_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_set timestamptz := (
    select max(h.set_at) from public.username_history h where h.user_id = new.id
  );
begin
  -- Unchanged, and already picked or kept: nothing new to record
  if new.username = old.username and last_set is not null then
    return new;
  end if;

  -- Player rules. Edits without a signed-in player (SQL editor, service role) skip them.
  if (select auth.uid()) is not null and new.username is distinct from old.username then
    if exists (select 1 from public.reserved_usernames r where r.username = new.username) then
      raise exception 'The username "%" is reserved', new.username
        using errcode = 'P0001', hint = 'reserved';
    end if;
    -- The first pick is free; after that, 30 days after the current name was picked or kept
    if last_set > now() - interval '30 days' then
      raise exception 'Usernames can be changed once every 30 days'
        using errcode = 'P0001', hint = 'cooldown';
    end if;
  end if;

  insert into public.username_history (user_id, username) values (new.id, new.username);

  -- Keep 20: the first entry ever, and the latest 19
  delete from public.username_history h
  where h.user_id = new.id
    and h.id <> (select min(f.id) from public.username_history f where f.user_id = new.id)
    and h.id not in (
      select l.id from public.username_history l where l.user_id = new.id order by l.id desc limit 19
    );

  return new;
end;
$$;

-- Fires after guard_profile_update (same event, triggers run in name order)
create trigger set_username
  before update of username on public.profiles
  for each row execute function private.set_username();

-- ---------------------------------------------------------------------------
-- Functions the site calls (supabase.rpc)
-- ---------------------------------------------------------------------------

-- Live "is this name free?" check while typing (runs with the caller's rights: both tables are public)
create function public.is_username_available(p_username text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_username ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.reserved_usernames r where r.username = p_username)
     and not exists (select 1 from public.profiles p where p.username = p_username);
$$;

-- Settings → Delete account. Removing the auth user deletes the profile and its username history
-- (and, later, ratings and plays) through ON DELETE CASCADE.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- Keep-alive: a daily call (workers/keepalive) so the free project isn't paused for inactivity
create function public.ping()
returns integer
language sql
stable
set search_path = ''
as $$
  select 1;
$$;

-- Nothing is executable by default; grant only what each role needs
revoke execute on function
  private.random_username(),
  private.handle_new_user(),
  private.guard_profile_update(),
  private.set_username(),
  public.is_username_available(text),
  public.delete_my_account(),
  public.ping()
from public, anon, authenticated;

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.ping() to anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
