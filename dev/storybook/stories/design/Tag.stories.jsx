import { Fragment, useState } from 'react';
import { expect, fn } from 'storybook/test';
import Tag from '../../../../src/components/common/Tag/Tag';
import styles from './Design.module.scss';

const KINDS = ['tag', 'genre', 'easy', 'medium', 'hard', 'platform'];
const SAMPLES = { tag: 'retro', genre: 'Puzzle', easy: 'easy', medium: 'medium', hard: 'hard', platform: 'web' };

/**
 * A game's tag (`src/components/common/Tag`): its genre, difficulty or platform, each in its colour, or a plain tag.
 * Screen readers and the tooltip say which kind it is ("Genre: Puzzle"). With `onClick` it can be picked: a toggle
 * (`aria-pressed`), lifted on hover, and once picked still glass but lit up, with a pink edge.
 */
export default {
  title: 'Design system/Tag',
  component: Tag,
  parameters: { layout: 'centered' },
  argTypes: {
    kind: { control: 'select', options: KINDS },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    onClick: { control: false },
  },
  args: { kind: 'genre', size: 'sm', children: 'Puzzle' },
};

/** Just a label: a <span> */
export const Playground = {};

/** With `onClick`, a button: `selected` shows it picked */
export const Pickable = { args: { onClick: fn(), selected: false } };

/** Every kind, in both sizes: sm on the game cards and in the games list's filters, md on the game page */
export const Kinds = {
  render: () => (
    <div className={styles.table} style={{ '--columns': KINDS.length }}>
      {['sm', 'md'].map((size) => (
        <Fragment key={size}>
          <span className={styles.heading}>{size}</span>
          {KINDS.map((kind) => <Tag key={kind} kind={kind} size={size}>{SAMPLES[kind]}</Tag>)}
        </Fragment>
      ))}
    </div>
  ),
};

// Tags that can be picked, as on the game page
const PickableTags = () => {
  const [picked, setPicked] = useState(['retro']);
  const toggle = (tag) => setPicked((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  return (
    <div className={styles.row} role="group" aria-label="Pick tags">
      {KINDS.map((kind) => (
        <Tag key={kind} kind={kind} size="md" selected={picked.includes(SAMPLES[kind])} onClick={() => toggle(SAMPLES[kind])}>
          {SAMPLES[kind]}
        </Tag>
      ))}
    </div>
  );
};

/** Picked ones (the game cards', the games list's filters, the game page's) light up, with a pink edge */
export const Picking = {
  render: () => <PickableTags />,
  play: async ({ canvas, userEvent }) => {
    const genre = canvas.getByRole('button', { name: 'Genre: Puzzle' });
    await expect(genre).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(genre);
    await expect(genre).toHaveAttribute('aria-pressed', 'true');
  },
};

/** Over a game's picture, as on the game cards: blurred behind, so they read on any picture (two picked) */
export const OverAPicture = {
  render: () => (
    <div className={`${styles.picture} ${styles.row}`}>
      {KINDS.map((kind) => (
        <Tag key={kind} kind={kind} selected={kind === 'tag' || kind === 'genre'} onClick={fn()}>{SAMPLES[kind]}</Tag>
      ))}
    </div>
  ),
};
