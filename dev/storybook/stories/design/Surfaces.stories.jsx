import { PiX } from 'react-icons/pi';
import Button from '../../../../src/components/common/Button/Button';
import Popover from '../../../../src/components/common/Popover/Popover';
import styles from './Design.module.scss';

/**
 * What content sits on (`src/styles/abstracts/_surfaces.scss`): one look for each, the same everywhere. They're Sass
 * mixins for a page's own styles: `@use '…/styles/abstracts/surfaces';`, then `@include surfaces.card;`. Each sets the
 * box's look and padding; where it goes is up to the page. The cards also lay out what's in them one under another
 * (`$stack: false` leaves that to the page).
 */
export default {
  title: 'Design system/Surfaces',
  parameters: { layout: 'centered' },
};

/** **card**: a block of content on the game page, filled and rounded (its info cards, the panel under the game). Only there. */
export const Card = {
  render: () => (
    <section className={`${styles.card} ${styles.surface}`}>
      <h2>Details</h2>
      <p>Eat the fruit, grow longer, and don&rsquo;t run into yourself.</p>
      <Button variant="dashed" shape="rounded" block>View style details</Button>
    </section>
  ),
};

/**
 * **card-outlined**: a block anywhere else, with no fill, the brand's edge and square corners (the account pages, the
 * legal pages, the error page). **outlined** is that look alone, for a small box with padding of its own (the games
 * page's recent activity).
 */
export const CardOutlined = {
  render: () => (
    <section className={`${styles.cardOutlined} ${styles.surface}`}>
      <h2>Your play history</h2>
      <p className={styles.note}>What you played and when. Only you see it, unless you share it.</p>
      <div className={styles.row}>
        <Button variant="outline" tone="danger">Delete history</Button>
      </div>
    </section>
  ),
};

/** **panel**: frosted, over the page's background (the games list's filters) */
export const Panel = {
  render: () => (
    <div className={`${styles.panel} ${styles.surface}`}>
      <p className={styles.note}>Filters, sorting and search sit on a panel.</p>
    </div>
  ),
};

/** **window**: the neon window, over everything (dialogs, the messages at the bottom of the screen, installing the app) */
export const Window = {
  render: () => (
    <div className={`${styles.window} ${styles.surface}`} role="dialog" aria-label="Remove download?">
      <div className={styles.row} style={{ justifyContent: 'space-between' }}>
        <h2>Remove download?</h2>
        <Button variant="outline" size="sm" icon={PiX} label="Close" title="" />
      </div>
      <p className={styles.note}>Snake won&rsquo;t play offline any more. Your progress stays.</p>
      <div className={styles.row} style={{ justifyContent: 'flex-end' }}>
        <Button variant="outline">Cancel</Button>
        <Button tone="danger">Remove</Button>
      </div>
    </div>
  ),
};

/** **popup**: a small box under the button that opened it (the ⓘ notes, menus): the Popover component's look */
export const Popup = {
  render: () => (
    <div className={styles.popoverAnchor} style={{ marginBottom: 160 }}>
      <Button variant="outline" aria-expanded="true">Style details</Button>
      <Popover open>
        <p className={styles.note}>Neon on black, pixel letters, and a little bounce.</p>
      </Popover>
    </div>
  ),
};

/** All of them, side by side */
export const Together = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className={styles.surfaces}>
      {Card.render()}
      {CardOutlined.render()}
      {Panel.render()}
      {Window.render()}
    </div>
  ),
};
