import { Fragment, useState } from 'react';
import { CiMaximize2 } from 'react-icons/ci';
import {
  PiArrowCounterClockwise, PiBookmarkSimple, PiDotsThreeVertical, PiDownloadSimple, PiGithubLogo, PiHeart, PiPlayFill,
  PiTrash, PiX,
} from 'react-icons/pi';
import { expect, fn } from 'storybook/test';
import Button from '../../../../src/components/common/Button/Button';
import styles from './Design.module.scss';

const VARIANTS = ['filled', 'outline', 'dashed', 'soft', 'glass', 'ghost', 'text'];
const TONES = ['primary', 'secondary', 'accent', 'danger', 'success', 'info', 'neutral'];
const SIZES = ['xs', 'sm', 'md', 'lg'];
const ICONS = { none: undefined, play: PiPlayFill, heart: PiHeart, bookmark: PiBookmarkSimple, trash: PiTrash, close: PiX };

// Glass is see-through, made to sit on a picture: it's shown on one
const Swatch = ({ variant, children }) => (variant === 'glass' ? <span className={styles.onPicture}>{children}</span> : children);

/**
 * The site's one button (`src/components/common/Button`): every action, and every link that looks like a button.
 * How it looks is set by `variant`, `tone`, `size`, `shape` and `font`. What it does is an action (a `<button>`),
 * `to` a page of the site, `href` another site, or `as` another element.
 *
 * A page's own class on it (`className`) wins over its styles: they sit in the `components` cascade layer. That's for
 * where it goes (margins, position), not for a look of its own.
 */
export default {
  title: 'Design system/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'inline-radio', options: VARIANTS },
    tone: { control: 'select', options: TONES },
    size: { control: 'inline-radio', options: SIZES },
    shape: { control: 'inline-radio', options: ['auto', 'square', 'rounded', 'round'], mapping: { auto: undefined } },
    font: { control: 'inline-radio', options: ['inherit', 'primary', 'secondary'], mapping: { inherit: undefined } },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
    iconEnd: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
    to: { control: false },
    href: { control: false },
    as: { control: false },
  },
  args: {
    children: 'Play',
    variant: 'filled',
    tone: 'primary',
    size: 'md',
    shape: 'auto',
    font: 'inherit',
    icon: 'none',
    iconEnd: 'none',
    block: false,
    active: false,
    disabled: false,
    onClick: fn(),
  },
};

/** Every option, in the controls */
export const Playground = {};

/**
 * Each variant in each tone:
 * - **filled**: the main action;
 * - **outline**: the others, with the icon in the button's colour;
 * - **dashed**: a thin dashed edge, quieter than an outline (the game page's style details);
 * - **soft**: a quiet pill that takes its colour on hover (the game page's favorite and bookmark);
 * - **glass**: see-through, over a picture (the game cards);
 * - **ghost**: no box until hovered (icons in a bar or a window, a menu's items);
 * - **text**: a link ("Decide later").
 *
 * The tones are the site's purple (primary), pink (secondary) and spring green (accent), red for deleting and removing
 * (danger), green (success), blue (info), and grey (neutral).
 */
export const VariantsAndTones = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className={styles.table} style={{ '--columns': TONES.length }}>
      <span />
      {TONES.map((tone) => <span key={tone} className={styles.heading}>{tone}</span>)}
      {VARIANTS.map((variant) => (
        <Fragment key={variant}>
          <span className={styles.heading}>{variant}</span>
          {TONES.map((tone) => (
            <Swatch key={tone} variant={variant}>
              <Button variant={variant} tone={tone}>{tone === 'danger' ? 'Delete' : 'Play'}</Button>
            </Swatch>
          ))}
        </Fragment>
      ))}
    </div>
  ),
};

/**
 * Four sizes: **xs** only for a small mark beside a heading (the ⓘ notes), **sm** in toolbars and lists, **md** most
 * places, **lg** for a window's or a page's main action. An icon alone sits in a square the button's height.
 */
export const Sizes = {
  render: () => (
    <div className={styles.table} style={{ '--columns': 4 }}>
      {SIZES.map((size) => (
        <Fragment key={size}>
          <span className={styles.heading}>{size}</span>
          <Button size={size}>Play</Button>
          <Button size={size} variant="outline" icon={PiArrowCounterClockwise}>Again</Button>
          <Button size={size} variant="outline" icon={CiMaximize2} label="Fullscreen" />
          <Button size={size} variant="soft" shape="round" icon={PiPlayFill} label="Play" />
        </Fragment>
      ))}
    </div>
  ),
};

/**
 * Square corners are the site's neon look; rounded, the softer corners of the first GameHub; round makes a pill, or a
 * circle around an icon alone. Unset, a button in the secondary font is rounded, and any other square.
 */
export const Shapes = {
  render: () => (
    <div className={styles.table} style={{ '--columns': 4 }}>
      {['square', 'rounded', 'round'].map((shape) => (
        <Fragment key={shape}>
          <span className={styles.heading}>{shape}</span>
          <Button shape={shape}>Play</Button>
          <Button shape={shape} variant="outline">Cancel</Button>
          <Button shape={shape} variant="soft" tone="secondary" icon={PiHeart}>12</Button>
          <Button shape={shape} variant="outline" icon={PiX} label="Close" />
        </Fragment>
      ))}
    </div>
  ),
};

/**
 * Doto (primary) for titles and big actions; Chakra Petch (secondary) where small text has to be read, with rounded
 * corners unless `shape` says otherwise. Unset, it's the text around it.
 */
export const Fonts = {
  render: () => (
    <div className={styles.column}>
      <div className={styles.row}>
        <Button font="primary">Doto</Button>
        <Button font="secondary">Chakra Petch</Button>
        <Button variant="outline" size="sm" font="secondary">Genres</Button>
      </div>
      <p className={styles.note}>
        Unset, it takes the font around it: <Button variant="text">like this link</Button>.
      </p>
    </div>
  ),
};

