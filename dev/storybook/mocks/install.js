import { onScenarioChange, scenario, setScenario } from './scenario';

// Storybook's stand-in for src/lib/install.js (.storybook/main.js swaps it in): the same module, except
// that the install state (can the browser's dialog open, is this a phone, are the steps showing) comes
// from the story (scenario.install) instead of the browser Storybook runs in.

export * from '../../../src/lib/install.js';

let state = { ...scenario.install };
const listeners = new Set();
onScenarioChange(() => {
  state = { ...scenario.install };
  listeners.forEach((listener) => listener());
});

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getInstallState = () => state;
export const openInstallSteps = () => setScenario({ install: { stepsOpen: true } });
export const closeInstallSteps = () => setScenario({ install: { stepsOpen: false } });
export const bannerDue = () => scenario.install.bannerDue;
export const installLater = () => setScenario({ install: { bannerDue: false } });
export const install = async () => {
  if (!scenario.install.canPrompt) openInstallSteps();
};
