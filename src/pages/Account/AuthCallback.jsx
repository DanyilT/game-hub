import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { hasChosenUsername, takeReturnPath } from '../../lib/account';
import { WelcomeDialog, rememberLater } from '../../components/account/UsernameDialog/UsernameDialog';
import Button from '../../components/common/Button/Button';
import styles from './Account.module.scss';

/**
 * Where Google / Discord send players back to (through Supabase). The Supabase client swaps the
 * one-time ?code= in the URL for a session as the site loads. This page waits for that and for
 * the player's profile, then:
 * - a new player keeps or picks a username right here, and lands on their profile
 * - anyone else goes back to the page they signed in from
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { loading, user, profile, profileError, refreshProfile, openSignIn } = useAuth();
  const [problem, setProblem] = useState(null);
  // Read once: taking it clears it from storage
  const [returnTo] = useState(() => takeReturnPath() ?? '/games');
  // Settled once the profile is in, so saving the new name doesn't make them a "returning" player
  const [welcoming, setWelcoming] = useState(false);

  // The exchange happens by itself; this only explains what went wrong when there's no session after it
  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    (async () => {
      // Resolves once the code exchange is done, with the error if the URL carried one
      const { error } = await supabase.auth.initialize();
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || session) return;
      if (error?.details?.error === 'access_denied') {
        setProblem('Sign-in was cancelled.');
      } else if (error) {
        setProblem(`Sign-in didn't work: ${error.message}`);
      } else {
        setProblem("Sign-in didn't finish. It has to end in the same browser, on the same site address " +
          'it started on (for example, not start on localhost and end on the live site).');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading || !profile || welcoming) return;
    if (hasChosenUsername(profile)) navigate(returnTo, { replace: true });
    else setWelcoming(true);
  }, [loading, profile, welcoming, navigate, returnTo]);

  let content = <p>Signing you in…</p>;
  if (!supabase) {
    content = <p>Accounts aren't switched on for this site.</p>;
  } else if (problem) {
    content = (
      <>
        <p className={styles.error} role="alert">{problem}</p>
        <div className={styles.actions}>
          <Button onClick={openSignIn}>Try again</Button>
          <Button as={Link} to="/games" variant="outline">Back to the games</Button>
        </div>
      </>
    );
  } else if (user && profileError) {
    content = (
      <>
        <p className={styles.error} role="alert">You're signed in, but your profile didn't load. Check your connection and try again.</p>
        <div className={styles.actions}><Button onClick={refreshProfile}>Try again</Button></div>
      </>
    );
  } else if (welcoming) {
    content = <p>Welcome! Pick your username.</p>;
  }

  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      <h1 className={styles.title}>Sign in</h1>
      <section className={styles.card} aria-live="polite">{content}</section>

      {welcoming && profile && (
        <WelcomeDialog
          profile={profile}
          onDone={(saved) => navigate(`/u/${saved.username}`, { replace: true })}
          onLater={() => {
            rememberLater(profile.id);
            navigate(returnTo, { replace: true });
          }}
        />
      )}
    </div>
  );
};

export default AuthCallback;
