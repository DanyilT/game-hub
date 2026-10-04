import GameReactions from '../../../../src/components/layout/game/GameReactions/GameReactions';
import { gamesById } from '../../../../src/data/games';
import { GAME_STATS } from '../../mocks/data';

/** The favorite (public) and bookmark (private) buttons on a game's page, with how many players pressed each */
export default {
  title: 'Game/Favorite and bookmark',
  component: GameReactions,
  parameters: { layout: 'centered' },
  render: ({ gameId, withTotals }) => <GameReactions game={gamesById.get(gameId)} stats={withTotals ? GAME_STATS[gameId] : null} />,
  argTypes: { gameId: { control: 'select', options: [...gamesById.keys()] } },
  args: { gameId: 'snake', withTotals: true },
};

/** Signed in: Snake is a favorite */
export const Favorite = {};
/** Tetris is bookmarked */
export const Bookmarked = { args: { gameId: 'tetris' } };
export const Neither = { args: { gameId: 'minesweeper' } };
export const TotalsLoading = { args: { withTotals: false } };
export const SignedOut = { globals: { account: 'guest' } };
