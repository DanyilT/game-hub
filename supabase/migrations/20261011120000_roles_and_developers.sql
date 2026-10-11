-- Roles: every account is a player; some are also developers or admins.
--
-- - Developer: a bio and links on their profile, and the games they made link to it: the games table's new
--   `developer_id` is their account (the table editor picks it from the profiles). The site's game list puts its
--   username in the game's `developer` ({ "name", "url", "username" }), and the game page links "by …" to their
--   profile (to `url` when there's no account). A new username rebuilds the site, and so does a deleted account (the
--   game keeps its name and url). Developers are listed on /developers.
-- - Admin: deals with players' reports (reads them, marks them resolved), and makes players developers or not, all on
--   /admin. Being an admin is given only here, or in the SQL editor:
--     insert into public.user_roles (user_id, role) select id, 'admin' from public.profiles where username = '…';
-- - Who's a developer is public (their profile says so); who's an admin, only to themselves.
-- Everything here is deleted with the account (ON DELETE CASCADE from profiles).
--
-- Apply with: npx supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null constraint user_roles_user_id_fkey references public.profiles (id) on delete cascade,
  role text not null
    constraint user_role check (role in ('developer', 'admin')),
  granted_at timestamptz not null default now(),
  -- The admin who gave it (null: given in the SQL editor, or that admin's account is gone)
  granted_by uuid constraint user_roles_granted_by_fkey references public.profiles (id) on delete set null,
  primary key (user_id, role)
);

create index user_roles_role on public.user_roles (role, granted_at);

alter table public.user_roles enable row level security;
create policy "Developers are public, other roles only to their owner"
  on public.user_roles for select to anon, authenticated
  using (role = 'developer' or user_id = (select auth.uid()));
-- No write policies: only admins change roles, through set_developer()

revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to anon, authenticated;

-- A developer's bio and links (kept when the role is taken away, and shown again if it comes back)
create table public.developer_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Stored trimmed, like display names
  bio text not null default ''
    constraint developer_bio check (bio = btrim(bio) and char_length(bio) <= 500),
  -- https addresses (GitHub, itch.io, a site…), in the order they're shown; update_developer_profile() checks each
  links text[] not null default '{}'
    constraint developer_links check (cardinality(links) <= 6 and array_position(links, null) is null),
  updated_at timestamptz not null default now()
);

alter table public.developer_profiles enable row level security;
create policy "Developers' bios and links are public"
  on public.developer_profiles for select to anon, authenticated
  using (exists (
    select from public.user_roles r where r.user_id = developer_profiles.user_id and r.role = 'developer'
  ));
-- No write policies: written by update_developer_profile() only

revoke all on public.developer_profiles from anon, authenticated;
grant select on public.developer_profiles to anon, authenticated;

-- The developers, for their list (/developers): each one's profile with their bio and links. It reads the tables as
-- whoever asks (security_invoker), so the row level security above decides what it shows.
create view public.developers with (security_invoker = true) as
  select
    p.id, p.username, p.display_name, p.avatar_url, p.created_at,
    r.granted_at as developer_since,
    coalesce(d.bio, '') as bio,
    coalesce(d.links, '{}') as links
  from public.profiles p
  join public.user_roles r on r.user_id = p.id and r.role = 'developer'
  left join public.developer_profiles d on d.user_id = p.id;

revoke all on public.developers from anon, authenticated;
grant select on public.developers to anon, authenticated;

-- Reports: who resolved one, and when (admins tick them off on /admin)
alter table public.player_reports
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Games name their developer's account
-- ---------------------------------------------------------------------------
-- A deleted account leaves the game its developer's name and url (an edit to the games, so the site rebuilds)
alter table public.games
  add column developer_id uuid constraint games_developer_id_fkey references public.profiles (id) on delete set null;

create index games_developer_id on public.games (developer_id);

-- The site's game list has the developer's username, so a new one rebuilds it (as an edit to the games does)
create function private.rebuild_for_developer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select from public.games g where g.developer_id = new.id) then
    update private.site_rebuild set requested_at = now();
  end if;
  return null;
end;
$$;

create trigger rebuild_for_developer
  after update of username on public.profiles
  for each row when (old.username is distinct from new.username)
  execute function private.rebuild_for_developer();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Whether a player has a role
create function private.has_role(p_user uuid, p_role text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select from public.user_roles r where r.user_id = p_user and r.role = p_role);
$$;

-- Stops anyone but an admin (for the admin functions below)
create function private.require_admin()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not private.has_role(uid, 'admin') then
    raise exception 'Only admins can do that' using errcode = '42501', hint = 'not_admin';
  end if;
  return uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Developers
