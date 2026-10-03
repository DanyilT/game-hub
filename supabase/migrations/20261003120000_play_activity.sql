-- Play activity: how long each signed-in player plays each game, and who may see it.
--
-- The hub measures play itself (src/lib/playTime.js); the games aren't involved. It counts the
-- seconds a game's page is on screen while the player has pressed a key or tapped in the game in
-- the last 2 minutes, and reports them about once a minute, and once more when the page is left.
-- Each visit to a game's page is a play session, and a session counts as a play once it reaches
-- 60 seconds. The reports can only add as much time as has really passed.
--
-- What others see is each player's choice (Settings → Privacy), for three things: the games they've
-- played (their profile), what they're playing right now (their profile, friends lists), and their
-- plays in the games page's recent activity. Each is 'everyone', 'friends' or 'nobody' (only the
-- player). Sessions themselves are private: only the functions below read them, through those
-- choices. Everything here is deleted with the account.
--
-- Apply with: npx supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on update cascade on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(), -- the last report
  seconds integer not null default 0
    constraint play_seconds check (seconds between 0 and 21600), -- 6 hours at most
  ended_at timestamptz -- the page was left
);

create index play_sessions_by_player on public.play_sessions (user_id, last_seen_at desc);
create index play_sessions_recent on public.play_sessions (last_seen_at desc) where seconds >= 60;

alter table public.play_sessions enable row level security;
-- No policies and no grants: only the functions below read and write it
revoke all on public.play_sessions from anon, authenticated;

-- One row per player who has changed a setting; until then the defaults apply (the functions below
-- fill them in): played games and recent activity for everyone, playing now for friends
create table public.privacy_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  show_played text not null default 'everyone'
    constraint show_played_audience check (show_played in ('everyone', 'friends', 'nobody')),
  show_playing text not null default 'friends'
    constraint show_playing_audience check (show_playing in ('everyone', 'friends', 'nobody')),
  show_activity text not null default 'everyone'
    constraint show_activity_audience check (show_activity in ('everyone', 'friends', 'nobody')),
  updated_at timestamptz not null default now()
);

