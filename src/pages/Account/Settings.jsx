import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CiImageOn, CiTrash } from 'react-icons/ci';
import { FaDiscord } from 'react-icons/fa6';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../../contexts/AuthContext';
import {
  DISPLAY_NAME_MAX,
  PROVIDER_NAMES,
  USERNAME_COOLDOWN_DAYS,
  describeProfileError,
  nextUsernameChange,
} from '../../lib/account';
import { AUDIENCES, deletePlayHistory, fetchMyPrivacy, setPrivacy } from '../../lib/activity';
import { fetchMyBlocks, unblockPlayer } from '../../lib/blocks';
import { askToConfirm } from '../../lib/confirm';
import { fullDate } from '../../lib/dates';
import { setPreference, usePreferences } from '../../lib/preferences';
import UsernameField, { useUsernameCheck } from '../../components/account/UsernameField/UsernameField';
import Avatar from '../../components/common/Avatar/Avatar';
import Button from '../../components/common/Button/Button';
import { RadioGroup, Switch, TextField } from '../../components/common/Field/Field';
import InfoTip from '../../components/common/InfoTip/InfoTip';
import Message from '../../components/common/Message/Message';
import PageTitle from '../../components/common/PageTitle/PageTitle';
import Status from '../../components/common/Status/Status';
import styles from './Account.module.scss';

// The picture Google / Discord gave at the last sign-in (the only one a profile may use)
const providerPicture = (user) => {
  const url = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
};
const pictureSource = (url) => {
  if (url.includes('googleusercontent.com')) return 'Google';
  if (url.includes('discordapp.com')) return 'Discord';
  return 'sign-in';
};
const SOURCE_ICONS = { Google: FcGoogle, Discord: FaDiscord };

/**
 * Runs a save, keeping track of its state for the message under the form.
 * @return {[object, function]} - [{ busy, ok, error, what }, run(fn, okMessage, what)]; `what`
 *   tells apart saves that share one message (the picture and the display name)
 */
const useSave = () => {
  const [state, setState] = useState({ busy: false, ok: null, error: null, what: null });
  const run = async (fn, okMessage, what = null) => {
    setState({ busy: true, ok: null, error: null, what });
    try {
      await fn();
      setState({ busy: false, ok: okMessage, error: null, what });
      return true;
    } catch (err) {
      setState({ busy: false, ok: null, error: describeProfileError(err), what });
      return false;
    }
  };
  return [state, run];
};

// The message under a form: nothing (and no room for it) until there is one, which slides down into view
const SaveStatus = ({ state }) => {
  const message = state.error ?? state.ok;
  if (!message) return null;
  return <Message tone={state.error ? 'error' : 'success'} role="status" appear>{message}</Message>;
};

/**
 * The profile picture, with its one action on hover or focus: remove it, or, when there's none,
 * put the sign-in provider's picture back ("Upload"). Touch screens show the action all the time.
 */
const PictureButton = ({ profile, name, fromProvider, busy, onChange }) => {
  const size = 120;
  if (!profile.avatar_url && !fromProvider) return <Avatar url={null} name={name} size={size} />;

  const removing = Boolean(profile.avatar_url);
  const source = fromProvider && pictureSource(fromProvider);
  const Icon = removing ? CiTrash : (SOURCE_ICONS[source] ?? CiImageOn);
  const label = removing ? 'Remove picture' : `Use your ${source} picture`;

  return (
    <button
      type="button"
      className={styles.picture}
      onClick={() => onChange(removing ? null : fromProvider)}
      disabled={busy}
      aria-label={label}
      title={label}
    >
      <Avatar url={profile.avatar_url} name={name} size={size} />
      <span className={styles.pictureAction} aria-hidden="true">
        <Icon />
        {removing ? 'Remove' : 'Upload'}
      </span>
    </button>
  );
};

