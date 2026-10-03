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
import { AUDIENCES, fetchMyPrivacy, setPrivacy } from '../../lib/activity';
import { fullDate } from '../../lib/dates';
import { setPreference, usePreferences } from '../../lib/preferences';
import Avatar from '../../components/common/Avatar/Avatar';
import Button from '../../components/common/Button/Button';
import UsernameField, { useUsernameCheck } from '../../components/account/UsernameField/UsernameField';
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

const SaveStatus = ({ state }) => (
  <p className={`${styles.status} ${state.error ? styles.error : styles.ok}`} role="status">
    {state.error ?? state.ok}
  </p>
);

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
          <div className={`${styles.field} ${styles.grow}`}>
            <label htmlFor="settings-display-name" className={styles.label}>Display name</label>
            <input
              id="settings-display-name"
              className={styles.input}
              value={displayName}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={DISPLAY_NAME_MAX}
              placeholder={profile.username}
              autoComplete="nickname"
            />
            <p className={styles.muted}>Shown on your profile instead of your username. Leave it empty to use @{profile.username}.</p>
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="submit" disabled={!dirty || save.busy}>
            {save.busy && save.what === 'name' ? 'Saving…' : 'Save profile'}
          </Button>
          <Button as={Link} to={`/u/${profile.username}`} variant="outline">View profile</Button>
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
        <p className={styles.muted}>
          {nextChange
            ? `You can change it again on ${fullDate(nextChange)}, ${USERNAME_COOLDOWN_DAYS} days after you picked or kept it.`
            : `You can change it once every ${USERNAME_COOLDOWN_DAYS} days. Links to your old profile address stop working.`}
        </p>
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
        {user.email && <> as <strong>{user.email}</strong></>}.
      </p>
      <p className={styles.muted}>Only you can see your email address.</p>
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

/**
 * A set of radio buttons as cards, each with a little picture of the choice
 * @param {string} legend
 * @param {string} name - the radio group's name
 * @param {object[]} options - { value, label, text? }
 * @param {string} value - the chosen one
 * @param {function} onChange - gets the new value
 * @param {function} preview - draws the picture for a value
 */
const ChoiceGroup = ({ legend, name, options, value, onChange, preview }) => (
  <fieldset className={styles.choices}>
    <legend className={styles.label}>{legend}</legend>
    {options.map((option) => (
      <label key={option.value} className={`${styles.choice} ${value === option.value ? styles.chosen : ''}`}>
        <input
          type="radio"
          className="visually-hidden"
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={() => onChange(option.value)}
        />
        {preview(option.value)}
        <span className={styles.choiceText}>
          <strong>{option.label}</strong>
          {option.text && <span className={styles.muted}>{option.text}</span>}
        </span>
      </label>
    ))}
  </fieldset>
);

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
      <ChoiceGroup
        legend="Navigation"
        name="nav-style"
        options={NAV_STYLES}
        value={navStyle}
        onChange={(value) => setPreference('navStyle', value)}
        preview={(value) => <NavPreview style={value} corner={value === 'floating' ? navCorner : null} />}
      />
      {navStyle === 'floating' && (
        <ChoiceGroup
          legend="Floating button corner"
          name="nav-corner"
          options={CORNERS}
          value={navCorner}
          onChange={(value) => setPreference('navCorner', value)}
          preview={(value) => <NavPreview style="floating" corner={value} />}
        />
      )}
      <p className={styles.muted}>These are kept on this device only, so each of your devices can have its own.</p>
    </section>
  );
};

// What the Privacy section asks about (supabase/migrations/*_play_activity.sql)
const PRIVACY_CHOICES = [
  { key: 'show_played', label: "Games you've played", text: 'On your profile: when you last played each game, and for how long.' },
  { key: 'show_playing', label: "What you're playing now", text: 'On your profile and in friends lists, while you play.' },
  { key: 'show_activity', label: 'Recent activity', text: 'Your plays in the recent activity on the games page.' },
];

/** Who sees what you play: saved to your account as you choose */
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
      <p className={styles.muted}>
        Who sees what you play. Your favorite games and friends list are public; your ratings, bookmarks and
        progress are only yours.
      </p>
      {choices && PRIVACY_CHOICES.map(({ key, label, text }) => (
        <div key={key} className={styles.audienceGroup} role="radiogroup" aria-labelledby={`privacy-${key}`}>
          <span className={styles.audienceText}>
            <span id={`privacy-${key}`} className={styles.label}>{label}</span>
            <span className={styles.muted}>{text}</span>
          </span>
          <span className={styles.audienceOptions}>
            {AUDIENCES.map(({ value, label: audience }) => (
              <label key={value} className={`${styles.audienceOption} ${choices[key] === value ? styles.chosenAudience : ''}`}>
                <input
                  type="radio"
                  className="visually-hidden"
                  name={`privacy-${key}`}
                  value={value}
                  checked={choices[key] === value}
                  onChange={() => choose(key, value)}
                />
                {audience}
              </label>
            ))}
          </span>
        </div>
      ))}
      {!choices && !error && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
};

const DeleteSection = ({ profile, onDelete }) => {
  const [typed, setTyped] = useState('');
  const [state, setState] = useState({ busy: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
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
      <form className={styles.field} onSubmit={submit}>
        <label htmlFor="settings-delete-confirm" className={styles.label}>
          Type your username, {profile.username}, to confirm
        </label>
        <div className={styles.inputRow}>
          <input
            id="settings-delete-confirm"
            className={styles.input}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Button type="submit" variant="danger" disabled={typed.trim() !== profile.username || state.busy}>
            {state.busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
        {state.error && <p className={styles.error} role="alert">{state.error}</p>}
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
      <h1 className={styles.title}>Settings</h1>
      {content}
    </div>
  );

  // Checked first: deleting signs you out, which would otherwise show "Sign in" here
  if (deletion === 'done' || (deletion === 'deleting' && !user)) {
    return page(
      <section className={styles.card} role="status">
        <p>Your account has been deleted. Thanks for playing!</p>
        <p><Link to="/" className={styles.textLink}>Back to the games</Link></p>
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
    return page(<p className={styles.muted} aria-live="polite">Loading…</p>);
  }
  if (!user) {
    return page(
      <>
        <PreferencesSection />
        <section className={styles.card}>
          {signOutProblem && <p className={styles.error} role="alert">{signOutProblem}</p>}
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
          <p className={styles.error} role="alert">
            {profileError ? "Couldn't load your profile. Check your connection and try again." : 'Loading…'}
          </p>
          {profileError && <div className={styles.actions}><Button onClick={refreshProfile}>Try again</Button></div>}
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
