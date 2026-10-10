import { useState } from 'react';
import { GiPerspectiveDiceSixFacesRandom } from 'react-icons/gi';
import { expect, fn } from 'storybook/test';
import Button from '../../../../src/components/common/Button/Button';
import { Checkbox, RadioGroup, Select, Switch, TextArea, TextField } from '../../../../src/components/common/Field/Field';
import InfoTip from '../../../../src/components/common/InfoTip/InfoTip';
import styles from './Design.module.scss';

/**
 * The form fields (`src/components/common/Field`): a text field, a text box, a list to pick from, a checkbox, a switch
 * and a set of choices. Each ties its label, hint and error to its control (ids, aria-describedby, aria-invalid), so
 * screen readers hear them together; everything else (value, onChange, placeholder, ref…) goes to the control itself.
 */
export default {
  title: 'Design system/Fields',
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className={styles.form}><Story /></div>],
};

/** A one-line field: its label above, a hint under it */
export const Text = {
  render: () => <TextField label="Display name" placeholder="dany" hint="Shown on your profile instead of your username." />,
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Display name');
    await expect(input).toHaveAccessibleDescription('Shown on your profile instead of your username.');
  },
};

/** With an error: under it in red, announced, and the field is marked invalid */
export const WithError = {
  render: () => <TextField label="Email" type="email" defaultValue="dany@" error="That doesn’t look like an email address." />,
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  },
};

/** A sign at its start (prefix), a button beside it (after), and a hint that changes as you type (live, in a tone) */
export const PrefixAndButton = {
  render: () => {
    const [name, setName] = useState('panda');
    return (
      <TextField
        label="Username"
        prefix="@"
        value={name}
        onChange={(e) => setName(e.target.value.toLowerCase())}
        hint={`@${name} is free.`}
        hintTone="success"
        live
        after={<Button variant="outline" icon={GiPerspectiveDiceSixFacesRandom} label="Random username" onClick={() => setName('salty_yeti7')} />}
      />
    );
  },
};

/** A search box: its label for screen readers only (hideLabel), its placeholder says what it's for */
export const HiddenLabel = {
  render: () => <TextField type="search" label="Search players by name" hideLabel placeholder="Search by name" />,
};

export const Box = {
  render: () => <TextArea label="What went wrong?" placeholder="What happened, and what were you doing just before?" />,
};

export const PickFromAList = {
  render: () => (
    <Select label="Which game?" defaultValue="">
      <option value="">Not sure, or more than one</option>
      <option value="snake">Snake</option>
      <option value="tetris">Tetris</option>
    </Select>
  ),
};

/** A checkbox: a sentence to tick. A switch: a setting that's on or off, named like a field, with what it does under it. */
export const CheckboxAndSwitch = {
  render: () => {
    const [on, setOn] = useState(true);
    return (
      <>
        <Checkbox label="Include my browser’s name and version (it helps find the bug)" defaultChecked />
        <Switch
          label="Keep a history of what I play"
          hint={on ? 'Which games you play, when, and for how long.' : 'Nothing is recorded while you play.'}
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
      </>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole('switch', { name: 'Keep a history of what I play' });
    await userEvent.click(toggle);
    await expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    await expect(toggle).toBeChecked();
  },
};

const REASONS = [
  { value: 'cheating', label: 'Cheating', hint: 'A record or score that can’t be real.' },
  { value: 'name', label: 'Their name or picture', hint: 'Rude, hateful, or pretending to be someone.' },
  { value: 'other', label: 'Something else', hint: 'Tell us what happened.' },
];

// A RadioGroup that keeps its own choice
const Choices = (props) => {
  const [value, setValue] = useState(props.start ?? null);
  return <RadioGroup {...props} value={value} onChange={(next) => { setValue(next); props.onChange?.(next); }} />;
};

/** Choices as a list: a row each, the radio then its label and hint */
export const ChoicesList = { render: () => <Choices label="What’s wrong?" options={REASONS} onChange={fn()} /> };

/** Choices as cards, each with a picture */
export const ChoicesCards = {
  render: () => (
    <Choices
      variant="cards"
      label="Navigation"
      start="sidebar"
      options={[
        { value: 'sidebar', label: 'Sidebar', hint: 'A bar down the side of the page.', picture: <span className={styles.picture} style={{ width: 48, height: 32, padding: 0 }} /> },
        { value: 'floating', label: 'Floating button', hint: 'A round button in a corner.', picture: <span className={styles.picture} style={{ width: 48, height: 32, padding: 0 }} /> },
      ]}
    />
  ),
};

const AUDIENCES = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
  { value: 'nobody', label: 'Only me' },
];

/**
 * Choices side by side in one box (segmented): who sees what, the replay's speed, a list's order. `inline` puts the
 * name beside them; `info` adds an ⓘ after the name (outside it, so it isn't read as part of the name). Its corners
 * are rounded, or square (`shape="square"`: Settings, among square cards).
 */
export const ChoicesSegmented = {
  render: () => (
    <>
      <Choices
        variant="segmented"
        shape="square"
        inline
        label="Recent activity"
        info={<InfoTip label="Who sees your recent activity">Your plays in the recent activity on the games page.</InfoTip>}
        options={AUDIENCES}
        start="friends"
      />
      <Choices variant="segmented" label="Speed" hideLabel options={[1, 2, 4].map((s) => ({ value: s, label: `${s}×` }))} start={1} />
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    const everyone = canvas.getByRole('radio', { name: 'Everyone' });
    await userEvent.click(everyone);
    await expect(everyone).toBeChecked();
    await expect(canvas.getByRole('radiogroup', { name: 'Recent activity' })).toBeInTheDocument();
  },
};
