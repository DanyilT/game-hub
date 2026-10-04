import { useEffect, useState } from 'react';
import { fn } from 'storybook/test';
import Button from '../../../../src/components/common/Button/Button';
import Modal from '../../../../src/components/common/Modal/Modal';
import { askToConfirm } from '../../../../src/lib/confirm';

/** The neon window (a native modal dialog): Escape, the × and a click outside close it */
export default {
  title: 'Common/Window',
  component: Modal,
  args: { title: 'A window', onClose: fn() },
};

export const Window = {
  render: (args) => (
    <Modal {...args}>
      <p>Anything can go in it: text, a form, buttons.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="outline" onClick={args.onClose}>Cancel</Button>
        <Button onClick={args.onClose}>OK</Button>
      </div>
    </Modal>
  ),
};

// Asks the question as the site does (src/lib/confirm.js); the decorator draws ConfirmDialog
const AskQuestion = ({ title, message, confirmLabel, danger }) => {
  const [answer, setAnswer] = useState(null);
  useEffect(() => {
    let active = true;
    askToConfirm({ title, message, confirmLabel, danger }).then((yes) => active && setAnswer(yes));
    return () => {
      active = false;
    };
  }, [title, message, confirmLabel, danger]);
  return <p style={{ padding: 24 }}>{answer === null ? 'Waiting for an answer…' : `Answered: ${answer ? 'yes' : 'no'}`}</p>;
};

/** A question before something happens (askToConfirm): the site's own window, not the browser's confirm() */
export const Question = {
  render: (args) => <AskQuestion {...args} />,
  args: {
    title: 'Sign out?',
    message: 'You’ll be signed out of GameHub on this device. Your progress stays in your account.',
    confirmLabel: 'Sign out',
    danger: true,
  },
};
