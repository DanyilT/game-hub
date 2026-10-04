import { fn } from 'storybook/test';
import GameHelp from '../../../../src/components/layout/game/GameHelp/GameHelp';
import { gamesById } from '../../../../src/data/games';

/** The game page's help window (the ? button): report a bug, send a private message, reset the game's progress */
export default {
  title: 'Game/Help window',
  component: GameHelp,
  render: ({ gameId, canReset, ...args }) => <GameHelp {...args} game={gamesById.get(gameId)} onReset={canReset ? args.onReset : null} />,
  argTypes: { gameId: { control: 'select', options: [...gamesById.keys()] } },
  args: { gameId: 'snake', connected: true, canReset: true, onReset: fn(async () => {}), onClose: fn() },
};

export const SignedIn = {};
export const SignedOut = { globals: { account: 'guest' } };
export const GameNotLoaded = { args: { connected: false } };

export const SendAMessage = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Send a message instead/ }));
  },
};

export const ResetProgress = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Reset progress/ }));
  },
};
