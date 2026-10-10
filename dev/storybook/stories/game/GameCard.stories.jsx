import { fn } from 'storybook/test';
import GameCard from '../../../../src/components/layout/game/GameCard/GameCard';
import { gamesById } from '../../../../src/data/games';

/** A game in the games list: its picture, title and tags, its buttons, and its info (the ⓘ button) */
export default {
  title: 'Game/Game card',
  component: GameCard,
  parameters: { layout: 'centered', scenario: (args) => ({ downloads: args.downloaded ? [args.gameId] : [] }) },
  render: ({ gameId, downloaded, ...args }) => (
    <div style={{ width: 340 }}>
      <GameCard {...args} game={gamesById.get(gameId)} />
    </div>
  ),
  argTypes: {
    gameId: { control: 'select', options: [...gamesById.keys()] },
    downloaded: { description: 'Downloaded to play offline' },
    selectedTags: { control: 'check', options: ['easy', 'arcade', 'puzzle', 'classic'] },
  },
  args: { gameId: 'snake', downloaded: false, selectedTags: [], onTagClick: fn() },
};

export const Default = {};
/** Bookmarked (signed in: Tetris is) */
export const Bookmarked = { args: { gameId: 'tetris' } };
export const Downloaded = { args: { downloaded: true } };
/** Offline and not downloaded: dimmed */
export const NeedsInternet = { globals: { network: 'offline' } };
/** An app on Google Play: its store button, in yellow with the Google Play logo */
export const App = { args: { gameId: 'chillzone' } };
/** A collection on a site of its own */
export const Collection = { args: { gameId: 'flashback-arcade' } };
/** A tag picked in the filters: lit up, with a pink edge (point at the card to see its tags) */
export const TagPicked = { args: { selectedTags: ['classic'] } };

export const InfoOpen = {
  // As a keyboard player opens it: a card shows its buttons while one of them has the focus (they take no clicks
  // while hidden, and a pretend hover doesn't show them)
  play: async ({ canvas, userEvent }) => {
    (await canvas.findByRole('button', { name: 'Snake Game: Game Info' })).focus();
    await userEvent.keyboard('{Enter}');
  },
};
