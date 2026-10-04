import { AppRoutes } from '../../../../src/App';

/** About, the Terms and the Privacy Policy */
export default {
  title: 'Pages/About, Terms and Privacy',
  component: AppRoutes,
  render: () => <AppRoutes />,
};

export const About = { parameters: { route: '/about' } };
export const Terms = { parameters: { route: '/terms' } };
export const Privacy = { parameters: { route: '/privacy' } };
