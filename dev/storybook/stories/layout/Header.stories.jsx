import { fn } from 'storybook/test';
import Header from '../../../../src/components/layout/Header/Header';
import Footer from '../../../../src/components/layout/Footer/Footer';

/** The header (with the phone menu button when the sidebar is the navigation) and the footer */
export default {
  title: 'Layout/Header and footer',
  parameters: { layout: 'fullscreen' },
};

export const HeaderWithMenuButton = {
  render: (args) => <Header {...args} />,
  args: { onMenuToggle: fn(), isMenuOpen: false },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
};

export const HeaderOnly = { render: () => <Header /> };

export const SiteFooter = { render: () => <Footer /> };
