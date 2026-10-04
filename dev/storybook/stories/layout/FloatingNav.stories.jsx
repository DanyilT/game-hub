import FloatingNav from '../../../../src/components/layout/FloatingNav/FloatingNav';

/** The floating button (Settings → Preferences → Navigation), which opens into two rings of buttons */
export default {
  title: 'Layout/Floating button',
  component: FloatingNav,
  argTypes: { corner: { control: 'inline-radio', options: ['right', 'left'] } },
  args: { corner: 'right' },
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div style={{ minHeight: '100vh' }}><Story /></div>],
};

export const Closed = {};

export const Open = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Open menu' }));
  },
};

export const OpenLeft = { ...Open, args: { corner: 'left' } };
export const OpenSignedOut = { ...Open, globals: { account: 'guest' } };
