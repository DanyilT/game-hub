import { useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '../../../contexts/AuthContext';
import { USERNAME_COOLDOWN_DAYS, describeProfileError, hasChosenUsername } from '../../../lib/account';
import Modal from '../../common/Modal/Modal';
import UsernameField, { useUsernameCheck } from '../UsernameField/UsernameField';
import styles from '../AccountModal.module.scss';

// "Decide later" lasts until the tab is closed
const LATER_KEY = 'gamehub:username-later';
const readLater = () => {
  try {
    return sessionStorage.getItem(LATER_KEY);
  } catch {
    return null;
  }
};

/** Remembers "Decide later" for this player until the tab is closed */
export const rememberLater = (playerId) => {
  try {
    sessionStorage.setItem(LATER_KEY, playerId);
  } catch {
    // storage unavailable: it just asks again next time
  }
};

/**
 * Asks players who haven't picked a username yet (their username history is empty) to keep or
 * change the one they got at sign-up, on any page, unless they pick "Decide later". Right after
 * signing up, the sign-in page (pages/Account/AuthCallback) asks instead, then opens their profile.
 */
const UsernameDialog = () => {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const [, setLaterFor] = useState(null); // shows the change straight away (the choice is in storage)

  if (!profile || hasChosenUsername(profile) || pathname === '/auth/callback' || readLater() === profile.id) {
    return null;
  }

  const later = () => {
    rememberLater(profile.id);
    setLaterFor(profile.id);
  };

  return <WelcomeDialog profile={profile} onLater={later} />;
};

/**
 * The welcome window. Closes by saving (the name goes into the history, then `onDone` gets the
 * saved profile) or "Decide later" (also ×, Escape, a click outside).
 */
export const WelcomeDialog = ({ profile, onDone, onLater }) => {
  const { updateProfile } = useAuth();
  const inputRef = useRef(null);
  const [name, setName] = useState(profile.username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const status = useUsernameCheck(name, profile.username);
  const keeping = status === 'unchanged';

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let saved;
    try {
      // Keeping sends the same name back; either way it's recorded, and the 30-day wait starts
      saved = await updateProfile({ username: keeping ? profile.username : name });
    } catch (err) {
      setError(describeProfileError(err));
      setSaving(false);
      return;
    }
    onDone?.(saved);
  };

  const canSave = !saving && (keeping || status === 'available' || status === 'error');

  return (
    <Modal title="Welcome to GameHub!" onClose={onLater} initialFocusRef={inputRef}>
      <p className={styles.text}>
        Pick the username other players will see: keep the one you got, type your own, or roll the dice (Magicaze ✨).
      </p>
      {error && <div className={styles.error} role="alert">{error}</div>}

      <form onSubmit={save}>
        <div className={styles.formGroup}>
          <UsernameField id="welcome-username" value={name} onChange={setName} status={status} inputRef={inputRef} />
          <span className={styles.hint}>You can change it in Settings {USERNAME_COOLDOWN_DAYS} days after you pick or keep it.</span>
        </div>
        <button type="submit" className={styles.submit} disabled={!canSave}>
          {saving ? 'Saving…' : `${keeping ? 'Keep' : 'Use'} this name`}
        </button>
      </form>

      <div className={styles.switch}>
        <button type="button" className={styles.switchButton} onClick={onLater} disabled={saving}>Decide later</button>
      </div>
    </Modal>
  );
};

export default UsernameDialog;
