import { Link } from 'react-router';
import { fn } from 'storybook/test';
import Message from '../../../../src/components/common/Message/Message';
import Status from '../../../../src/components/common/Status/Status';
import styles from './Design.module.scss';

/**
 * A line or two about what's around it (`src/components/common/Message`): a note, an error, a warning, a success. Small,
 * in the easy-to-read font, in its tone's colour; an error is announced to screen readers as it appears. And `Status`
 * (`src/components/common/Status`), built on it: something loading, nothing to show yet, or a load that failed, with
 * Try again.
 */
export default {
  title: 'Design system/Messages',
  component: Message,
  parameters: { layout: 'centered' },
  argTypes: { tone: { control: 'inline-radio', options: ['note', 'error', 'warning', 'success', 'info'] } },
  args: { tone: 'note', boxed: false, children: 'Only you see your ratings. Everyone sees each game’s average.' },
};

export const Playground = {};

export const Tones = {
  render: () => (
    <div className={styles.column}>
      <Message>Only the developer reads it, and it’s deleted with your account.</Message>
      <Message tone="success" role="status">Saved.</Message>
      <Message tone="warning">You’re offline, and out of tickets for Snake.</Message>
      <Message tone="info">A new version is ready.</Message>
      <Message tone="error">Couldn’t save that. Check your connection and try again.</Message>
    </div>
  ),
};

/** Boxed: at the top of a window */
export const Boxed = {
  render: () => (
    <div className={styles.column}>
      <Message tone="error" boxed>Can’t reach the sign-in service right now.</Message>
      <Message tone="success" boxed role="status">Check your email! We sent a sign-in link.</Message>
    </div>
  ),
};

/** A link in it looks like a link in any text (a link with no class of its own) */
export const WithALink = {
  render: () => (
    <Message>
      Games you’ve played for a minute or more. Only you see them (<Link to="/settings">Settings → Privacy</Link>).
    </Message>
  ),
};

/** Status: loading (said politely to screen readers), nothing yet, and a failed load with Try again */
export const Statuses = {
  render: () => (
    <div className={styles.column}>
      <Status kind="loading" />
      <Status kind="empty">No friends yet. Add friends from their profiles.</Status>
      <Status kind="error" onRetry={fn()}>Couldn’t load the friends list.</Status>
    </div>
  ),
};
