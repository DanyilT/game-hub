import { useSyncExternalStore } from 'react';
import { PiX } from 'react-icons/pi';
import { dismissToast, getToasts, subscribeToasts } from '../../../lib/toast';
import Button from '../Button/Button';
import styles from './Toasts.module.scss';

/** The messages from showToast (src/lib/toast.js), at the bottom of the screen. MainLayout renders it once. */
const Toasts = () => {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  return (
    // Always in the page, so screen readers announce what's added to it
    <div className={styles.toasts} role="status" aria-live="polite">
      {toasts.map(({ id, text, tone, action }) => (
        <div key={id} className={`${styles.toast} ${styles[tone] ?? ''}`}>
          <p className={styles.text}>{text}</p>
          {action && (
            <Button
              variant="outline"
              size="sm"
              font="secondary"
              onClick={() => {
                action.onClick?.();
                dismissToast(id);
              }}
            >
              {action.label}
            </Button>
          )}
          <Button variant="ghost" tone="neutral" size="sm" icon={PiX} label="Close" title="" onClick={() => dismissToast(id)} />
        </div>
      ))}
    </div>
  );
};

export default Toasts;
