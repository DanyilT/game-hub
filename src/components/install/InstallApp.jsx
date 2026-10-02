import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { CiMenuKebab } from 'react-icons/ci';
import { IoShareOutline } from 'react-icons/io5';
import { PiX } from 'react-icons/pi';
import {
  bannerDue, canInstall, closeInstallSteps, getInstallState, install, installLater, subscribe,
} from '../../lib/install';
import Button from '../common/Button/Button';
import styles from './InstallApp.module.scss';

// Must match $breakpoint-mobile in styles/abstracts/_variables.scss
const PHONE_QUERY = '(width <= 768px)';

// Both float over the page at the bottom of the screen (styles.panel), and the page stays usable.

/** The install state from src/lib/install.js, kept up to date: { canPrompt, platform, installed, stepsOpen } */
export const useInstall = () => useSyncExternalStore(subscribe, getInstallState);

/**
 * Phones and tablets: how to install from the browser's own menu, when there's no install dialog
 * to open (Safari and Firefox never have one, Chrome not until the player has used the site a bit).
 * It takes the focus, since the player just asked for it, and gives it back when closed with
 * "Got it", × or Escape.
 */
export const InstallSteps = () => {
  const { platform } = useInstall();
  const okRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement;
    okRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeInstallSteps();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <section className={styles.panel} role="dialog" aria-labelledby={titleId}>
      <button type="button" className={styles.close} onClick={closeInstallSteps} aria-label="Close"><PiX aria-hidden="true" /></button>
      <h2 id={titleId} className={styles.title}>Install GameHub</h2>
      <p className={styles.text}>Add GameHub to your home screen, and it opens full screen, like an app:</p>
      {platform === 'ios' ? (
        <ol className={styles.steps}>
          <li>
            Tap <strong>Share</strong> <IoShareOutline className={styles.icon} aria-hidden="true" /> in the
            browser's toolbar (in Safari it may be under the <strong>···</strong> button).
          </li>
          <li>Choose <strong>Add to Home Screen</strong>. Scroll down the list if it isn't there.</li>
          <li>Tap <strong>Add</strong>.</li>
        </ol>
      ) : (
        <ol className={styles.steps}>
          <li>
            Open the browser's menu: tap <CiMenuKebab className={styles.icon} aria-hidden="true" /> at the top
            or bottom right.
          </li>
          <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>. If it asks, choose <strong>Install</strong>.</li>
          <li>Confirm with <strong>Install</strong> or <strong>Add</strong>.</li>
        </ol>
      )}
      {/* An installed app on iOS doesn't share Safari's storage */}
      {platform === 'ios' && <p className={styles.text}>The app keeps a sign-in of its own, so sign in once more there.</p>}
      <Button ref={okRef} onClick={closeInstallSteps}>Got it</Button>
    </section>
  );
};

/**
 * The suggestion on the games page, on phones, once the player has opened a game or two. Both
 * buttons hold it back for a month (installLater): "Not now", and "Install", which opens the
 * browser's dialog or the steps (in its place).
 */
export const InstallBanner = () => {
  const installState = useInstall();
  const [hidden, setHidden] = useState(false);

  if (hidden || installState.stepsOpen || !canInstall(installState) || !window.matchMedia(PHONE_QUERY).matches
    || !bannerDue()) return null;

  const later = () => {
    installLater();
    setHidden(true);
  };

  return (
    <aside className={styles.panel} aria-label="Install the app">
      <p className={styles.bannerText}>Play from your home screen: install GameHub as an app.</p>
      <div className={styles.actions}>
        <Button variant="outline" onClick={later}>Not now</Button>
        <Button
          onClick={() => {
            later();
            install();
          }}
        >
          Install
        </Button>
      </div>
    </aside>
  );
};
