import { useState } from 'react';
import { expect } from 'storybook/test';
import Button from '../../../../src/components/common/Button/Button';
import InfoTip from '../../../../src/components/common/InfoTip/InfoTip';
import Popover from '../../../../src/components/common/Popover/Popover';
import styles from './Design.module.scss';

/**
 * A small box under what opened it (`src/components/common/Popover`): the ⓘ notes, menus, the style details. It lines
 * up with its opener's left edge (start) or right edge (end), and moves sideways just enough to stay in the window.
 */
export default {
  title: 'Design system/Popover',
  component: Popover,
  parameters: { layout: 'padded' },
};

const Opener = ({ align, label, style }) => {
  const [open, setOpen] = useState(true);
  return (
    <span className={styles.popoverAnchor} style={style}>
      <Button variant="outline" size="sm" font="secondary" aria-expanded={open} onClick={() => setOpen((was) => !was)}>{label}</Button>
      <Popover open={open} align={align}>
        <p className={styles.note}>Neon on black, pixel letters, and a little bounce.</p>
      </Popover>
    </span>
  );
};

/** Lined up with the left edge (start) or the right edge (end) of what opened it */
export const Alignments = {
  render: () => (
    <div className={styles.row} style={{ justifyContent: 'space-around', paddingBottom: 140 }}>
      <Opener align="start" label="Start" />
      <Opener align="end" label="End" />
    </div>
  ),
};

/** At the window's right edge: an ⓘ note opening to the right moves left, to stay in view */
export const AtTheEdge = {
  render: () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 160 }}>
      <span className={styles.row}>
        Your rating <InfoTip label="About your rating">Slide to change it. Only you see your rating.</InfoTip>
      </span>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole('button', { name: 'About your rating' }));
    const note = canvas.getByRole('tooltip');
    await expect(note.getBoundingClientRect().right).toBeLessThanOrEqual(document.documentElement.clientWidth);
  },
};
