import { Navigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button/Button';
import PageTitle from '../../components/common/PageTitle/PageTitle';
import Status from '../../components/common/Status/Status';
import styles from './Account.module.scss';

/**
 * /me (and /u/me): your own profile, for links that can't know your username. Signed in, it
 * swaps itself for /u/<username>. Signed out, it offers sign-in, which comes back here and so
 * lands on the profile.
 */
const Me = () => {
  const { isAvailable, loading, user, profile, profileError, refreshProfile, openSignIn } = useAuth();

  if (profile) return <Navigate to={`/u/${profile.username}`} replace />;

  const page = (content) => (
    <div className={`${styles.page} ${styles.narrow}`}>
      <PageTitle>Your profile</PageTitle>
      {content}
    </div>
  );

  if (!isAvailable) {
    return page(<section className={styles.card}><p>Player profiles are coming soon.</p></section>);
  }
  // Signed in, but the profile is still on its way
  if (loading || (user && !profileError)) {
    return page(<Status kind="loading" />);
  }
  if (user) {
    return page(
      <section className={styles.card}>
        <Status kind="error" onRetry={refreshProfile}>
          Couldn&rsquo;t load your profile. Check your connection and try again.
        </Status>
      </section>,
    );
  }
  return page(
    <section className={styles.card}>
      <p>Sign in to see your profile.</p>
      <div className={styles.actions}><Button onClick={openSignIn}>Sign in</Button></div>
    </section>,
  );
};

export default Me;
