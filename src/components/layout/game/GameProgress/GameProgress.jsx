import { useId, useState } from 'react';
import {
  PiArrowCounterClockwise, PiCheckCircleFill, PiClockFill, PiCloudSlashFill, PiPauseFill, PiPlayFill, PiStarFill, PiXCircleFill,
} from 'react-icons/pi';
import { playTime, timeAgo } from '../../../../lib/activity';
import { clockTime, formatValue } from '../../../../lib/gameStatus';
import { usePlayed } from '../../../../lib/playTime';
import { runSeconds } from '../../../../lib/runs';
import Button from '../../../common/Button/Button';
import styles from './GameProgress.module.scss';

const SPEEDS = [1, 2, 4];
const SHOWN_RUNS = 3; // the newest; the rest behind "Show all"
const OUTCOMES = { won: 'Won', lost: 'Lost' }; // a game that's simply over says nothing

// How a signed-in player's run did on GameHub's server (src/lib/checks.js), as a badge with a note
const CHECKS = {
  checked: {
    Icon: PiCheckCircleFill,
    text: 'Counts',
    note: 'GameHub played it again on its server: it’s saved to your account.',
  },
  waiting: {
    Icon: PiClockFill,
    text: 'Not checked yet',
    note: 'It goes to GameHub’s server to be checked once you’re online.',
  },
  refused: {
    Icon: PiXCircleFill,
    text: 'Didn’t count',
    note: 'It didn’t play out the same on GameHub’s server, or its ticket couldn’t be used.',
  },
  unchecked: {
    Icon: PiCloudSlashFill,
    text: 'This device only',
    note: 'Played without a ticket (offline, after they ran out): it isn’t saved to your account.',
  },
};

/** A run's result, as the list shows it: "Score 40", "Level Expert · Time 2:05" (once checked, the server's) */
const RunResult = ({ run, check }) => {
  const checked = check?.state === 'checked';
  const outcome = checked ? check.outcome : run.outcome;
  return (
    <span className={styles.runResult}>
      {OUTCOMES[outcome] && <span className={`${styles.outcome} ${styles[outcome]}`}>{OUTCOMES[outcome]}</span>}
      {(checked ? check.result : run.result).map((item) => (
        <span key={item.label} className={styles.resultItem}>
          <span className={styles.resultLabel}>{item.label}</span> {formatValue(item)}
        </span>
      ))}
    </span>
  );
};

/** A badge on a run: its icon, with its label sliding out of it on hover (or while the row has the keyboard's focus) */
const Badge = ({ Icon, label, note = null, className }) => (
  <span className={`${styles.badge} ${className}`}>
    <Icon aria-hidden="true" />
    <span className={styles.badgeLabel}><span>{label}</span></span>
    {note && <span className="visually-hidden">: {note}</span>}
  </span>
);

/**
 * Which of the kept runs holds the player's record, on each level: a signed-in player's is the one GameHub's server
 * names (my_records: its ticket); a guest's, the newest one the game itself said beat their best
 * @return {Set<number>} - their keys
 */
const recordKeys = (runs, records, signedIn) => {
  if (signedIn) {
    const tickets = new Set((records ?? []).map((record) => record.ticket_id));
    return new Set(runs.filter(({ run, check }) => check?.state === 'checked' && tickets.has(run.ticket)).map(({ key }) => key));
  }
  const levels = new Set();
  return new Set(runs.filter(({ run, check }) => {
    if (check || !run.best || levels.has(run.mode)) return false;
    levels.add(run.mode); // runs are newest first
    return true;
  }).map(({ key }) => key));
};

/** A checked record, as the panel lists it: its level (if the game has levels) and what it gave */
const recordRows = (record) => {
  const items = Array.isArray(record.result) ? record.result.filter((item) => item && typeof item.label === 'string') : [];
  const level = items.find((item) => item.label === 'Level');
  if (!level) return items.map((item) => ({ label: item.label, value: formatValue(item) }));
  return [{ label: formatValue(level), value: items.filter((item) => item !== level).map(formatValue).join(' · ') }];
};

