import { useId, useState } from 'react';
import Button from '../Button/Button';
import styles from './Disclosure.module.scss';

/**
 * A part of a card that a button opens and closes (Details' features, the players' ratings, the game's more numbers).
 * The hook keeps whether it's open, and wires the button to the part it opens (aria-expanded, aria-controls).
 * @param {boolean} [initiallyOpen]
 * @return {{ open: boolean, toggle: function, buttonProps: object, panelProps: object }} - buttonProps for the button
 *   (DisclosureButton, or any Button), panelProps for the Collapsible
 */
export const useDisclosure = (initiallyOpen = false) => {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  const toggle = () => setOpen((was) => !was);
  return {
    open,
    toggle,
    buttonProps: { 'aria-expanded': open, 'aria-controls': id, onClick: toggle },
    panelProps: { id, open },
  };
};

/**
 * The button that opens a Collapsible: a ▼ that turns to point up while it's open, in a round ghost Button. With a
 * label (children) the ▼ comes after it; alone, `label` names it (and is its tooltip).
 * Takes useDisclosure's buttonProps, and any Button prop.
 */
export const DisclosureButton = ({ children, ...rest }) => {
  const chevron = <span className={children ? styles.chevronSmall : styles.chevron}>▼</span>;
  return (
    <Button variant="ghost" shape="round" size="sm" {...(children ? { iconEnd: chevron } : { icon: chevron })} {...rest}>
      {children}
    </Button>
  );
};

/**
 * What a DisclosureButton opens: it grows to its own height as it fades in, and back. Closed, it takes no room (it
 * undoes the gap above it, `gap`, so the card's spacing stays even), and screen readers and the keyboard skip it.
 * Takes useDisclosure's panelProps.
 * @param {boolean} open
 * @param {'md'|'sm'|'none'} [gap] - the gap between it and what's above it, in its container
 */
export const Collapsible = ({ open, gap = 'md', className = '', children, ...rest }) => (
  <div className={[styles.collapsible, styles[`gap-${gap}`], open && styles.open, className].filter(Boolean).join(' ')} {...rest}>
    <div className={styles.inner}>{children}</div>
  </div>
);
