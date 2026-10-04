import { PiDotsThreeVertical, PiFlag, PiProhibit } from 'react-icons/pi';
import { fn } from 'storybook/test';
import Menu from '../../../../src/components/common/Menu/Menu';

/** A ⋯ button with a short list of actions: arrow keys move through them, Escape closes it */
export default {
  title: 'Common/Menu',
  component: Menu,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ padding: '24px 24px 140px 240px' }}><Story /></div>],
  args: {
    label: 'More for Taco Tim',
    icon: <PiDotsThreeVertical aria-hidden="true" />,
    items: [
      { label: 'Block', icon: <PiProhibit aria-hidden="true" />, onSelect: fn(), danger: true },
      { label: 'Report…', icon: <PiFlag aria-hidden="true" />, onSelect: fn(), danger: true },
    ],
  },
  argTypes: { icon: { control: false }, items: { control: false } },
};

export const Closed = {};

export const Open = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'More for Taco Tim' }));
  },
};
