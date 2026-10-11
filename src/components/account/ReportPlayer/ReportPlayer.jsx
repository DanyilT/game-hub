import { useState } from 'react';
import { Link } from 'react-router';
import { games, getEmbedUrl } from '../../../data/games';
import { describeReportError, REPORT_MAX, REPORT_REASONS, reportPlayer } from '../../../lib/reports';
import Button from '../../common/Button/Button';
import { RadioGroup, Select, TextArea } from '../../common/Field/Field';
import Message from '../../common/Message/Message';
import Modal from '../../common/Modal/Modal';
import styles from './ReportPlayer.module.scss';

// The games a report can name (the ones played here), by title
const GAME_CHOICES = games.filter(getEmbedUrl).sort((a, b) => a.title.localeCompare(b.title));

/**
 * "Report player", from the ⋯ on their profile: why (cheating, or something else), the game, and what happened. It
 * goes to GameHub's admins only.
 * @param {object} player - their profile
 * @param {function} onDone - sent
 * @param {function} onClose
 */
const ReportPlayer = ({ player, onDone, onClose }) => {
  const [reason, setReason] = useState(null);
  const [gameId, setGameId] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState({ busy: false, error: null });
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

        <RadioGroup
          label="What’s wrong?"
          name="report-reason"
          options={REPORT_REASONS.map(({ value, label, text }) => ({ value, label, hint: text }))}
          value={reason}
          onChange={setReason}
        />

        {reason === 'cheating' && (
          <Select label="Which game?" value={gameId} onChange={(e) => setGameId(e.target.value)}>
            <option value="">Not sure, or more than one</option>
            {GAME_CHOICES.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}
          </Select>
        )}

        {reason && (
          <TextArea
            label={`What happened?${needsMessage ? '' : ' (optional)'}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={REPORT_MAX}
            rows={4}
            required={needsMessage}
            placeholder={needsMessage ? 'What did they do, and where?' : 'Their record, the score, what looked wrong…'}
          />
        )}

        <Message>
          Only GameHub&rsquo;s admins read reports, and {name} isn&rsquo;t told who sent one. Each one is looked into (see
          the <Link to="/terms" onClick={onClose}>Terms</Link> on fair play).
        </Message>
        {state.error && <Message tone="error">{state.error}</Message>}
        <div className={styles.actions}>
          <Button variant="outline" onClick={onClose} disabled={state.busy}>Cancel</Button>
          <Button type="submit" tone="danger" disabled={!reason || (needsMessage && !message.trim()) || state.busy}>
            {state.busy ? 'Sending…' : 'Send report'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReportPlayer;
