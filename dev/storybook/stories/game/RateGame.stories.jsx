import { expect, waitFor } from 'storybook/test';
import RateGame from '../../../../src/components/layout/game/RateGame/RateGame';
import RatingSlider from '../../../../src/components/layout/game/RatingSlider/RatingSlider';
import { gamesById } from '../../../../src/data/games';
import { GAME_STATS } from '../../mocks/data';

/**
 * Rating a game: the slider (drag it, tap it, or use the arrow keys; 1 and 5 send out faces), then a "tell us more"
 * box that goes to the developer. The arrow shows how the players rated it.
 */
export default {
  title: 'Game/Rating',
  component: RateGame,
  parameters: { layout: 'padded' },
  render: ({ gameId }) => (
    <div style={{ maxWidth: 420 }}>
      <RateGame game={gamesById.get(gameId)} stats={GAME_STATS[gameId]} />
    </div>
  ),
  argTypes: { gameId: { control: 'select', options: [...gamesById.keys()] } },
  args: { gameId: 'minesweeper' },
};

/** Not rated yet */
export const Unrated = {};
/** Rated (signed in, Snake has a 5) */
export const Rated = { args: { gameId: 'snake' } };
export const SignedOut = { globals: { account: 'guest' } };

export const PlayersRatings = {
  args: { gameId: 'snake' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Show the players' ratings/ }));
  },
};

/** Rating it: the slider moved (the first key picks 3, End then 5) and Rate pressed, then the "tell us more" box */
export const TellUsMore = {
  play: async ({ canvas, userEvent }) => {
    const slider = await canvas.findByRole('slider');
    // Signed in, it waits for the player's ratings to load
    await waitFor(() => expect(slider).not.toHaveAttribute('aria-disabled'));
    slider.focus();
    await userEvent.keyboard('{End}{End}');
    await userEvent.click(await canvas.findByRole('button', { name: 'Rate' }));
  },
};

/** The slider on its own */
export const Slider = {
  render: (args) => <RatingSlider {...args} />,
  argTypes: { value: { control: { type: 'range', min: 1, max: 5, step: 1 } } },
  args: { value: 3, compact: false, disabled: false, label: 'Your rating', onChange: () => {} },
};
