import { useId, useState } from 'react';
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
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-describedby={noteId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span aria-hidden="true">ℹ</span>
      </button>
      <span id={noteId} role="tooltip" className={open ? styles.note : 'visually-hidden'}>{children}</span>
    </span>
  );
};

export default InfoTip;
