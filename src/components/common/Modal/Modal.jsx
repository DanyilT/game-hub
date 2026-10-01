import { useId, useLayoutEffect, useRef } from 'react';
import { PiX } from 'react-icons/pi';
import styles from './Modal.module.scss';

/**
 * A modal window in the site's neon style. Mounted = open:
 * render it only while it should show. Escape, the ×, and a click outside all call `onClose`.
 * It's a native modal <dialog>, so focus stays inside and the page behind can't be used.
 * @param {string} title - heading
 * @param {function} onClose - asked to close
 * @param {object} initialFocusRef - optional element to focus on open (default: the first control)
 */
const Modal = ({ title, onClose, initialFocusRef, children }) => {
  const dialogRef = useRef(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    initialFocusRef?.current?.focus();
    // Closing before it's removed hands focus back to where it was
    return () => dialog.close();
  }, [initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Browsers may close it on Escape without a cancellable `cancel` (before the player has
      // interacted with the page); stay in step. It's open again only after the dev-mode remount.
      onClose={() => {
        if (!dialogRef.current?.open) onClose();
      }}
      // The content fills the dialog, so a click on the dialog itself is on the dimmed backdrop
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.content}>
        {/* An icon, not the × character: Doto draws that off-centre */}
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close"><PiX aria-hidden="true" /></button>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
};

export default Modal;
