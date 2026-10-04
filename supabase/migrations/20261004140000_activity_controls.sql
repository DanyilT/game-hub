-- Turning play activity off, and deleting it. Each player chooses, in Settings → Privacy, whether
-- GameHub keeps a history of what they play (record_played): the play sessions behind the Played tab,
-- play time, recent activity and "playing now" (a session reported in the last 2 minutes). With it
-- off, nothing is recorded: the functions below store no play for them, whatever the site sends, what
-- was kept before is only theirs (until they delete it), and no one sees what they're playing now. Its
-- visibility choices (the three in the play activity migration) go with it. They can also delete their
-- history.
-- A play still going isn't shown to anyone else in the history (the Played tab, recent activity) until
-- it's over, so that what someone is playing right now shows only as "playing now", to whoever their
-- choice for it lets see it.
--
-- Apply with: npx supabase db push

alter table public.privacy_settings
  add column record_played boolean not null default true;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Whether a player lets GameHub keep a history of what they play (out of the box, they do)
create function private.keeps_history(p_owner uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select s.record_played from public.privacy_settings s where s.user_id = p_owner), true);
$$;

-- Whether the signed-in player (or a visitor) may see a play in a player's history: always their
-- own; someone else's once the play is over (no report for 2 minutes, or ended), while the player
-- keeps a history, and as far as their choice for p_what lets the viewer see it
create function private.can_see_play(p_owner uuid, p_what text, p_ended_at timestamptz, p_last_seen_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not distinct from p_owner or (
    (p_ended_at is not null or p_last_seen_at <= now() - interval '2 minutes')
    and private.keeps_history(p_owner)
    and private.can_see(p_owner, private.audience(p_owner, p_what))
  );
$$;

-- ---------------------------------------------------------------------------
-- Recording, only when the player lets it
-- ---------------------------------------------------------------------------

-- As in the play activity migration, plus: nothing when the player keeps no history (returns null)
create or replace function public.start_play(p_game text)
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
  if not private.keeps_history(uid) then
    return null;
  end if;
  if (select count(*) from public.play_sessions s
      where s.user_id = uid and s.started_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many play sessions in the last hour' using errcode = 'P0001', hint = 'play_limit';
  end if;
  insert into public.play_sessions (user_id, game_id) values (uid, p_game) returning id into session;
  return session;
end;
$$;

-- As in the play activity migration, plus: nothing when the player keeps no history (returns null)
create or replace function public.report_play(p_session uuid, p_seconds integer, p_end boolean default false)
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
  if not private.keeps_history(uid) then
    return null;
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

-- ---------------------------------------------------------------------------
-- What others see
-- ---------------------------------------------------------------------------

-- As in the play activity migration, but through can_see_play: a play still going counts once it's
-- over, and nothing shows to others while the player keeps no history
create or replace function public.player_played(p_user uuid)
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
    and private.can_see_play(p_user, 'played', s.ended_at, s.last_seen_at)
  group by s.game_id
  having sum(s.seconds) >= 60
  order by max(s.last_seen_at) desc;
$$;

-- As in the play activity migration, but through can_see_play (inside, so that a play still going
-- leaves the one before it to show)
create or replace function public.recent_activity(p_limit integer default 12)
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
      and private.can_see_play(s.user_id, 'activity', s.ended_at, s.last_seen_at)
    order by s.user_id, s.game_id, s.last_seen_at desc
  ) x
  join public.profiles p on p.id = x.user_id
  join public.games g on g.id = x.game_id and g.published
  order by x.last_seen_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

-- As in the play activity migration, plus: only for players who keep a history (a play that was going
-- when they turned it off stops showing at once)
create or replace function public.playing_now(p_users uuid[])
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
    and private.keeps_history(s.user_id)
    and private.can_see(s.user_id, private.audience(s.user_id, 'playing'))
  order by s.user_id, s.last_seen_at desc;
$$;

-- ---------------------------------------------------------------------------
-- The player's own controls
-- ---------------------------------------------------------------------------

-- Deletes the signed-in player's play history (all their play sessions); returns how many plays went
create function public.delete_my_play_history()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  gone integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.play_sessions s where s.user_id = uid;
  get diagnostics gone = row_count;
  return gone;
end;
$$;

-- As in the play activity migration, plus whether the player keeps a history (a new return type, so
-- it's made anew)
drop function public.my_privacy();
create function public.my_privacy()
returns table (show_played text, show_playing text, show_activity text, record_played boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select private.audience(uid, 'played'), private.audience(uid, 'playing'), private.audience(uid, 'activity'),
         private.keeps_history(uid)
  from (select (select auth.uid()) as uid) me
  where uid is not null;
$$;

-- As in the play activity migration, plus the switch (a new argument, so it's made anew: the old one
-- would clash with it)
drop function public.set_privacy(text, text, text);
create function public.set_privacy(
  p_show_played text default null,
  p_show_playing text default null,
  p_show_activity text default null,
  p_record_played boolean default null
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
  insert into public.privacy_settings as s (user_id, show_played, show_playing, show_activity, record_played)
  values (
    uid,
    coalesce(p_show_played, private.audience(uid, 'played')),
    coalesce(p_show_playing, private.audience(uid, 'playing')),
    coalesce(p_show_activity, private.audience(uid, 'activity')),
    coalesce(p_record_played, true)
  )
  on conflict (user_id) do update set
    show_played = coalesce(p_show_played, s.show_played),
    show_playing = coalesce(p_show_playing, s.show_playing),
    show_activity = coalesce(p_show_activity, s.show_activity),
    record_played = coalesce(p_record_played, s.record_played),
    updated_at = now();
end;
$$;

-- Nothing is executable by default; grant only what each role needs (the functions made anew above lost
-- their grants; the replaced ones keep theirs)
revoke execute on function
  private.keeps_history(uuid),
  private.can_see_play(uuid, text, timestamptz, timestamptz),
  public.delete_my_play_history(),
  public.my_privacy(),
  public.set_privacy(text, text, text, boolean)
from public, anon, authenticated;

grant execute on function
  public.delete_my_play_history(),
  public.my_privacy(),
  public.set_privacy(text, text, text, boolean)
to authenticated;
