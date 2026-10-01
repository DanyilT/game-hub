import { useId, useState } from 'react';
import { Link } from 'react-router';
import { PiArrowCounterClockwise, PiChatText, PiGithubLogo } from 'react-icons/pi';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLibrary } from '../../../../contexts/LibraryContext';
import { gameBugReportUrl, hubBugReportUrl } from '../../../../lib/support';
import { showToast } from '../../../../lib/toast';
import Button from '../../../common/Button/Button';
import Modal from '../../../common/Modal/Modal';
import { FEEDBACK_MAX } from '../RateGame/RateGame';
import styles from './GameHelp.module.scss';

const NewTab = () => (
  <>
    <span aria-hidden="true"> ↗</span>
    <span className="visually-hidden"> (opens in a new tab)</span>
  </>
);

/** "Send us a message": private feedback about the game, from signed-in players */
const MessageForm = ({ game, onDone, onBack }) => {
  const { sendFeedback } = useLibrary();
  const [message, setMessage] = useState('');
  const [withBrowser, setWithBrowser] = useState(true);
  const [state, setState] = useState({ busy: false, error: null });
  const messageId = useId();

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      await sendFeedback({ gameId: game.id, kind: 'bug', message, withBrowser });
      onDone();
    } catch (error) {
      setState({
        busy: false,
        error: error?.hint === 'feedback_limit' ? error.message : "Couldn't send it. Check your connection and try again.",
      });
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor={messageId} className={styles.label}>What went wrong?</label>
      <textarea
        id={messageId}
        className={styles.textarea}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={FEEDBACK_MAX}
        rows={5}
        placeholder="What happened, and what were you doing just before?"
      />
      <label className={styles.check}>
        <input type="checkbox" checked={withBrowser} onChange={(e) => setWithBrowser(e.target.checked)} />
        Include my browser&rsquo;s name and version (it helps find the bug)
      </label>
      <p className={styles.muted}>Only the developer reads it, and it&rsquo;s deleted with your account.</p>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <div className={styles.actions}>
        <Button type="submit" disabled={!message.trim() || state.busy}>{state.busy ? 'Sending…' : 'Send'}</Button>
        <Button variant="outline" onClick={onBack} disabled={state.busy}>Back</Button>
      </div>
    </form>
  );
};

/** Reset progress: asks first, then clears the save in this browser and in the account */
const ResetConfirm = ({ game, signedIn, onReset, onBack }) => {
  const [state, setState] = useState({ busy: false, error: null });

  const reset = async () => {
    setState({ busy: true, error: null });
    try {
      await onReset();
    } catch (error) {
      setState({
        busy: false,
        error: error?.code === 'game'
          ? "The game didn't answer, so nothing was reset. Wait until it has loaded, then try again."
          : "Couldn't delete the save in your account, so nothing was reset. Check your connection and try again.",
      });
    }
  };

  return (
    <div className={styles.form}>
      <p>
        Start {game.title} from scratch? This deletes your progress in it (scores, levels, anything it saved)
        {signedIn ? ' in your account and in this browser.' : ' in this browser.'} It can&rsquo;t be undone.
      </p>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <div className={styles.actions}>
        <Button variant="danger" onClick={reset} disabled={state.busy}>
          {state.busy ? 'Resetting…' : 'Reset progress'}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={state.busy}>Cancel</Button>
      </div>
    </div>
  );
};

/**
 * The game page's help window (the ? button): report a bug on GitHub or send a private message,
 * reset the game's progress, and help with GameHub itself.
 * @param {object} game - the catalogue entry
 * @param {function|null} onReset - resets the progress (useGameBridge); null for games not played in the hub
 * @param {boolean} connected - the game has connected to the hub (its progress can be reset)
 * @param {function} onClose
 */
const GameHelp = ({ game, onReset, connected, onClose }) => {
  const { isAvailable, user, openSignIn } = useAuth();
  const [view, setView] = useState('menu'); // 'menu', 'message' or 'reset'
  const signedIn = Boolean(user);

  const titles = { menu: 'Help', message: 'Send a message', reset: 'Reset progress' };

  let content;
  if (view === 'message') {
    content = (
      <MessageForm
        game={game}
        onBack={() => setView('menu')}
        onDone={() => {
          showToast('Thanks! Your message went straight to the developer.');
          onClose();
        }}
      />
    );
  } else if (view === 'reset') {
    content = (
      <ResetConfirm
        game={game}
        signedIn={signedIn}
        onBack={() => setView('menu')}
        onReset={async () => {
          await onReset();
          showToast(`${game.title} starts from scratch.`);
          onClose();
        }}
      />
    );
  } else {
    content = (
      <div className={styles.menu}>
        <p className={styles.gameName}>{game.title}</p>

        <section className={styles.group} aria-labelledby="help-bugs">
          <h3 id="help-bugs" className={styles.groupTitle}>Something not working?</h3>
          <a href={gameBugReportUrl(game)} target="_blank" rel="noopener noreferrer" className={styles.item}>
            <PiGithubLogo aria-hidden="true" />
            <span>Report a bug on GitHub<NewTab /></span>
          </a>
          {isAvailable && (
            signedIn ? (
              <button type="button" className={styles.item} onClick={() => setView('message')}>
                <PiChatText aria-hidden="true" />
                <span>No GitHub account? Send a message instead</span>
              </button>
            ) : (
              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  onClose();
                  openSignIn();
                }}
              >
                <PiChatText aria-hidden="true" />
                <span>No GitHub account? Sign in to send a message instead</span>
              </button>
            )
          )}
        </section>

        {onReset && (
          <section className={styles.group} aria-labelledby="help-progress">
            <h3 id="help-progress" className={styles.groupTitle}>Your progress</h3>
            <p className={styles.muted}>
              {signedIn
                ? 'Your progress in this game is saved to your account, so it follows you to any device.'
                : 'Your progress in this game is saved in this browser only. Sign in to keep it in your account.'}
            </p>
            <button
              type="button"
              className={`${styles.item} ${styles.danger}`}
              onClick={() => setView('reset')}
              disabled={!connected}
            >
              <PiArrowCounterClockwise aria-hidden="true" />
              <span>Reset progress…</span>
            </button>
            {!connected && <p className={styles.muted}>Available once the game has loaded.</p>}
          </section>
        )}

        <section className={styles.group} aria-labelledby="help-other">
          <h3 id="help-other" className={styles.groupTitle}>Anything else</h3>
          <a href={hubBugReportUrl()} target="_blank" rel="noopener noreferrer" className={styles.item}>
            <PiGithubLogo aria-hidden="true" />
            <span>A problem with GameHub itself? Report it on GitHub<NewTab /></span>
          </a>
          <p className={styles.muted}>
            <Link to="/about" onClick={onClose}>About GameHub</Link>
            {' · '}
            <Link to="/terms" onClick={onClose}>Terms</Link>
            {' · '}
            <Link to="/privacy" onClick={onClose}>Privacy</Link>
          </p>
        </section>
      </div>
    );
  }

  return <Modal title={titles[view]} onClose={onClose}>{content}</Modal>;
};

export default GameHelp;
