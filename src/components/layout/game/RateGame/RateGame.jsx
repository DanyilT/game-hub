import { useId, useState } from 'react';
import { PiStarFill } from 'react-icons/pi';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLibrary } from '../../../../contexts/LibraryContext';
import { gameBugReportUrl } from '../../../../lib/support';
import Button from '../../../common/Button/Button';
import InfoTip from '../../../common/InfoTip/InfoTip';
import RatingSlider, { SCORES } from '../RatingSlider/RatingSlider';
import styles from './RateGame.module.scss';

export const FEEDBACK_MAX = 2000;

// What the "tell us more" box asks, by the score just given
const followUp = (score) => {
  if (score <= 2) return { question: "What didn't you like?", hint: 'Anything that bugged you, or that was plain broken?' };
  if (score === 3) return { question: 'What would make it better?', hint: 'Something missing, confusing or too hard?' };
  return { question: 'What did you like most?', hint: 'And anything that could make it even better?' };
};

/** How the players rated a game: the average, how many, and a bar for each score */
const RatingSummary = ({ stats }) => {
  if (!stats) return <p className={`${styles.summary} ${styles.muted}`}>Loading the ratings…</p>;
  if (stats.rating_count === 0) return <p className={`${styles.summary} ${styles.muted}`}>No ratings yet. Be the first!</p>;
  const most = Math.max(...stats.score_counts);
  return (
    <div className={styles.summary}>
      <p className={styles.average}>
        <PiStarFill aria-hidden="true" />
        <strong>{Number(stats.rating_average).toFixed(1)}</strong>
        <span className={styles.muted}>
          average from {stats.rating_count} {stats.rating_count === 1 ? 'rating' : 'ratings'}
        </span>
      </p>
      <ol className={styles.bars} aria-label="Ratings by score">
        {SCORES.map(({ score, label }) => {
          const count = stats.score_counts[score - 1];
          return (
            <li key={score} className={styles.bar} style={{ '--share': most ? count / most : 0 }}>
              <span className={styles.barLabel}>{score}</span>
              <span className={styles.barTrack} aria-hidden="true"><span className={styles.barFill} /></span>
              <span className={styles.barCount}>
                {count}<span className="visually-hidden"> rated it {score}, {label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/**
 * The game page's "Rate this game" card: the rating slider, then a short "tell us more" box that
 * sends private feedback (only the developer reads it). Its button (Rate, or Sign in to rate when
 * signed out) shows once the slider has moved. Expanded (the arrow, like Details'), it also shows
 * how the players rated the game.
 * @param {object} game - the catalogue entry
 * @param {object|null} stats - the game's totals (useGameStats)
 */
const RateGame = ({ game, stats }) => {
  const { isAvailable, user, openSignIn } = useAuth();
  const { ratings, loaded, rateGame, sendFeedback } = useLibrary();
  const saved = ratings.get(game.id)?.score ?? null;
  const [draft, setDraft] = useState(null); // a score picked but not sent yet
  const [step, setStep] = useState('rate'); // 'rate', 'tell-more' (after rating) or 'thanks' (after the message)
  const [message, setMessage] = useState('');
  const [state, setState] = useState({ busy: false, error: null });
  const [expanded, setExpanded] = useState(false); // the players' ratings, under the slider
  const headingId = useId();
  const messageId = useId();
  const summaryId = useId();

  if (!isAvailable) return null;

  const value = draft ?? saved;
  const changed = draft !== null && draft !== saved;

  const run = async (action, onDone) => {
    setState({ busy: true, error: null });
    try {
      await action();
      setState({ busy: false, error: null });
      onDone();
    } catch (error) {
      setState({ busy: false, error: error?.hint === 'feedback_limit' ? error.message : "Couldn't send that. Check your connection and try again." });
    }
  };

  const submitRating = () => run(() => rateGame(game.id, draft), () => {
    setDraft(null);
    setMessage('');
    setStep('tell-more');
  });

  const removeRating = () => run(() => rateGame(game.id, null), () => setDraft(null));

  const submitMessage = (e) => {
    e.preventDefault();
    run(() => sendFeedback({ gameId: game.id, kind: 'rating', score: saved, message }), () => setStep('thanks'));
  };

  let content;
  if (step === 'tell-more' && saved !== null) {
    const { question, hint } = followUp(saved);
    content = (
      <form className={styles.form} onSubmit={submitMessage}>
        <p className={styles.thanks}>Thanks for rating {game.title}!</p>
        <label htmlFor={messageId} className={styles.question}>{question}</label>
        <textarea
          id={messageId}
          className={styles.textarea}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={FEEDBACK_MAX}
          rows={4}
          placeholder={hint}
          // Straight into the box with a keyboard; on touch screens that would pop the keyboard up unasked
          autoFocus={window.matchMedia('(hover: hover) and (pointer: fine)').matches}
        />
        <p className={styles.muted}>
          Only the developer reads this. Found a bug?{' '}
          <a href={gameBugReportUrl(game)} target="_blank" rel="noopener noreferrer" className={styles.link}>
            Report it on GitHub<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          , or use the <strong>?</strong> button at the top.
        </p>
        <div className={styles.actions}>
          <Button variant="outline" onClick={() => setStep('rate')} disabled={state.busy}>No thanks</Button>
          <Button type="submit" disabled={!message.trim() || state.busy}>{state.busy ? 'Sending…' : 'Send'}</Button>
        </div>
      </form>
    );
  } else if (step === 'thanks') {
    content = (
      <>
        <p className={styles.thanks}>Thanks! Your message went straight to the developer.</p>
        <div className={styles.actions}>
          <Button variant="outline" onClick={() => setStep('rate')}>Back to your rating</Button>
        </div>
      </>
    );
  } else {
    // The buttons come once the slider has moved (and Remove rating once rated)
    const showActions = user ? changed || saved !== null : draft !== null;
    content = (
      <>
        <RatingSlider
          value={value}
          onChange={setDraft}
          label={`Your rating for ${game.title}`}
          disabled={Boolean(user) && !loaded}
        />
        {showActions && (
          <div className={styles.actions}>
            {user ? (
              <>
                {changed && <Button variant="outline" onClick={() => setDraft(null)} disabled={state.busy}>Cancel</Button>}
                {changed && (
                  <Button onClick={submitRating} disabled={state.busy}>
                    {state.busy ? 'Saving…' : saved === null ? 'Rate' : 'Update rating'}
                  </Button>
                )}
                {!changed && (
                  <Button variant="outline" onClick={removeRating} disabled={state.busy}>Remove rating</Button>
                )}
              </>
            ) : (
              <Button onClick={openSignIn}>Sign in to rate</Button>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <section className={styles.rateGame} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId}>
          <PiStarFill className={styles.titleStar} aria-hidden="true" />
          {saved === null ? 'Rate this game' : 'Your rating'}
        </h2>
        {saved !== null && <InfoTip label="About your rating">Slide to change it. Only you see your rating.</InfoTip>}
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={summaryId}
          aria-label={expanded ? "Hide the players' ratings" : "Show the players' ratings"}
          title={expanded ? "Hide the players' ratings" : "Show the players' ratings"}
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>
      {content}
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <div id={summaryId} className={`${styles.players} ${expanded ? styles.open : ''}`}>
        <div><RatingSummary stats={stats} /></div>
      </div>
    </section>
  );
};

export default RateGame;
