import { fn } from 'storybook/test';
import Sidebar from '../../../../src/components/layout/Sidebar/Sidebar';

/**
 * The sidebar: icons, or wide with labels (desktop); a drawer from the header's menu button (phones). Its items come
 * from useNavItems: Profile shows a dot and a count for friend requests waiting (two, in the made-up world).
 */
export default {
  title: 'Layout/Sidebar',
  component: Sidebar,
  args: { isExpanded: true, isOpen: false, onToggleExpanded: fn(), onClose: fn() },
  parameters: { layout: 'fullscreen' },
};

export const Expanded = {};
export const Collapsed = { args: { isExpanded: false } };
export const SignedOut = { globals: { account: 'guest' } };
export const AccountsOff = { globals: { account: 'off' } };

/** On a phone, open as a drawer */
export const PhoneDrawer = { args: { isOpen: true }, globals: { viewport: { value: 'mobile2', isRotated: false } } };