/** The replay being watched: how far it's got, its controls, and the way back to the game */
const ReplayBar = ({ replay, state, onControl, onAgain, onStop }) => {
  const { run, endedAt, check } = replay.row;
  const status = state?.state ?? 'loading';
  const length = state?.length ?? runSeconds(run) * 1000;
  const position = state?.position ?? 0;
  const running = status === 'playing' || status === 'paused';
  const titles = {
    loading: 'Loading the replay…',
    playing: 'Watching a replay',
    paused: 'Watching a replay',
    ended: 'Replay finished',
    error: "This replay can't be played",
  };

  return (
    <div className={styles.replayBar} role="group" aria-label="Replay">
      <p className={styles.replayTitle}>
        <span className={`${styles.replayDot} ${status === 'playing' ? styles.live : ''}`} aria-hidden="true" />
        <span role="status">{titles[status]}</span>
        <span className={styles.replayOf}>
          <RunResult run={run} check={check} />
          <span className={styles.runWhen}>{timeAgo(endedAt)}</span>
        </span>
      </p>
      <div className={styles.replayControls}>
        {status === 'ended' ? (
          <Button variant="outline" className={styles.again} onClick={onAgain}>
            <PiArrowCounterClockwise aria-hidden="true" />
            Watch again
          </Button>
        ) : (
          <button
            type="button"
            className={styles.playPause}
            onClick={() => onControl({ action: status === 'paused' ? 'resume' : 'pause' })}
            disabled={!running}
            aria-label={status === 'paused' ? 'Play' : 'Pause'}
            title={status === 'paused' ? 'Play' : 'Pause'}
          >
            {status === 'paused' ? <PiPlayFill aria-hidden="true" /> : <PiPauseFill aria-hidden="true" />}
          </button>
        )}
        <div className={styles.speeds} role="group" aria-label="Speed">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={replay.speed === speed}
              onClick={() => onControl({ action: 'speed', speed })}
              disabled={status === 'ended' || status === 'error'}
            >
              {speed}×
            </button>
          ))}
        </div>
        <div className={styles.progress}>
          <progress max={Math.max(length, 1)} value={Math.min(position, length)} aria-label="How far the replay has got" />
          <span className={styles.times}>{clockTime(position / 1000)} / {clockTime(length / 1000)}</span>
        </div>
        <Button className={styles.back} onClick={onStop}>Back to the game</Button>
      </div>
    </div>
  );
};

/** The player's runs of the game, newest first, to watch again */
const Replays = ({ runs, records, replay, onWatch, signedIn }) => {
  const [showAll, setShowAll] = useState(false);
  const headingId = useId();
  const extraId = useId();
  const watching = replay?.row.key ?? null;
  const record = recordKeys(runs, records, signedIn);

  const row = ({ key, endedAt, run, check }) => {
    const badge = check && CHECKS[check.state];
    return (
      <li key={key}>
        <button
          type="button"
          className={styles.run}
          onClick={() => onWatch({ key, endedAt, run, check })}
          aria-current={watching === key ? 'true' : undefined}
          title={badge?.note}
        >
          <span className={styles.runPlay} aria-hidden="true"><PiPlayFill /></span>
          <span className="visually-hidden">Watch again: </span>
          <RunResult run={run} check={check} />
          <span className={styles.runMeta}>
            {badge && (
              <Badge Icon={badge.Icon} label={badge.text} note={badge.note} className={`${styles.check} ${styles[check.state]}`} />
            )}
            {record.has(key) && <Badge Icon={PiStarFill} label={signedIn ? 'Record' : 'Best'} className={styles.best} />}
            {/* How long it lasted, unless its result says (a game's own clock: Minesweeper's time) */}
            {!run.result.some((item) => item.format === 'time') && <span>{clockTime(runSeconds(run))}</span>}
            <span className={styles.runWhen}>{timeAgo(endedAt)}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className={styles.replays} aria-labelledby={headingId}>
      <h3 id={headingId}>Replays</h3>
      {runs.length === 0 ? (
        <p className={styles.note}>Finish a game, and you can watch it again here.</p>
      ) : (
        <>
          <ul className={styles.runList}>{runs.slice(0, SHOWN_RUNS).map(row)}</ul>
          {runs.length > SHOWN_RUNS && (
            <>
              <div id={extraId} className={`${styles.moreRuns} ${showAll ? styles.open : ''}`}>
                <ul className={styles.runList}>{runs.slice(SHOWN_RUNS).map(row)}</ul>
              </div>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => setShowAll((shown) => !shown)}
                aria-expanded={showAll}
                aria-controls={extraId}
              >
                {showAll ? 'Show fewer' : `Show all ${runs.length}`}
              </button>
            </>
          )}
        </>
      )}
      <p className={styles.note}>
        {signedIn
          ? 'Replays are kept in this browser: the moves you made, not a video. Games played on a ticket also go to GameHub’s server, which plays them again: only those count in your account.'
          : 'Replays are kept in this browser: the moves you made, not a video.'}
      </p>
    </section>
  );
};

