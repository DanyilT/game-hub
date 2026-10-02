-- Who made each game, and the game frame's height at a few widths.
-- - developer: { "name": "Dany", "url": "https://github.com/DanyilT" } (the url is optional). Every game names
--   one: the build checks the published rows, so a new row can still be filled in before it's published.
-- - dimensions: was { "w", "h", "center" }, one size for every frame. Games lay out differently at different
--   widths (Tetris is twice as tall on a phone), so it's now { "sizes": [{ "w", "h" }, …], "center" }: how tall
--   the game is (h) when its frame is w wide, narrowest first. The frame takes the height of the widest size
--   that fits it. The four dt-games games get sizes measured at their layouts' widths, with their instructions
--   closed; any other row keeps its one size.
-- The README's "Adding a game" has the format.
--
-- Apply with: npx supabase db push

alter table public.games add column developer json;

update public.games set developer = '{"name": "Dany", "url": "https://github.com/DanyilT"}';

-- Only rows still in the old format, so a size already edited in the dashboard stays
update public.games
set dimensions = '{"sizes": [{"w": 320, "h": 710}, {"w": 420, "h": 720}, {"w": 600, "h": 730}], "center": true}'
where id = 'snake' and dimensions ->> 'w' is not null;

update public.games
set dimensions = '{"sizes": [{"w": 320, "h": 1130}, {"w": 400, "h": 1150}, {"w": 650, "h": 770}], "center": true}'
where id = 'tetris' and dimensions ->> 'w' is not null;

update public.games
set dimensions = '{"sizes": [{"w": 400, "h": 520}], "center": true}'
where id = 'minesweeper' and dimensions ->> 'w' is not null;

update public.games
set dimensions = '{"sizes": [{"w": 320, "h": 660}, {"w": 400, "h": 830}, {"w": 600, "h": 890}], "center": true}'
where id = 'sudoku' and dimensions ->> 'w' is not null;

-- Any other game: its one size, as a list of one
update public.games
set dimensions = case
  when dimensions -> 'center' is null
    then json_build_object('sizes', json_build_array(json_build_object('w', dimensions -> 'w', 'h', dimensions -> 'h')))
  else json_build_object('sizes', json_build_array(json_build_object('w', dimensions -> 'w', 'h', dimensions -> 'h')),
    'center', dimensions -> 'center')
end
where dimensions ->> 'w' is not null;
