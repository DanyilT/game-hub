import { fn } from 'storybook/test';
import { WelcomeDialog } from '../../../../src/components/account/UsernameDialog/UsernameDialog';
import UsernameField from '../../../../src/components/account/UsernameField/UsernameField';
import { ME } from '../../mocks/data';

/**
 * A new player picks a username: keep the one they got, type one (checked as they type: try "zippy_fox55", taken, or
 * "admin", reserved), or roll the dice
 */
export default {
  title: 'Account/Username',
  component: WelcomeDialog,
  globals: { account: 'newPlayer' },
};

export const WelcomeWindow = {
  render: (args) => <WelcomeDialog {...args} />,
  args: { profile: { ...ME, username: 'cosmic_waffle57', username_history: [] }, onDone: fn(), onLater: fn() },
};

/** The field on its own, with each of its messages */
export const Field = {
  render: (args) => <div style={{ maxWidth: 380, padding: 24 }}><UsernameField {...args} /></div>,
  argTypes: { status: { control: 'select', options: ['unchanged', 'invalid', 'checking', 'available', 'taken', 'error'] } },
  args: { id: 'story-username', value: 'cosmic_waffle57', status: 'available', disabled: false, onChange: fn() },
};
