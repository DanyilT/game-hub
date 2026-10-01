-- What players think of the games, and the games they keep:
-- - ratings: 1 to 5 per player and game. Private: each player sees their own. Everyone sees each
--   game's count and average (game_stats()).
-- - favorites: liked games. Public: a player's favorites show on their profile.
-- - bookmarks: games saved to play later. Private: each player sees their own. Everyone sees the
--   count.
-- - feedback: what players tell you, after rating a game or from its help menu. Players can send
--   it but not read it back. You read it in the table editor (Table Editor → feedback).
-- Everything here is deleted with the player's account (ON DELETE CASCADE from profiles).
--
-- Apply with: npx supabase db push

-- ---------------------------------------------------------------------------
-- Ratings (written through rate_game(), below)
-- ---------------------------------------------------------------------------
create table public.ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on update cascade on delete cascade,
  score smallint not null
    constraint rating_score check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index ratings_game on public.ratings (game_id);

alter table public.ratings enable row level security;
create policy "Players see their own ratings"
  on public.ratings for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.ratings from anon, authenticated;
grant select on public.ratings to authenticated;

-- ---------------------------------------------------------------------------
-- Hearts (public) and bookmarks (private). Players add and remove their own rows.
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index favorites_game on public.favorites (game_id);

alter table public.favorites enable row level security;
create policy "Hearts are public"
  on public.favorites for select to anon, authenticated
  using (true);
create policy "Players add their own favorites"
  on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Players remove their own favorites"
  on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.favorites from anon, authenticated;
grant select on public.favorites to anon, authenticated;
-- Only the game: user_id is always the player's own (its default), created_at is now
grant insert (game_id), delete on public.favorites to authenticated;

create table public.bookmarks (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index bookmarks_game on public.bookmarks (game_id);

alter table public.bookmarks enable row level security;
create policy "Players see their own bookmarks"
  on public.bookmarks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Players add their own bookmarks"
  on public.bookmarks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Players remove their own bookmarks"
  on public.bookmarks for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.bookmarks from anon, authenticated;
grant select, delete on public.bookmarks to authenticated;
grant insert (game_id) on public.bookmarks to authenticated;

-- ---------------------------------------------------------------------------
-- Feedback: a mailbox. Players send, only you read (the table editor skips RLS).
-- ---------------------------------------------------------------------------
create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The game it's about (none for the site itself). A game deleted later leaves the message.
  game_id text references public.games (id) on update cascade on delete set null,
  kind text not null
    constraint feedback_kind check (kind in ('rating', 'bug', 'other')),
  -- For kind 'rating': the rating it was sent with
  score smallint
    constraint feedback_score check (score between 1 and 5),
  -- Stored trimmed, so padding can't get around the length limit
  message text not null
    constraint feedback_message check (message = btrim(message) and char_length(message) between 1 and 2000),
  -- Bug reports: the browser it happened in (its user agent), which the form says it sends
  browser text
    constraint feedback_browser check (char_length(browser) <= 400),
  created_at timestamptz not null default now(),
  -- Yours to tick off in the table editor
  resolved boolean not null default false
);

create index feedback_user on public.feedback (user_id, created_at);

alter table public.feedback enable row level security;
create policy "Players send feedback as themselves"
  on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- No select policy: sent feedback can't be read back through the API

revoke all on public.feedback from anon, authenticated;
grant insert (game_id, kind, score, message, browser) on public.feedback to authenticated;

-- At most 20 messages a day per player, against floods
create function private.limit_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.feedback f
      where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s a lot of feedback for one day. Thank you! Try again tomorrow.'
      using errcode = 'P0001', hint = 'feedback_limit';
  end if;
  return new;
end;
$$;

create trigger limit_feedback
  before insert on public.feedback
  for each row execute function private.limit_feedback();

-- ---------------------------------------------------------------------------
-- updated_at on ratings (private.touch_updated_at() comes from the games migration)
-- ---------------------------------------------------------------------------
create trigger touch_updated_at
  before update on public.ratings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Functions the site calls (supabase.rpc)
-- ---------------------------------------------------------------------------

-- Rates a game for the signed-in player (1 to 5), changing their earlier rating if there is one.
-- No score (null) removes their rating.
create function public.rate_game(p_game text, p_score smallint)
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
  if p_score is null then
    delete from public.ratings where user_id = uid and game_id = p_game;
  else
    insert into public.ratings (user_id, game_id, score)
    values (uid, p_game, p_score)
    on conflict (user_id, game_id) do update set score = excluded.score;
  end if;
end;
$$;

-- Each published game's ratings (count, average, and how many of each score, 1 to 5), favorites and
-- bookmarks: the totals only, never who. One game with p_game, or all of them in the site's order.
create function public.game_stats(p_game text default null)
returns table (
  game_id text,
  rating_count integer,
  rating_average numeric,
  score_counts integer[],
  favorite_count integer,
  bookmark_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    coalesce(r.total, 0),
    r.average,
    coalesce(r.by_score, array[0, 0, 0, 0, 0]),
    (select count(*)::integer from public.favorites f where f.game_id = g.id),
    (select count(*)::integer from public.bookmarks b where b.game_id = g.id)
  from public.games g
  left join lateral (
    select
      count(*)::integer as total,
      round(avg(x.score), 1) as average,
      array[
        count(*) filter (where x.score = 1)::integer,
        count(*) filter (where x.score = 2)::integer,
        count(*) filter (where x.score = 3)::integer,
        count(*) filter (where x.score = 4)::integer,
        count(*) filter (where x.score = 5)::integer
      ] as by_score
    from public.ratings x
    where x.game_id = g.id
    having count(*) > 0
  ) r on true
  where g.published
    and (p_game is null or g.id = p_game)
  order by g.position, g.id;
$$;

-- Nothing is executable by default; grant only what each role needs
revoke execute on function
  private.limit_feedback(),
  public.rate_game(text, smallint),
  public.game_stats(text)
from public, anon, authenticated;

grant execute on function public.rate_game(text, smallint) to authenticated;
grant execute on function public.game_stats(text) to anon, authenticated;
