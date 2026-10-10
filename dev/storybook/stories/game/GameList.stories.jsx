import { within } from 'storybook/test';
import GameList from '../../../../src/components/layout/game/GameList/GameList';
import { games } from '../../../../src/data/games';

/** The games grid with its filter box (the games page, without the rest of the layout) */
export default {
  title: 'Game/Games list',
  component: GameList,
  args: { games },
  argTypes: { games: { control: false } },
  parameters: { layout: 'padded' },
};

export const Default = {};

export const FiltersOpen = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Filter games/ }));
  },
};

/** Filters that match nothing */
export const NothingMatches = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Filter games/ }));
    const filters = within(await canvas.findByRole('region', { name: 'Filters' }));
    // Sudoku is the only hard game, and it's no arcade game
    await userEvent.click(filters.getByRole('button', { name: 'hard' }));
    await userEvent.click(filters.getByRole('button', { name: 'arcade' }));
  },
};