alter table public.privacy_settings enable row level security;
-- Read and changed through my_privacy() and set_privacy() only
revoke all on public.privacy_settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who may see what
-- ---------------------------------------------------------------------------
-- Whether the signed-in player (or a visitor, who is no one's friend) may see something p_owner
-- shows to p_audience. Players always see their own.
create function private.can_see(p_owner uuid, p_audience text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when (select auth.uid()) = p_owner then true
    when p_audience = 'everyone' then true
    when p_audience = 'friends' then exists (
      select from public.friendships f
      where f.status = 'accepted'
        and f.user_a = least(p_owner, (select auth.uid()))
        and f.user_b = greatest(p_owner, (select auth.uid()))
    )
    else false
  end;
$$;

-- A player's choice for one of the three, or its default
create function private.audience(p_owner uuid, p_what text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select case p_what
       when 'played' then s.show_played
       when 'playing' then s.show_playing
       when 'activity' then s.show_activity
     end
     from public.privacy_settings s where s.user_id = p_owner),
    case p_what when 'playing' then 'friends' else 'everyone' end
  );
$$;

-- ---------------------------------------------------------------------------
-- Functions the site calls (supabase.rpc)
-- ---------------------------------------------------------------------------

-- Starts a play session for the signed-in player in a published game; returns its id. The hub
-- starts one at the first second played on a game's page. At most 30 an hour.
create function public.start_play(p_game text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  session uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select from public.games g where g.id = p_game and g.published) then
    raise exception 'No such game' using errcode = 'P0002';
  end if;
  if (select count(*) from public.play_sessions s
      where s.user_id = uid and s.started_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many play sessions in the last hour' using errcode = 'P0001', hint = 'play_limit';
  end if;
  insert into public.play_sessions (user_id, game_id) values (uid, p_game) returning id into session;
  return session;
end;
$$;

-- Adds the seconds played since the last report to one of the signed-in player's sessions, and
-- with p_end, ends it. It adds no more than the time that has passed since the session's last
-- report (and 10 seconds' leeway), 120 seconds a report, and 6 hours a session, and nothing to a
-- session that has ended or started over 6 hours ago. Returns the session's seconds, or null when
-- there's no such open session of theirs.
create function public.report_play(p_session uuid, p_seconds integer, p_end boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  total integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  update public.play_sessions s
  set seconds = least(21600, s.seconds + greatest(0, least(
        coalesce(p_seconds, 0),
        120,
        ceil(extract(epoch from now() - s.last_seen_at))::integer + 10
      ))),
      last_seen_at = now(),
      ended_at = case when p_end then now() end
  where s.id = p_session
    and s.user_id = uid
    and s.ended_at is null
    and s.started_at > now() - interval '6 hours'
  returning s.seconds into total;
  return total;
end;
$$;

-- The games a player has played for a minute or more, most recent first: when they last played,
-- how many plays (sessions of a minute or more) and how long in all. Empty unless their
-- show_played lets the caller see it.
create function public.player_played(p_user uuid)
returns table (game_id text, last_played timestamptz, plays integer, seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.game_id, max(s.last_seen_at), (count(*) filter (where s.seconds >= 60))::integer, sum(s.seconds)::integer
  from public.play_sessions s
  join public.games g on g.id = s.game_id and g.published
  where s.user_id = p_user
    and private.can_see(p_user, private.audience(p_user, 'played'))
  group by s.game_id
  having sum(s.seconds) >= 60
  order by max(s.last_seen_at) desc;
$$;

-- Which of these players are playing now (a report in the last 2 minutes, page not left, session
-- under 6 hours old), and what, for those whose show_playing lets the caller see it. Up to 200
-- players at a time.
create function public.playing_now(p_users uuid[])
returns table (user_id uuid, game_id text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (s.user_id) s.user_id, s.game_id, s.started_at
  from public.play_sessions s
  join public.games g on g.id = s.game_id and g.published
  where cardinality(p_users) <= 200
    and s.user_id = any (p_users)
    and s.ended_at is null
    and s.last_seen_at > now() - interval '2 minutes'
    and s.started_at > now() - interval '6 hours'
    and private.can_see(s.user_id, private.audience(s.user_id, 'playing'))
  order by s.user_id, s.last_seen_at desc;
$$;

-- The games page's recent activity: the latest plays of a minute or more in the last 30 days, one
-- per player and game, newest first, from players whose show_activity lets the caller see them
create function public.recent_activity(p_limit integer default 12)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  game_id text,
  played_at timestamptz,
  seconds integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.user_id, p.username, p.display_name, p.avatar_url, x.game_id, x.last_seen_at, x.seconds
  from (
    select distinct on (s.user_id, s.game_id) s.user_id, s.game_id, s.last_seen_at, s.seconds
    from public.play_sessions s
    where s.seconds >= 60 and s.last_seen_at > now() - interval '30 days'
    order by s.user_id, s.game_id, s.last_seen_at desc
  ) x
  join public.profiles p on p.id = x.user_id
  join public.games g on g.id = x.game_id and g.published
  where private.can_see(x.user_id, private.audience(x.user_id, 'activity'))
  order by x.last_seen_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

-- The signed-in player's privacy choices (the defaults until they change one)
create function public.my_privacy()
returns table (show_played text, show_playing text, show_activity text)
language sql
stable
security definer
set search_path = ''
as $$
  select private.audience(uid, 'played'), private.audience(uid, 'playing'), private.audience(uid, 'activity')
  from (select (select auth.uid()) as uid) me
  where uid is not null;
$$;

-- Changes the signed-in player's privacy choices: the ones given, keeping the rest. Each is
-- 'everyone', 'friends' or 'nobody' (anything else fails the table's checks).
create function public.set_privacy(
  p_show_played text default null,
  p_show_playing text default null,
  p_show_activity text default null
)
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
  insert into public.privacy_settings as s (user_id, show_played, show_playing, show_activity)
  values (
    uid,
    coalesce(p_show_played, private.audience(uid, 'played')),
    coalesce(p_show_playing, private.audience(uid, 'playing')),
    coalesce(p_show_activity, private.audience(uid, 'activity'))
  )
  on conflict (user_id) do update set
    show_played = coalesce(p_show_played, s.show_played),
    show_playing = coalesce(p_show_playing, s.show_playing),
    show_activity = coalesce(p_show_activity, s.show_activity),
    updated_at = now();
end;
$$;

-- Nothing is executable by default; grant only what each role needs
revoke execute on function
  private.can_see(uuid, text),
  private.audience(uuid, text),
  public.start_play(text),
  public.report_play(uuid, integer, boolean),
  public.player_played(uuid),
  public.playing_now(uuid[]),
  public.recent_activity(integer),
  public.my_privacy(),
  public.set_privacy(text, text, text)
from public, anon, authenticated;

grant execute on function
  public.start_play(text),
  public.report_play(uuid, integer, boolean),
  public.my_privacy(),
  public.set_privacy(text, text, text)
to authenticated;
grant execute on function
  public.player_played(uuid),
  public.playing_now(uuid[]),
  public.recent_activity(integer)
to anon, authenticated;
