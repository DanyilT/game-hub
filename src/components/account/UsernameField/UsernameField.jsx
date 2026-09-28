import { useEffect, useState } from 'react';
import { GiPerspectiveDiceSixFacesRandom } from "react-icons/gi";
import { useAuth } from '../../../contexts/AuthContext';
import { USERNAME_HINT, USERNAME_PATTERN, randomUsername } from '../../../lib/account';
import styles from './UsernameField.module.scss';

/**
 * Checks a username against the database while the player types (after a short pause).
 * @param {string} value - what's typed
 * @param {string} current - the player's current username
 * @return {'unchanged'|'invalid'|'checking'|'available'|'taken'|'error'}
 */
export const useUsernameCheck = (value, current) => {
  const { isUsernameAvailable } = useAuth();
  const [result, setResult] = useState({ value: null, status: null });
  const unchanged = value === current;
  const valid = USERNAME_PATTERN.test(value);

  useEffect(() => {
    if (unchanged || !valid) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      let status;
      try {
        status = (await isUsernameAvailable(value)) ? 'available' : 'taken';
      } catch {
        status = 'error';
      }
      if (active) setResult({ value, status });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, unchanged, valid, isUsernameAvailable]);

  if (unchanged) return 'unchanged';
  if (!valid) return 'invalid';
  return result.value === value ? result.status : 'checking';
};

/**
 * Username input with a die icon for a random fun name, and a live "is it free?" line underneath.
 * Typing is lowercased as you go, because usernames are lowercase.
 * @param {string} id - input id (the status line gets `${id}-status`)
 * @param {string} value - what's typed
 * @param {function} onChange - receives the new value
 * @param {string} status - from useUsernameCheck()
 */
const UsernameField = ({ id, label = 'Username', value, onChange, status, disabled = false, inputRef }) => {
  const messages = {
    unchanged: 'This is your username now.',
    invalid: value ? `Use ${USERNAME_HINT}.` : `Pick a username: ${USERNAME_HINT}.`,
    checking: 'Checking…',
    available: `@${value} is free.`,
    taken: `@${value} is taken or reserved.`,
    error: "Couldn't check that name right now. You can still try to save it.",
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.inputRow}>
        <div className={styles.inputWrap}>
          <span className={styles.at} aria-hidden="true">@</span>
          <input
            ref={inputRef}
            id={id}
            className={styles.input}
            value={value}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={disabled}
            aria-invalid={status === 'invalid' || status === 'taken'}
            aria-describedby={`${id}-status`}
          />
        </div>
        <button
          type="button"
          className={styles.generate}
          onClick={() => onChange(randomUsername())}
          disabled={disabled}
          title="Magicaze a random username"
          aria-label="Random username"
        >
          <GiPerspectiveDiceSixFacesRandom aria-hidden="true" />
        </button>
      </div>
      <p id={`${id}-status`} className={`${styles.status} ${styles[status] ?? ''}`} aria-live="polite">
        {!disabled && messages[status]}
      </p>
    </div>
  );
};

export default UsernameField;
