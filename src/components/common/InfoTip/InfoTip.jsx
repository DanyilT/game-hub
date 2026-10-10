import { useId, useState } from 'react';
import Button from '../Button/Button';
import Popover from '../Popover/Popover';
import styles from './InfoTip.module.scss';

/**
 * A small ℹ button that shows a note while it's hovered or focused. Screen readers get the note
 * as the button's description.
 * @param {string} label - the button's name, e.g. "How the controls work"
 * @param {React.ReactNode} children - the note
 */
const InfoTip = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  return (
    <span className={styles.infoTip}>
      <Button
        size="xs"
        shape="round"
        icon={<span className={styles.glyph}>ℹ</span>}
        label={label}
        title=""
        aria-describedby={noteId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {/* Opens to the right of the button (or as far left as it takes to stay in the window) */}
      <Popover open={open} keepMounted as="span" id={noteId} role="tooltip" className={styles.note}>{children}</Popover>
    </span>
  );
};

export default InfoTip;
