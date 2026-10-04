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
/** An app on Google Play */
export const App = { args: { gameId: 'chillzone' } };
/** A collection on a site of its own */
export const Collection = { args: { gameId: 'flashback-arcade' } };
export const TagPicked = { args: { selectedTags: ['easy'] } };

export const InfoOpen = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Snake Game: Game Info' }));
  },
};