const ProfileSection = ({ profile, user }) => {
  const { updateProfile } = useAuth();
  // The draft is null until edited, so the field always shows the saved profile otherwise
  const [nameDraft, setNameDraft] = useState(null);
  // The picture and the display name share the message under the form
  const [save, runSave] = useSave();

  const displayName = nameDraft ?? profile.display_name ?? '';
  const newDisplayName = displayName.trim() || null;
  const dirty = newDisplayName !== profile.display_name;

  const submit = async (e) => {
    e.preventDefault();
    if (await runSave(() => updateProfile({ display_name: newDisplayName }), 'Saved.', 'name')) setNameDraft(null);
  };

  const changePicture = (url) =>
    runSave(() => updateProfile({ avatar_url: url }), url ? 'Picture updated.' : 'Picture removed.', 'picture');

  const name = profile.display_name ?? profile.username;

  return (
    <section className={styles.card} aria-labelledby="settings-profile">
      <h2 id="settings-profile" className={styles.cardTitle}>Profile</h2>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.profileRow}>
          <PictureButton
            profile={profile}
            name={name}
            fromProvider={providerPicture(user)}
            busy={save.busy}
            onChange={changePicture}
          />
          <TextField
            id="settings-display-name"
            label="Display name"
            className={styles.grow}
            value={displayName}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            placeholder={profile.username}
            autoComplete="nickname"
            hint={`Shown on your profile instead of your username. Leave it empty to use @${profile.username}.`}
            after={(
              <Button type="submit" disabled={!dirty || save.busy}>
                {save.busy && save.what === 'name' ? 'Saving…' : 'Save profile'}
              </Button>
            )}
          />
        </div>
        <SaveStatus state={save} />
      </form>
    </section>
  );
};

const UsernameSection = ({ profile }) => {
  const { updateProfile } = useAuth();
  const [draft, setDraft] = useState(null);
  const [save, runSave] = useSave();
  const name = draft ?? profile.username;
  const status = useUsernameCheck(name, profile.username);
  const nextChange = nextUsernameChange(profile);

  const submit = async (e) => {
    e.preventDefault();
    if (await runSave(() => updateProfile({ username: name }), `Your username is now @${name}.`)) setDraft(null);
  };

  return (
    <section className={styles.card} aria-labelledby="settings-username">
      <h2 id="settings-username" className={styles.cardTitle}>Username</h2>
      <form className={styles.form} onSubmit={submit}>
        <UsernameField
          id="settings-username-input"
          label="Your username"
          value={name}
          onChange={setDraft}
          status={status}
          disabled={Boolean(nextChange)}
        />
        <Message>
          {nextChange
            ? `You can change it again on ${fullDate(nextChange)}, ${USERNAME_COOLDOWN_DAYS} days after you picked or kept it.`
            : `You can change it once every ${USERNAME_COOLDOWN_DAYS} days. Links to your old profile address stop working.`}
        </Message>
        {!nextChange && (
          <div className={styles.actions}>
            <Button type="submit" disabled={save.busy || !(status === 'available' || status === 'error')}>
              {save.busy ? 'Saving…' : 'Change username'}
            </Button>
          </div>
        )}
        <SaveStatus state={save} />
      </form>
    </section>
  );
};

const AccountSection = ({ user, onSignOutProblem }) => {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const providers = (user.app_metadata?.providers ?? [user.app_metadata?.provider])
    .filter(Boolean)
    .map((id) => PROVIDER_NAMES[id] ?? id);

  // This device is signed out even when the server can't be reached, so this section is gone by
  // the time that's known: the page shows the problem instead
  const signOutEverywhere = async () => {
    setBusy(true);
    try {
      await signOut({ everywhere: true });
    } catch {
      onSignOutProblem("You're signed out here, but the server couldn't be reached to sign out your other " +
        'devices. Sign in and try again.');
    }
  };

  return (
    <section className={styles.card} aria-labelledby="settings-account">
      <h2 id="settings-account" className={styles.cardTitle}>Account</h2>
      <p>
        Signed in with {providers.join(' and ') || 'a sign-in provider'}
        {user.email && <> as <strong>{user.email}</strong></>}. <InfoTip label="Private email address">Only you can see your email address.</InfoTip>
      </p>
      <div className={styles.actions}>
        <Button variant="outline" onClick={() => signOut()} disabled={busy}>Sign out</Button>
        <Button variant="outline" onClick={signOutEverywhere} disabled={busy}>Sign out on all devices</Button>
      </div>
    </section>
  );
};

