import { expect } from 'storybook/test';
import { Collapsible, DisclosureButton, useDisclosure } from '../../../../src/components/common/Disclosure/Disclosure';
import styles from './Design.module.scss';

/**
 * A part of a card that a button opens (`src/components/common/Disclosure`): `useDisclosure` keeps whether it's open
 * and wires the button to the part (aria-expanded, aria-controls); `DisclosureButton` is the ▼ that turns over;
 * `Collapsible` grows to its own height as it fades in, and takes no room once closed.
 */
export default {
  title: 'Design system/Disclosure',
  parameters: { layout: 'centered' },
};

const Details = () => {
  const features = useDisclosure();
  return (
    <section className={`${styles.card} ${styles.surface}`}>
      <div className={styles.row} style={{ justifyContent: 'space-between' }}>
        <h2>Details</h2>
        <DisclosureButton label={features.open ? 'Hide features' : 'Show features'} {...features.buttonProps} />
      </div>
      <p>Eat the fruit, grow longer, and don’t run into yourself.</p>
      <Collapsible {...features.panelProps}>
        <h3>Features</h3>
        <p>Endless, with your best score kept.</p>
      </Collapsible>
    </section>
  );
};

/** The ▼ alone, named for screen readers (label), in a card's header */
export const IconAlone = {
  render: () => <Details />,
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Show features' });
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toHaveAccessibleName('Hide features');
  },
};

const More = () => {
  const more = useDisclosure();
  return (
    <section className={`${styles.card} ${styles.surface}`}>
      <div className={styles.row} style={{ justifyContent: 'space-between' }}>
        <span>Score 12 · Best 40</span>
        <DisclosureButton font="secondary" {...more.buttonProps}>More</DisclosureButton>
      </div>
      <Collapsible {...more.panelProps}>
        <p>Played 54 min, 12 times.</p>
      </Collapsible>
    </section>
  );
};

/** With a word (children): the ▼ after it */
export const WithALabel = { render: () => <More /> };