-- ---------------------------------------------------------------------------
-- A developer's own bio and links (Settings → Developer). p_links: https addresses, at most 6, empty ones dropped.
create function public.update_developer_profile(p_bio text, p_links text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  said text := btrim(coalesce(p_bio, ''));
  kept text[];
  link text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not private.has_role(uid, 'developer') then
    raise exception 'Only developers have a bio and links' using errcode = '42501', hint = 'not_developer';
  end if;
  if char_length(said) > 500 then
    raise exception 'The bio can be up to 500 characters' using errcode = 'P0001', hint = 'bio_length';
  end if;
  select coalesce(array_agg(btrim(l) order by n), '{}') into kept
  from unnest(coalesce(p_links, '{}')) with ordinality as u (l, n)
  where btrim(coalesce(l, '')) <> '';
  if cardinality(kept) > 6 then
    raise exception 'Up to 6 links' using errcode = 'P0001', hint = 'links_count';
  end if;
  foreach link in array kept loop
    if link !~ '^https://[^\s/?#]+\.[^\s/?#]+(\S*)$' or char_length(link) > 200 then
      raise exception 'Links are https addresses, like https://github.com/you'
        using errcode = 'P0001', hint = 'link_invalid', detail = link;
    end if;
  end loop;

  insert into public.developer_profiles (user_id, bio, links, updated_at) values (uid, said, kept, now())
  on conflict (user_id) do update set bio = excluded.bio, links = excluded.links, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
-- Makes a player a developer (p_developer true) or not. Returns whether that changed anything.
create function public.set_developer(p_user uuid, p_developer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_admin();
begin
  if not exists (select from public.profiles p where p.id = p_user) then
    raise exception 'There''s no such player' using errcode = 'P0001', hint = 'no_player';
  end if;
  if p_developer then
    insert into public.user_roles (user_id, role, granted_by) values (p_user, 'developer', uid) on conflict do nothing;
    if not found then
      return false;
    end if;
    insert into public.developer_profiles (user_id) values (p_user) on conflict do nothing;
    return true;
  end if;
  delete from public.user_roles r where r.user_id = p_user and r.role = 'developer';
  return found;
end;
$$;

-- Players' reports, newest first: open ones (p_resolved false), resolved ones (true), or all (null), each with both
-- players and how many reports there are about the reported one in all
create function public.admin_reports(p_resolved boolean default false)
returns table (
  id bigint, reason text, game_id text, message text, created_at timestamptz, resolved boolean,
  resolved_at timestamptz, resolved_by_username text,
  reporter uuid, reporter_username text, reporter_display_name text, reporter_avatar_url text,
  reported uuid, reported_username text, reported_display_name text, reported_avatar_url text,
  reports_about_them bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select r.id, r.reason, r.game_id, r.message, r.created_at, r.resolved, r.resolved_at, rb.username,
      r.reporter, a.username, a.display_name, a.avatar_url,
      r.reported, b.username, b.display_name, b.avatar_url,
      (select count(*) from public.player_reports o where o.reported = r.reported)
    from public.player_reports r
    join public.profiles a on a.id = r.reporter
    join public.profiles b on b.id = r.reported
    left join public.profiles rb on rb.id = r.resolved_by
    where p_resolved is null or r.resolved = p_resolved
    order by r.created_at desc, r.id desc
    limit 500;
end;
$$;

-- How many reports are still open (the Admin page's tab)
create function public.open_report_count()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return (select count(*) from public.player_reports r where not r.resolved);
end;
$$;

-- Marks a report resolved (p_resolved true) or open again. Returns whether there's such a report.
create function public.resolve_report(p_report bigint, p_resolved boolean default true)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_admin();
begin
  update public.player_reports r
  set resolved = p_resolved,
      resolved_at = case when p_resolved then now() end,
      resolved_by = case when p_resolved then uid end
  where r.id = p_report;
  return found;
end;
$$;

-- Nothing is executable by default; grant only what each role needs
revoke execute on function
  private.rebuild_for_developer(),
  private.has_role(uuid, text),
  private.require_admin(),
  public.update_developer_profile(text, text[]),
  public.set_developer(uuid, boolean),
  public.admin_reports(boolean),
  public.open_report_count(),
  public.resolve_report(bigint, boolean)
from public, anon, authenticated;

grant execute on function
  public.update_developer_profile(text, text[]),
  public.set_developer(uuid, boolean),
  public.admin_reports(boolean),
  public.open_report_count(),
  public.resolve_report(bigint, boolean)
to authenticated;

-- ---------------------------------------------------------------------------
-- Dany: a developer and an admin, and the developer of Dany's games (nothing, where there's no @dany)
-- ---------------------------------------------------------------------------
insert into public.user_roles (user_id, role)
select p.id, r.role
from public.profiles p cross join (values ('developer'), ('admin')) as r (role)
where p.username = 'dany'
on conflict do nothing;

insert into public.developer_profiles (user_id)
select p.id from public.profiles p where p.username = 'dany'
on conflict do nothing;

update public.games g
set developer_id = (select p.id from public.profiles p where p.username = 'dany')
where g.developer ->> 'name' = 'Dany' and g.developer_id is null
  and exists (select from public.profiles p where p.username = 'dany');