const NAV_STYLES = [
  { value: 'sidebar', label: 'Sidebar', text: 'A bar down the side of the page (behind a menu button on phones).' },
  { value: 'floating', label: 'Floating button', text: 'A round button in a corner that opens into a ring of buttons.' },
];
const CORNERS = [
  { value: 'left', label: 'Bottom left' },
  { value: 'right', label: 'Bottom right' },
];

// A tiny page with the navigation drawn in: a bar down the side, or a dot in a corner
const NavPreview = ({ style, corner }) => (
  <span className={`${styles.navPreview} ${styles[style]} ${styles[corner] ?? ''}`} aria-hidden="true">
    <span />
  </span>
);

/** Choices about this device's screen (src/lib/preferences.js): for everyone, signed in or not */
const PreferencesSection = () => {
  const { navStyle, navCorner } = usePreferences();
  return (
    <section className={styles.card} aria-labelledby="settings-preferences">
      <h2 id="settings-preferences" className={styles.cardTitle}>Preferences</h2>
      <RadioGroup
        variant="cards"
        label="Navigation"
        name="nav-style"
        options={NAV_STYLES.map(({ value, label, text }) => ({
          value, label, hint: text, picture: <NavPreview style={value} corner={value === 'floating' ? navCorner : null} />,
        }))}
        value={navStyle}
        onChange={(value) => setPreference('navStyle', value)}
      />
      {navStyle === 'floating' && (
        <RadioGroup
          variant="cards"
          label="Floating button corner"
          name="nav-corner"
          options={CORNERS.map(({ value, label }) => ({ value, label, picture: <NavPreview style="floating" corner={value} /> }))}
          value={navCorner}
          onChange={(value) => setPreference('navCorner', value)}
        />
      )}
      <Message>These are kept on this device only, so each of your devices can have its own.</Message>
    </section>
  );
};

// What the Privacy section asks about (supabase/migrations/*_play_activity.sql and *_activity_controls.sql): whether
// GameHub keeps a history of what you play, recorded only while it's on (the server keeps to that), and while it does,
// who sees each thing that comes from it
const HISTORY = {
  on: 'Which games you play, when, and for how long: your profile’s Played tab, your play time, the recent activity, and what you’re playing now.',
  off: 'Nothing is recorded while you play, and no one sees what you’re playing now. What was kept before stays, and only you see it, until you delete it.',
};
const HISTORY_AUDIENCES = [
  { key: 'show_played', label: "Games you've played", text: 'On your profile: when you last played each game, and for how long.' },
  { key: 'show_activity', label: 'Recent activity', text: 'Your plays in the recent activity on the games page, once each is over.' },
  { key: 'show_playing', label: "What you're playing now", text: 'On your profile and in friends lists, while you play.' },
];

/** Who sees one kind of activity: everyone, friends or only you */
const AudienceChoice = ({ choiceKey, label, text, value, onChoose }) => (
  <RadioGroup
    variant="segmented"
    inline
    label={label}
    info={<InfoTip label={`Who sees ${label.toLowerCase()}`}>{text}</InfoTip>}
    name={`privacy-${choiceKey}`}
    options={AUDIENCES}
    value={value}
    onChange={(audience) => onChoose(choiceKey, audience)}
  />
);

