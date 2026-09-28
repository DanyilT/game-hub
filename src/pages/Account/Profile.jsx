import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { USERNAME_PATTERN } from '../../lib/account';
import Avatar from '../../components/common/Avatar/Avatar';
import Button from '../../components/common/Button/Button';
import styles from './Account.module.scss';

const PUBLIC_COLUMNS = 'id, username, display_name, avatar_url, created_at';

const joinedDate = (timestamp) =>
  new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(timestamp));

/** Public profile: /u/:username */
const Profile = () => {
  const { username = '' } = useParams();
  const { isAvailable, profile: me } = useAuth();
  const lookup = username.toLowerCase();
  const valid = USERNAME_PATTERN.test(lookup);
  // Tagged with the name it's for, so a previous player never flashes on the next profile
  const [result, setResult] = useState({ lookup: null, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  // Your own profile needs no fetch (e.g. straight after sign-up), and shows your latest edits
  const isOwn = me?.username === lookup;

  useEffect(() => {
    if (!isAvailable || !valid || isOwn) return undefined;
    let active = true;
    supabase.from('profiles').select(PUBLIC_COLUMNS).eq('username', lookup).maybeSingle()
      .then(({ data, error }) => {
        if (active) setResult({ lookup, data, error });
      });
    return () => {
      active = false;
    };
  }, [isAvailable, valid, isOwn, lookup, attempt]);

  // Usernames are lowercase: /u/Dany → /u/dany
  if (username !== lookup) return <Navigate to={`/u/${lookup}`} replace />;

  const page = (content) => <div className={styles.page}>{content}</div>;

  if (!isAvailable) {
    return page(<section className={styles.card}><p>Player profiles are coming soon.</p></section>);
  }
  if (!isOwn && valid && result.lookup !== lookup) {
    return page(<p className={styles.muted} aria-live="polite">Loading profile…</p>);
  }
  if (!isOwn && valid && result.error) {
    return page(
      <section className={styles.card}>
        <p className={styles.error} role="alert">Couldn't load this profile. Check your connection and try again.</p>
        <div className={styles.actions}><Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button></div>
      </section>,
    );
  }
  if (!isOwn && (!valid || !result.data)) {
    return page(
      <section className={styles.card}>
        <h1 className={styles.cardTitle}>No player called @{username}</h1>
        <p className={styles.muted}>They may have changed their username or deleted their account.</p>
        <p><Link to="/users" className={styles.textLink}>See all players</Link></p>
      </section>,
    );
  }

  const isMe = isOwn || me?.id === result.data.id;
  const player = isMe ? me : result.data;
  const name = player.display_name ?? player.username;

  return page(
    <>
      <section className={styles.profileHeader}>
        <Avatar url={player.avatar_url} name={name} size={96} />
        <div className={styles.profileNames}>
          <h1 className={styles.title}>{name}</h1>
          <p className={styles.handle}>@{player.username}</p>
          <p className={styles.muted}>Joined {joinedDate(player.created_at)}</p>
        </div>
        {isMe && <Button as={Link} to="/settings" variant="outline">Edit profile</Button>}
      </section>

      <section className={styles.card}>
        <p className={styles.muted}>Ratings, favourites and play history will show up here soon.</p>
      </section>
    </>,
  );
};

export default Profile;
