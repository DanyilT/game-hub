-- Friends: players add each other. A request waits until the other player accepts it.
-- - Friends lists are public: accepted friendships show on both players' profiles.
-- - Requests are private: only the two players see a pending one.
-- - Writes go through the functions below. A player has at most 20 requests waiting for an answer.
-- Removing a friend, declining a request and cancelling one are all remove_friend(). Everything here
-- is deleted with either player's account (ON DELETE CASCADE from profiles).
--
-- Apply with: npx supabase db push

create table public.friendships (
  -- The pair, smaller id first, so each pair has exactly one row
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null,
  status text not null default 'pending'
    constraint friendship_status check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  constraint friendship_pair_order check (user_a < user_b),
  constraint friendship_requester check (requested_by in (user_a, user_b)),
  constraint friendship_accepted_at check ((status = 'accepted') = (accepted_at is not null))
);

create index friendships_user_b on public.friendships (user_b);

alter table public.friendships enable row level security;
create policy "Friends are public, requests are between the two players"
  on public.friendships for select to anon, authenticated
  using (status = 'accepted' or (select auth.uid()) in (user_a, user_b));
-- No write policies: only the functions below write

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions the site calls (supabase.rpc)
-- ---------------------------------------------------------------------------

-- Asks another player to be friends. If they already asked, that's a yes: you're friends straight
-- away. Returns the friendship's status afterwards: 'pending' or 'accepted'.
create function public.send_friend_request(p_user uuid)
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

-- Accepts a request from another player. Returns whether there was one to accept.
create function public.accept_friend_request(p_user uuid)
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
  update public.friendships f set status = 'accepted', accepted_at = now()
  where f.user_a = least(uid, p_user) and f.user_b = greatest(uid, p_user)
    and f.status = 'pending' and f.requested_by = p_user;
  return found;
end;
$$;

-- Unfriends another player, declines their request or cancels yours. Returns whether there was
-- anything to remove.
create function public.remove_friend(p_user uuid)
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
  delete from public.friendships f
  where f.user_a = least(uid, p_user) and f.user_b = greatest(uid, p_user);
  return found;
end;
$$;

-- A player's friends, newest friendship first (public, like the table's accepted rows).
-- Runs with the caller's rights: RLS already shows everyone the accepted rows and the profiles.
create function public.player_friends(p_user uuid)
returns table (id uuid, username text, display_name text, avatar_url text, since timestamptz)
language sql
stable
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url, f.accepted_at
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = p_user then f.user_b else f.user_a end
  where f.status = 'accepted' and p_user in (f.user_a, f.user_b)
  order by f.accepted_at desc, p.username;
$$;

-- The signed-in player's requests waiting for an answer: 'incoming' (someone asked them) or
-- 'outgoing' (they asked), newest first
create function public.my_friend_requests()
returns table (id uuid, username text, display_name text, avatar_url text, direction text, sent_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url,
    case when f.requested_by = (select auth.uid()) then 'outgoing' else 'incoming' end,
    f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where f.status = 'pending' and (select auth.uid()) in (f.user_a, f.user_b)
  order by f.created_at desc;
$$;

-- Nothing is executable by default; grant only what each role needs
revoke execute on function
  public.send_friend_request(uuid),
  public.accept_friend_request(uuid),
  public.remove_friend(uuid),
  public.player_friends(uuid),
  public.my_friend_requests()
from public, anon, authenticated;

grant execute on function
  public.send_friend_request(uuid),
  public.accept_friend_request(uuid),
  public.remove_friend(uuid),
  public.my_friend_requests()
to authenticated;
grant execute on function public.player_friends(uuid) to anon, authenticated;
