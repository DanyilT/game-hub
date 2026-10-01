-- Cloud saves: a signed-in player's progress in each game, kept in their account.
--
-- The game never talks to Supabase. It calls GameHub.save() (js/gamehub.js in the game), which
-- keeps the save in the browser and hands it to the hub's bridge (public/hub-bridge.js, running in
-- the game's page). The bridge passes it to the hub page, which calls save_game(). The hub sends
-- at most one save per game every 10 seconds, plus one when the page is left.
--
-- One row per player and game: the game's own JSON object, exactly what GameHub.save() got.
-- Private: each player reads only their own. Writes go through save_game() and delete_game_save().
--
-- Apply with: npx supabase db push

create table public.game_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on update cascade on delete cascade,
  -- The game's own object. Games send at most 64 KB of JSON; jsonb's text form adds a space
  -- after every ':' and ',', so the limit here leaves room for those.
  data jsonb not null
    constraint game_save_object check (jsonb_typeof(data) = 'object')
    constraint game_save_size check (octet_length(data::text) <= 131072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.game_saves enable row level security;
create policy "Players read their own saves"
  on public.game_saves for select to authenticated
  using ((select auth.uid()) = user_id);
-- No write policies: only the functions below write

revoke all on public.game_saves from anon, authenticated;
grant select on public.game_saves to authenticated;

-- ---------------------------------------------------------------------------
-- Functions the site calls (supabase.rpc)
-- ---------------------------------------------------------------------------

-- Keeps the signed-in player's save for a game, replacing the one before. Returns when it was saved.
-- The table's checks refuse anything that isn't an object, or is too big; an unknown game fails
-- its foreign key.
create function public.save_game(p_game text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  saved_at timestamptz;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.game_saves as s (user_id, game_id, data)
  values (uid, p_game, p_data)
  on conflict (user_id, game_id) do update
    set data = excluded.data, updated_at = now()
  returning s.updated_at into saved_at;
  return saved_at;
end;
$$;

-- The game's help menu → Reset progress: deletes the signed-in player's save for a game (the hub
-- clears the browser's copy through the bridge). Returns whether there was one.
create function public.delete_game_save(p_game text)
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
  delete from public.game_saves where user_id = uid and game_id = p_game;
  return found;
end;
$$;

-- Nothing is executable by default; grant only what each role needs
revoke execute on function
  public.save_game(text, jsonb),
  public.delete_game_save(text)
from public, anon, authenticated;

grant execute on function
  public.save_game(text, jsonb),
  public.delete_game_save(text)
to authenticated;