/**
 * The panel under the game: what the game says about the player's progress (the score now, their best, and the rest
 * behind More), how long they've played it, and their runs to watch again. Shown once there's something in it.
 * @param {object|null} status - the game's numbers (useGameBridge's gameStatus: { main, more, ongoing })
 * @param {object} played - the time played (usePlayTime)
 * @param {object[]|null} runs - the player's runs of the game (useRuns), null when there are none to show
 * @param {object[]|null} records - the signed-in player's checked records in the game (useRecords)
 * @param {boolean} canReplay - the game records runs (gamehub.js version 3)
 * @param {boolean} signedIn
 * @param {object|null} replay - the replay being watched: { row, speed, key }
 * @param {object|null} replayState - how it's going (useGameBridge's replayState)
 * @param {function} onWatch - watches a run: gets its { key, endedAt, run }
 * @param {function} onControlReplay - pauses, resumes or changes the speed (useGameBridge's controlReplay)
 * @param {function} onReplayAgain - watches the same run again from the start
 * @param {function} onStopReplay - back to the game
 */
const GameProgress = ({
  status, played: playedTime, runs, records, canReplay, signedIn, replay, replayState, onWatch, onControlReplay,
  onReplayAgain, onStopReplay,
}) => {
  const played = usePlayed(playedTime);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();

  const main = status?.main ?? [];
  const sections = status?.more ?? [];
  const showPlayed = played !== null && played.seconds > 0;
  const showRecords = signedIn && records?.length > 0;
  const hasMore = sections.length > 0 || showPlayed || showRecords;
  const showReplays = runs !== null && (canReplay || runs.length > 0);
  if (!replay && main.length === 0 && !showPlayed && !showReplays) return null;

  return (
    <section className={styles.panel} aria-label="Your progress">
      {replay && (
        <ReplayBar
          replay={replay}
          state={replayState}
          onControl={onControlReplay}
          onAgain={onReplayAgain}
          onStop={onStopReplay}
        />
      )}

      {(main.length > 0 || showPlayed) && (
        <div className={styles.summary}>
          <dl className={styles.stats}>
            {main.map((item) => (
              <div key={item.label} className={styles.stat}>
                <dt>{item.label}</dt>
                <dd>{formatValue(item)}</dd>
              </div>
            ))}
            {showPlayed && (
              <div className={styles.stat}>
                <dt>Played</dt>
                <dd>{playTime(played.seconds)}</dd>
              </div>
            )}
          </dl>
          {hasMore && (
            <button
              type="button"
              className={styles.moreButton}
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              aria-controls={moreId}
            >
              More <span aria-hidden="true">▼</span>
            </button>
          )}
        </div>
      )}

      {hasMore && (
        <div id={moreId} className={`${styles.more} ${moreOpen ? styles.open : ''}`}>
          <div className={styles.moreSections}>
            {sections.map((section, i) => (
              // Sections have no id, and their titles can repeat or be empty
              <section key={i} className={styles.moreSection}>
                {section.title && <h3>{section.title}</h3>}
                <dl>
                  {section.items.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{formatValue(item)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {showRecords && (
              <section className={styles.moreSection}>
                <h3>Checked records</h3>
                <dl>
                  {records.flatMap((record) => recordRows(record).map((rowItem) => (
                    <div key={`${record.mode ?? ''}:${rowItem.label}`}>
                      <dt>{rowItem.label}</dt>
                      <dd>{rowItem.value}</dd>
                    </div>
                  )))}
                </dl>
                <p className={styles.note}>Your best games that GameHub&rsquo;s server played again: only these count.</p>
              </section>
            )}
            {showPlayed && (
              <section className={styles.moreSection}>
                <h3>Play time</h3>
                <dl>
                  <div>
                    <dt>Total</dt>
                    <dd>{playTime(played.seconds)}</dd>
                  </div>
                  {played.plays > 0 && (
                    <div>
                      <dt>Times played</dt>
                      <dd>{played.plays.toLocaleString('en-GB')}</dd>
                    </div>
                  )}
                </dl>
                <p className={styles.note}>
                  {played.where === 'account'
                    ? 'Counted while you play, in your account.'
                    : 'Counted while you play, in this browser only.'}
                </p>
              </section>
            )}
          </div>
        </div>
      )}

      {showReplays && <Replays runs={runs} records={records} replay={replay} onWatch={onWatch} signedIn={signedIn} />}
    </section>
  );
};

export default GameProgress;
