-- Blocks and reports: what a player can do about another one, from the ⋯ on their profile.
--
-- - Blocking: the two stop being friends (a request either way is dropped), neither can send the
--   other a friend request, and neither sees the other's games played, what they're playing now or
--   their plays in the recent activity, whatever their privacy choices say. Profiles stay public,
--   like everyone's. The blocked player isn't told, though a friend request to the player who
--   blocked them is turned down. Only the player who blocked sees the block (Settings → Privacy
--   lists them). From M10, blocks stop messages too.
-- - Reporting: a player tells the developer that another one cheats, or anything else against the
--   Terms. Reports can't be read back through the API; you read them in the table editor (Table
--   Editor → player_reports), and for cheating, the player's checked games next to them
--   (game_runs). At most one report a day about the same player, and 10 a day in all.
-- Everything here is deleted with either player's account (ON DELETE CASCADE from profiles).
--
-- Apply with: npx supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint block_not_self check (blocker <> blocked)
);

create index blocks_blocked on public.blocks (blocked);

alter table public.blocks enable row level security;
create policy "Players see the players they've blocked"
  on public.blocks for select to authenticated
  using ((select auth.uid()) = blocker);
-- No write policies: only the functions below write

revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;

create table public.player_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references public.profiles (id) on delete cascade,
  reported uuid not null references public.profiles (id) on delete cascade,
  reason text not null
    constraint report_reason check (reason in ('cheating', 'other')),
  -- For cheating: the game, if they said. A game deleted later leaves the report.
  game_id text references public.games (id) on update cascade on delete set null,
  -- Stored trimmed, like feedback; empty only for cheating, where it's optional
  message text not null default ''
    constraint report_message check (message = btrim(message) and char_length(message) <= 2000),
  created_at timestamptz not null default now(),
  -- Yours to tick off in the table editor
  resolved boolean not null default false,
  constraint report_not_self check (reporter <> reported),
  constraint report_says_what check (reason = 'cheating' or message <> '')
);

create index player_reports_reporter on public.player_reports (reporter, created_at);
create index player_reports_reported on public.player_reports (reported);

alter table public.player_reports enable row level security;
-- No policies and no grants: written by report_player() only, read in the table editor
revoke all on public.player_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Blocks hide activity and stop friend requests
-- ---------------------------------------------------------------------------
-- Whether either of two players has blocked the other
create function private.blocked_between(p_one uuid, p_other uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select from public.blocks b
    where (b.blocker = p_one and b.blocked = p_other) or (b.blocker = p_other and b.blocked = p_one)
  );
$$;

-- As in the play activity migration, plus: players who've blocked each other see none of each
-- other's activity (player_played, playing_now and recent_activity all ask this)
create or replace function private.can_see(p_owner uuid, p_audience text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when (select auth.uid()) = p_owner then true
    when private.blocked_between(p_owner, (select auth.uid())) then false
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

-- As in the friends migration, plus: no requests between players who've blocked each other. The
-- player who blocked is told to unblock first; the other isn't told why.
create or replace function public.send_friend_request(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  existing public.friendships;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_user is null or p_user = uid then
    raise exception 'You can''t add yourself as a friend' using errcode = 'P0001', hint = 'self';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'There''s no such player' using errcode = 'P0001', hint = 'no_player';
  end if;
  if exists (select from public.blocks b where b.blocker = uid and b.blocked = p_user) then
    raise exception 'You''ve blocked this player. Unblock them first.' using errcode = 'P0001', hint = 'blocked';
  end if;
  if exists (select from public.blocks b where b.blocker = p_user and b.blocked = uid) then
    raise exception 'You can''t add this player as a friend.' using errcode = 'P0001', hint = 'blocked';
  end if;

  select * into existing from public.friendships f
  where f.user_a = least(uid, p_user) and f.user_b = greatest(uid, p_user)
  for update;

  if found then
    -- They asked first: accept
    if existing.status = 'pending' and existing.requested_by = p_user then
      update public.friendships f set status = 'accepted', accepted_at = now()
      where f.user_a = existing.user_a and f.user_b = existing.user_b;
      return 'accepted';
    end if;
    return existing.status; -- already friends, or already asked
  end if;

  if (select count(*) from public.friendships f where f.requested_by = uid and f.status = 'pending') >= 20 then
    raise exception 'You have 20 friend requests waiting for an answer. Wait for some, or cancel one.'
      using errcode = 'P0001', hint = 'request_limit';
  end if;

  insert into public.friendships (user_a, user_b, requested_by)
  values (least(uid, p_user), greatest(uid, p_user), uid);
  return 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- Functions the site calls (supabase.rpc)
-- ---------------------------------------------------------------------------

-- Blocks another player: you stop being friends (a request either way is dropped). Returns whether
-- they weren't blocked already.
create function public.block_player(p_user uuid)
returns boolean
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
  if p_user is null or p_user = uid then
    raise exception 'You can''t block yourself' using errcode = 'P0001', hint = 'self';
  end if;
  if not exists (select from public.profiles p where p.id = p_user) then
    raise exception 'There''s no such player' using errcode = 'P0001', hint = 'no_player';
  end if;
  delete from public.friendships f where f.user_a = least(uid, p_user) and f.user_b = greatest(uid, p_user);
  insert into public.blocks (blocker, blocked) values (uid, p_user) on conflict do nothing;
  return found;
end;
$$;

-- Unblocks a player (friends again only through a new request). Returns whether they were blocked.
create function public.unblock_player(p_user uuid)
returns boolean
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
  delete from public.blocks b where b.blocker = uid and b.blocked = p_user;
  return found;
end;
$$;

-- Reports another player to the developer: p_reason 'cheating' (p_game: the game, if they know it;
-- p_message optional) or 'other' (p_message says what happened).
create function public.report_player(p_user uuid, p_reason text, p_game text default null, p_message text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  said text := btrim(coalesce(p_message, ''));
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_user is null or p_user = uid then
    raise exception 'You can''t report yourself' using errcode = 'P0001', hint = 'self';
  end if;
  if not exists (select from public.profiles p where p.id = p_user) then
    raise exception 'There''s no such player' using errcode = 'P0001', hint = 'no_player';
  end if;
  if p_reason = 'other' and said = '' then
    raise exception 'Say what happened, so the developer knows what to look for.'
      using errcode = 'P0001', hint = 'report_message';
  end if;
  if exists (select from public.player_reports r
             where r.reporter = uid and r.reported = p_user and r.created_at > now() - interval '1 day') then
    raise exception 'You''ve already reported this player today. The developer will look into it.'
      using errcode = 'P0001', hint = 'already_reported';
  end if;
  if (select count(*) from public.player_reports r
      where r.reporter = uid and r.created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s a lot of reports for one day. Try again tomorrow.'
      using errcode = 'P0001', hint = 'report_limit';
  end if;
  insert into public.player_reports (reporter, reported, reason, game_id, message)
  values (uid, p_user, p_reason, case when p_reason = 'cheating' then p_game end, said);
end;
$$;

-- Nothing is executable by default; grant only what each role needs (can_see and
-- send_friend_request keep theirs)
revoke execute on function
  private.blocked_between(uuid, uuid),
  public.block_player(uuid),
  public.unblock_player(uuid),
  public.report_player(uuid, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.block_player(uuid),
  public.unblock_player(uuid),
  public.report_player(uuid, text, text, text)
to authenticated;