/** Deletes the play history, after asking */
const DeleteHistory = () => {
  const [state, setState] = useState({ busy: false, done: null, error: null });

  const remove = async () => {
    const yes = await askToConfirm({
      title: 'Delete your play history?',
      message: 'Every game you’ve played, when and for how long, goes for good: your profile’s Played tab, your play time, and your plays in the recent activity.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!yes) return;
    setState({ busy: true, done: null, error: null });
    try {
      const count = await deletePlayHistory();
      setState({ busy: false, done: count === 0 ? 'There was nothing to delete.' : 'Your play history is deleted.', error: null });
    } catch {
      setState({ busy: false, done: null, error: "Couldn't delete it. Check your connection and try again." });
    }
  };

  return (
    <div className={styles.historyActions}>
      <Button tone="danger" onClick={remove} disabled={state.busy}>
        {state.busy ? 'Deleting…' : 'Delete my play history'}
      </Button>
      <SaveStatus state={{ ok: state.done, error: state.error }} />
    </div>
  );
};

/** The players you've blocked (from the ⋯ on their profiles), each with Unblock */
const BlockedPlayers = () => {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchMyBlocks().then(
      (data) => active && setList(data),
      () => active && setError("Couldn't load the players you've blocked. Check your connection and reload the page."),
    );
    return () => {
      active = false;
    };
  }, []);

  const unblock = async (player) => {
    setBusy(player.id);
    setError(null);
    try {
      await unblockPlayer(player.id);
      setList((players) => players.filter(({ id }) => id !== player.id));
    } catch {
      setError("Couldn't unblock them. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h3 className={styles.subTitle}>Blocked players</h3>
      <Message>
        They can&rsquo;t add you as a friend, and you don&rsquo;t see each other&rsquo;s activity. Block a player with
        the ⋯ on their profile.
      </Message>
      {list?.length === 0 && <Status kind="empty">You haven&rsquo;t blocked anyone.</Status>}
      {list?.length > 0 && (
        <ul className={styles.blockedList}>
          {list.map((player) => {
            const name = player.display_name ?? player.username;
            return (
              <li key={player.id} className={styles.blockedRow}>
                <Link to={`/u/${player.username}`} className={styles.blockedPlayer}>
                  <Avatar url={player.avatar_url} name={name} size={32} />
                  <span>
                    <span className={styles.blockedName}>{name}</span> <Message as="span">@{player.username}</Message>
                  </span>
                </Link>
                <Button variant="outline" disabled={busy === player.id} onClick={() => unblock(player)}>Unblock</Button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <Message tone="error">{error}</Message>}
    </>
  );
};

/** What GameHub records as you play, and who sees it, saved to your account as you choose; and who you've blocked */
const PrivacySection = () => {
  const [choices, setChoices] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchMyPrivacy().then(
      (data) => active && setChoices(data),
      () => active && setError("Couldn't load your privacy settings. Check your connection and reload the page."),
    );
    return () => {
      active = false;
    };
  }, []);

  const historyOn = choices?.record_played !== false; // (a database from before the switch doesn't say: on)

  const choose = async (key, value) => {
    const before = choices;
    setChoices({ ...choices, [key]: value });
    setError(null);
    try {
      await setPrivacy({ [key]: value });
    } catch {
      setChoices(before);
      setError("Couldn't save that. Check your connection and try again.");
    }
  };

  return (
    <section className={styles.card} aria-labelledby="settings-privacy">
      <h2 id="settings-privacy" className={styles.cardTitle}>Privacy</h2>
      <Message>
        What GameHub records as you play, and who sees it. Your favorite games and friends list are public; your
        ratings, bookmarks and progress are only yours.
      </Message>
      {choices && (
        <div className={styles.activityGroup}>
          <Switch
            label="Keep a history of what I play"
            hint={historyOn ? HISTORY.on : HISTORY.off}
            checked={historyOn}
            onChange={(e) => choose('record_played', e.target.checked)}
          />
          {/* Off, the choices go with it (they're kept for when it's back on) */}
          {historyOn && HISTORY_AUDIENCES.map(({ key, label, text }) => (
            <AudienceChoice key={key} choiceKey={key} label={label} text={text} value={choices[key]} onChoose={choose} />
          ))}
          <DeleteHistory />
        </div>
      )}
      {!choices && !error && <Status kind="loading" />}
      {error && <Message tone="error">{error}</Message>}
      <BlockedPlayers />
    </section>
  );
};

const DeleteSection = ({ profile, onDelete }) => {
  const [typed, setTyped] = useState('');
  const [state, setState] = useState({ busy: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
    const yes = await askToConfirm({
      title: 'Delete your account?',
      message: `@${profile.username} and everything tied to it go for good: your profile, saves, ratings, favorites, bookmarks, friends, runs and play history. It can’t be undone.`,
      confirmLabel: 'Delete my account',
      danger: true,
    });
    if (!yes) return;
    setState({ busy: true, error: null });
    try {
      await onDelete();
    } catch {
      setState({ busy: false, error: "Couldn't delete your account. Check your connection and try again." });
    }
  };

  return (
    <section className={`${styles.card} ${styles.danger}`} aria-labelledby="settings-delete">
      <h2 id="settings-delete" className={styles.cardTitle}>Delete account</h2>
      <p>
        This deletes your account and profile straight away, along with anything tied to them. It can't be
        undone. You can always sign up again later with a fresh account.
      </p>
      <form onSubmit={submit}>
        <TextField
          id="settings-delete-confirm"
          label={`Type your username, ${profile.username}, to confirm`}
          size="md"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          error={state.error}
          after={(
            <Button type="submit" tone="danger" disabled={typed.trim() !== profile.username || state.busy}>
              {state.busy ? 'Deleting…' : 'Delete my account'}
            </Button>
          )}
        />
      </form>
    </section>
  );
};

const Settings = () => {
  const { isAvailable, loading, user, profile, profileError, refreshProfile, deleteAccount, openSignIn } = useAuth();
  const [deletion, setDeletion] = useState(null); // null, 'deleting' or 'done'
  const [signOutProblem, setSignOutProblem] = useState(null);

  const removeAccount = async () => {
    setDeletion('deleting');
    try {
      await deleteAccount();
      setDeletion('done');
    } catch (err) {
      setDeletion(null);
      throw err;
    }
  };

  const page = (content) => (
    <div className={styles.page}>
      <div className={styles.profileHeader}>
        <PageTitle>Settings</PageTitle>
        {/* Only once there's a profile: signed out, loading, or a site without accounts has none */}
        {profile && <Button to={`/u/${profile.username}`} variant="outline">View profile</Button>}
      </div>
      {content}
    </div>
  );

  // Checked first: deleting signs you out, which would otherwise show "Sign in" here
  if (deletion === 'done' || (deletion === 'deleting' && !user)) {
    return page(
      <section className={styles.card} role="status">
        <p>Your account has been deleted. Thanks for playing!</p>
        <p><Link to="/">Back to the games</Link></p>
      </section>,
    );
  }
  if (!isAvailable) {
    return page(
      <>
        <PreferencesSection />
        <section className={styles.card}><p>Accounts are coming soon.</p></section>
      </>,
    );
  }
  if (loading) {
    return page(<Status kind="loading" />);
  }
  if (!user) {
    return page(
      <>
        <PreferencesSection />
        <section className={styles.card}>
          {signOutProblem && <Message tone="error">{signOutProblem}</Message>}
          <p>Sign in to change your profile and account settings.</p>
          <div className={styles.actions}>
            <Button onClick={openSignIn}>Sign in</Button>
          </div>
        </section>
      </>,
    );
  }
  if (!profile) {
    return page(
      <>
        <section className={styles.card}>
          {profileError
            ? <Status kind="error" onRetry={refreshProfile}>Couldn&rsquo;t load your profile. Check your connection and try again.</Status>
            : <Status kind="loading" />}
        </section>
        <PreferencesSection />
      </>,
    );
  }

  return page(
    <>
      <ProfileSection profile={profile} user={user} />
      <UsernameSection profile={profile} />
      <PrivacySection />
      <PreferencesSection />
      <AccountSection user={user} onSignOutProblem={setSignOutProblem} />
      <DeleteSection profile={profile} onDelete={removeAccount} />
    </>,
  );
};

export default Settings;