/** An icon alone: `label` names it for screen readers and is its tooltip, unless `title` gives another (or none: `title=""`). */
export const IconOnly = {
  render: () => (
    <div className={styles.row}>
      <Button icon={PiPlayFill} label="Play" />
      <Button variant="outline" icon={CiMaximize2} label="Fullscreen" />
      <Button variant="soft" tone="secondary" shape="round" icon={PiHeart} label="Favorite" />
      <Swatch variant="glass">
        <Button variant="glass" tone="success" shape="round" icon={PiPlayFill} label="Snake: Play" title="Play" />
      </Swatch>
      <Button variant="outline" icon={PiDotsThreeVertical} label="More for Taco Tim" />
      <Button variant="ghost" tone="neutral" icon={PiX} label="Close" title="" />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Fullscreen' })).toHaveAttribute('title', 'Fullscreen');
    await expect(canvas.getByRole('button', { name: 'Snake: Play' })).toHaveAttribute('title', 'Play');
    await expect(canvas.getByRole('button', { name: 'Close' })).toHaveAttribute('title', '');
  },
};

// A toggle that keeps its own state
const Toggle = ({ startOn = false, ...props }) => {
  const [on, setOn] = useState(startOn);
  return <Button {...props} aria-pressed={on} onClick={() => setOn((value) => !value)} />;
};

/** A toggle: `aria-pressed` shows it on, in every variant. (`active` shows a button as on without it being a toggle.) */
export const Toggles = {
  render: () => (
    <div className={styles.table} style={{ '--columns': 2 }}>
      <span />
      <span className={styles.heading}>off</span>
      <span className={styles.heading}>on</span>
      {VARIANTS.map((variant) => (
        <Fragment key={variant}>
          <span className={styles.heading}>{variant}</span>
          <Swatch variant={variant}><Toggle variant={variant} icon={PiBookmarkSimple}>Bookmark</Toggle></Swatch>
          <Swatch variant={variant}><Toggle variant={variant} icon={PiBookmarkSimple} startOn>Bookmark</Toggle></Swatch>
        </Fragment>
      ))}
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const [first] = canvas.getAllByRole('button', { name: 'Bookmark', pressed: false });
    await userEvent.click(first);
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(first);
    await expect(first).toHaveAttribute('aria-pressed', 'false');
  },
};

/**
 * - **disabled**: it can't be used;
 * - **busy** (`aria-disabled`): it keeps the keyboard focus, ignores clicks, and doesn't react to the pointer;
 * - **active**: shown as on;
 * - **open** (`aria-expanded`): what it opens is open (a menu, a list).
 */
export const States = {
  render: () => (
    <div className={styles.row}>
      <Button disabled>Disabled</Button>
      <Button variant="outline" disabled>Disabled</Button>
      <Button aria-disabled="true" aria-busy="true">Saving…</Button>
      <Button variant="outline" active>Shown as on</Button>
      <Button variant="outline" icon={PiDotsThreeVertical} label="More" aria-expanded="true" />
    </div>
  ),
};

/**
 * What it does:
 * - an action, the default (a `<button type="button">`, or `type="submit"` in a form);
 * - `to` a page of the site (React Router's Link);
 * - `href` another site, in a new tab, which screen readers hear (`arrow` also shows ↗);
 * - `as` any other element, like the `<label>` of a file input.
 */
export const Links = {
  render: () => (
    <div className={styles.row}>
      <Button onClick={fn()}>An action</Button>
      <Button to="/settings" variant="outline">A page of the site</Button>
      <Button href="https://github.com/DanyilT" variant="outline" icon={PiGithubLogo} arrow>Another site</Button>
      <Button as="label" variant="soft" icon={PiDownloadSimple}>
        Pick a file
        <input type="file" className="visually-hidden" />
      </Button>
    </div>
  ),
  play: async ({ canvas }) => {
    const out = canvas.getByRole('link', { name: /Another site/ });
    await expect(out).toHaveAttribute('target', '_blank');
    await expect(out).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(out).toHaveAccessibleName(/opens in a new tab/);
    await expect(canvas.getByRole('link', { name: 'A page of the site' })).toHaveAttribute('href', '/settings');
  },
};

/** Text links that are buttons: "Decide later" under a window's main action, and one in a sentence */
export const TextLinks = {
  render: () => (
    <div className={styles.column}>
      <Button size="lg" block>Save username</Button>
      <Button variant="text" size="sm">Decide later</Button>
      <p className={styles.note}>
        You&rsquo;re back online. <Button variant="text">Reload the game</Button> to send the progress you made offline.
      </p>
    </div>
  ),
};

/** As wide as its container (`block`): the sign-in window's buttons, and the help window's rows */
export const Block = {
  render: () => (
    <div className={styles.column}>
      <Button size="lg" block>Continue with Google</Button>
      <Button variant="outline" tone="accent" block>Continue with email</Button>
      <Button variant="outline" block icon={PiGithubLogo} arrow style={{ justifyContent: 'flex-start' }} href="https://github.com/DanyilT">
        Report a bug on GitHub
      </Button>
      <Button variant="outline" tone="danger" block icon={PiArrowCounterClockwise} style={{ justifyContent: 'flex-start' }}>
        Reset progress…
      </Button>
    </div>
  ),
};

/** Side by side, as the site lays out a window's actions: the main one last */
export const Together = {
  render: () => (
    <div className={styles.row}>
      <Button variant="outline">Cancel</Button>
      <Button tone="danger" icon={PiTrash}>Delete</Button>
      <Button>Save</Button>
    </div>
  ),
};
