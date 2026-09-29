import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { FcGoogle } from 'react-icons/fc';
import { FaDiscord } from 'react-icons/fa6';
import { useAuth } from '../../../contexts/AuthContext';
import { LOCAL_EMAILS_URL, fetchAuthSettings, isLocalSupabase } from '../../../lib/supabase';
import { safeReturnPath } from '../../../lib/account';
import Modal from '../../common/Modal/Modal';
import styles from '../AccountModal.module.scss';

// `soon`: shown greyed out with a "soon" badge, like the email link. Discord's app isn't set up
// yet; drop its `soon` once it is, and add it to /privacy and /terms.
const PROVIDERS = [
  { id: 'google', name: 'Google', icon: FcGoogle },
  { id: 'discord', name: 'Discord', icon: FaDiscord, soon: true },
];
const LIVE_PROVIDERS = PROVIDERS.filter((provider) => !provider.soon);
const liveNames = (separator) => LIVE_PROVIDERS.map(({ name }) => name).join(separator);

/**
 * The sign-in window: Google, plus Discord and an email link that say "soon" on the real site.
 * (The email link works with the local Supabase from `npm run dev:local`, for testing: its emails
 * never leave your machine.) Signing in comes back to the page it was opened on.
 */
const SignInModal = () => {
  const { closeSignIn, signInWith, sendSignInLink } = useAuth();
  const location = useLocation();
  const returnTo = safeReturnPath(`${location.pathname}${location.search}${location.hash}`) ?? '/';
  // Providers switched on in Supabase: null while checking, false if Supabase can't be reached
  const [enabled, setEnabled] = useState(null);
  const [busy, setBusy] = useState(null); // 'google' | 'discord' | 'email'
  const [error, setError] = useState(null);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const emailRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchAuthSettings()
      .then((settings) => {
        if (active) setEnabled(settings.external ?? {});
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (emailMode) emailRef.current?.focus();
  }, [emailMode]);

  const start = async (provider) => {
    setBusy(provider);
    setError(null);
    try {
      await signInWith(provider, returnTo);
      // The browser is now leaving for Google / Discord
    } catch {
      setError("Couldn't start signing in. Try again in a moment.");
      setBusy(null);
    }
  };

  const sendLink = async (e) => {
    e.preventDefault();
    setBusy('email');
    setError(null);
    try {
      await sendSignInLink(email.trim(), returnTo);
      setSentTo(email.trim());
    } catch (err) {
      setError(/rate limit|security purposes/i.test(err?.message ?? '')
        ? 'Too many emails for now. Wait a minute and try again.'
        : "Couldn't send the email. Check the address and try again.");
    }
    setBusy(null);
  };

  const emailWorks = isLocalSupabase && Boolean(enabled?.email);
  const providersOff = enabled && LIVE_PROVIDERS.every(({ id }) => !enabled[id]);

  return (
    <Modal title={emailMode ? 'Sign in with email' : 'Sign in'} onClose={closeSignIn}>
      {enabled === false && (
        <div className={styles.error} role="alert">Can't reach the sign-in service right now. Try again in a minute.</div>
      )}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {sentTo && (
        <div className={styles.success} role="status">
          Check your email! We sent a sign-in link to {sentTo}. Open it in this browser.
        </div>
      )}

      {emailMode ? (
        <>
          {!sentTo && (
            <form onSubmit={sendLink}>
              <div className={styles.formGroup}>
                <label htmlFor="sign-in-email" className={styles.label}>Email</label>
                <input
                  ref={emailRef}
                  id="sign-in-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="your@email.com"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {isLocalSupabase && (
                  <span className={styles.hint}>
                    Local testing: the email lands at{' '}
                    <a href={LOCAL_EMAILS_URL} target="_blank" rel="noopener noreferrer">{LOCAL_EMAILS_URL.replace('http://', '')}</a>
                  </span>
                )}
              </div>
              <button type="submit" className={styles.submit} disabled={Boolean(busy)}>
                {busy === 'email' ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>
          )}
          {sentTo && isLocalSupabase && (
            <p className={styles.text}>
              Local testing: open{' '}
              <a href={LOCAL_EMAILS_URL} target="_blank" rel="noopener noreferrer" className={styles.switchButton}>
                {LOCAL_EMAILS_URL.replace('http://', '')}
              </a>
              {' '}and click the link in the email.
            </p>
          )}
          <div className={styles.switch}>
            <button type="button" className={styles.switchButton} onClick={() => { setEmailMode(false); setSentTo(null); }}>
              Back to {liveNames(' / ')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.providers}>
            {PROVIDERS.map(({ id, name, icon: Icon, soon }) => (
              <button
                key={id}
                type="button"
                className={`${styles.submit} ${soon ? styles.soon : ''}`}
                onClick={() => start(id)}
                disabled={soon || Boolean(busy) || enabled === false || Boolean(enabled && !enabled[id])}
              >
                <Icon className={`${styles.providerIcon}`} aria-hidden="true" />
                <span className={styles.providerLabel}>{busy === id ? `Opening ${name}…` : `Continue with ${name}`}</span>
                {soon && <span className={styles.soonBadge}><span className="visually-hidden">: coming </span>soon</span>}
              </button>
            ))}
          </div>
          {providersOff && (
            <span className={styles.hint}>
              {isLocalSupabase
                ? `${liveNames(' and ')} sign-in isn't set up in the local Supabase: use the email link below.`
                : `${liveNames(' and ')} sign-in isn't switched on yet.`}
            </span>
          )}

          <div className={styles.divider}><span>or</span></div>

          {/* The real site needs a domain of its own to send email from */}
          <button type="button" className={styles.alt} onClick={() => setEmailMode(true)} disabled={!emailWorks}>
            <span className={styles.altLabel}>✉ Sign in with email link (passwordless)</span>
            {!emailWorks && <span className={styles.soonBadge}><span className="visually-hidden">: coming </span>soon</span>}
          </button>

          <p className={styles.finePrint}>
            {liveNames(' or ')} tells GameHub your name, email address and profile picture. Other players never see
            your email. By signing in you agree to the <Link to="/terms" onClick={closeSignIn}>Terms</Link> and
            the <Link to="/privacy" onClick={closeSignIn}>Privacy Policy</Link>.
          </p>
        </>
      )}
    </Modal>
  );
};

export default SignInModal;
