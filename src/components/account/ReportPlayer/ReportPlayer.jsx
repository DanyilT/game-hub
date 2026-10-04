import { useId, useState } from 'react';
import { Link } from 'react-router';
import { games, getEmbedUrl } from '../../../data/games';
import { describeReportError, REPORT_MAX, REPORT_REASONS, reportPlayer } from '../../../lib/reports';
import Button from '../../common/Button/Button';
import Modal from '../../common/Modal/Modal';
import styles from './ReportPlayer.module.scss';

// The games a report can name (the ones played here), by title
const GAME_CHOICES = games.filter(getEmbedUrl).sort((a, b) => a.title.localeCompare(b.title));

/**
 * "Report player", from the ⋯ on their profile: why (cheating, or something else), the game, and what happened. It
 * goes to the developer only.
 * @param {object} player - their profile
 * @param {function} onDone - sent
 * @param {function} onClose
 */
const ReportPlayer = ({ player, onDone, onClose }) => {
  const [reason, setReason] = useState(null);
  const [gameId, setGameId] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState({ busy: false, error: null });
  const ids = { game: useId(), message: useId() };
  const name = player.display_name ?? player.username;
  const needsMessage = reason === 'other';

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      await reportPlayer({ playerId: player.id, reason, gameId: reason === 'cheating' && gameId ? gameId : null, message: message.trim() });
      onDone();
    } catch (error) {
      setState({ busy: false, error: describeReportError(error) });
    }
  };

  return (
    <Modal title="Report player" onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <p className={styles.who}>{name} <span className={styles.handle}>@{player.username}</span></p>

        <fieldset className={styles.reasons}>
          <legend className={styles.label}>What&rsquo;s wrong?</legend>
          {REPORT_REASONS.map(({ value, label, text }) => (
            <label key={value} className={`${styles.reason} ${reason === value ? styles.chosen : ''}`}>
              <input type="radio" name="report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
              <span className={styles.reasonText}>
                <span className={styles.reasonLabel}>{label}</span>
                <span className={styles.muted}>{text}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {reason === 'cheating' && (
          <div className={styles.field}>
            <label htmlFor={ids.game} className={styles.label}>Which game?</label>
            <select id={ids.game} className={styles.select} value={gameId} onChange={(e) => setGameId(e.target.value)}>
              <option value="">Not sure, or more than one</option>
              {GAME_CHOICES.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}
            </select>
          </div>
        )}

        {reason && (
          <div className={styles.field}>
            <label htmlFor={ids.message} className={styles.label}>
              What happened?{!needsMessage && ' (optional)'}
            </label>
            <textarea
              id={ids.message}
              className={styles.textarea}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={REPORT_MAX}
              rows={4}
              required={needsMessage}
              placeholder={needsMessage ? 'What did they do, and where?' : 'Their record, the score, what looked wrong…'}
            />
          </div>
        )}

        <p className={styles.muted}>
          Only the developer reads reports, and {name} isn&rsquo;t told who sent one. Each one is looked into (see
          the <Link to="/terms" onClick={onClose}>Terms</Link> on fair play).
        </p>
        {state.error && <p className={styles.error} role="alert">{state.error}</p>}
        <div className={styles.actions}>
          <Button variant="outline" onClick={onClose} disabled={state.busy}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={!reason || (needsMessage && !message.trim()) || state.busy}>
            {state.busy ? 'Sending…' : 'Send report'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReportPlayer;
