import { InstallBanner, InstallSteps } from '../../../../src/components/install/InstallApp';

/**
 * Installing the site as an app: the steps for a browser without an install dialog (Android's menu, or iPhone's Share
 * button), and the suggestion on the games page (phones, once a game or two has been opened)
 */
export default {
  title: 'Layout/Install the app',
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div style={{ minHeight: '100vh' }}><Story /></div>],
};

export const StepsAndroid = {
  render: () => <InstallSteps />,
  parameters: { scenario: { install: { platform: 'android', stepsOpen: true } } },
};

export const StepsIPhone = {
  render: () => <InstallSteps />,
  parameters: { scenario: { install: { platform: 'ios', stepsOpen: true } } },
};

/** The suggestion: at a phone width */
export const Suggestion = {
  render: () => <InstallBanner />,
  parameters: { scenario: { install: { platform: 'android', bannerDue: true } } },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
};
