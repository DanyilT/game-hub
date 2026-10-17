import { useEffect } from 'react';
import { dismissToast, showToast } from '../../../../src/lib/toast';

// Shows the story's messages as the site does (showToast); the decorator draws Toasts
const Messages = ({ messages }) => {
  useEffect(() => {
    const ids = messages.map(({ text, tone, action }) => showToast(text, { tone, duration: 0, action }));
    return () => ids.forEach(dismissToast);
  }, [messages]);
  return null;
};

/** Short messages at the bottom of the screen (src/lib/toast.js): at most three, the oldest goes first */
export default {
  title: 'Common/Messages',
  parameters: { layout: 'fullscreen' },
  render: (args) => <div style={{ minHeight: '100vh' }}><Messages {...args} /></div>,
};

export const Info = { args: { messages: [{ text: "You're offline. Downloaded games still play.", tone: 'info' }] } };
export const ErrorMessage = { args: { messages: [{ text: "Couldn't save that. Check your connection and try again.", tone: 'error' }] } };

export const WithAButton = {
  args: {
    messages: [{
      text: 'Favorites are public: they show on your profile, for anyone to see. Bookmarks stay private.',
      tone: 'info',
      action: { label: 'Got it' },
    }],
  },
};

export const ThreeAtOnce = {
  args: {
    messages: [
      { text: "You're back online. Getting your game tickets…", tone: 'info' },
      { text: 'Tickets ready: your games are saved to your account again. 2 games you played offline were checked and saved to your account.', tone: 'info' },
      { text: 'Snake can’t be downloaded yet.', tone: 'error' },
    ],
  },
};
