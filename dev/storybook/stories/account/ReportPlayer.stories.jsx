import { fn } from 'storybook/test';
import ReportPlayer from '../../../../src/components/account/ReportPlayer/ReportPlayer';
import { player } from '../../mocks/data';

/** Reporting a player to the developer (the ⋯ on their profile): cheating (with the game) or something else */
export default {
  title: 'Account/Report a player',
  component: ReportPlayer,
  args: { player: player('turbo_taco19'), onDone: fn(), onClose: fn() },
  argTypes: { player: { control: false } },
};

export const Default = {};

export const Cheating = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: /Cheating/ }));
  },
};

export const SomethingElse = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: /Something else/ }));
  },
};
