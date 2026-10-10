import { useId } from 'react';
import {
  PiArrowCounterClockwise, PiCheckCircleFill, PiClockFill, PiCloudSlashFill, PiHourglassMediumFill, PiPauseFill, PiPlayFill,
  PiStarFill, PiXCircleFill,
} from 'react-icons/pi';
import { playTime, timeAgo } from '../../../../lib/activity';
import { clockTime, formatValue } from '../../../../lib/gameStatus';
import { usePlayed } from '../../../../lib/playTime';
import { runSeconds } from '../../../../lib/runs';
import { useFit } from '../../../../lib/useFit';
import Button from '../../../common/Button/Button';
import { Collapsible, DisclosureButton, useDisclosure } from '../../../common/Disclosure/Disclosure';
import { RadioGroup } from '../../../common/Field/Field';
import InfoTip from '../../../common/InfoTip/InfoTip';
import Message from '../../../common/Message/Message';
import styles from './GameProgress.module.scss';

const SPEEDS = [1, 2, 4].map((speed) => ({ value: speed, label: `${speed}×` }));
const SHOWN_RUNS = 3; // the newest; the rest behind "Show all"
const DAY = 24 * 60 * 60 * 1000;
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
const RunResult = ({ run, check, id }) => {
  const checked = check?.state === 'checked';
  const outcome = checked ? check.outcome : run.outcome;
  return (
    <span id={id} className={styles.runResult}>
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
  <span className={`${styles.badge} ${className}`} title={note ?? undefined}>
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
          <Button variant="outline" size="sm" font="secondary" icon={PiArrowCounterClockwise} onClick={onAgain}>
            Watch again
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            icon={status === 'paused' ? PiPlayFill : PiPauseFill}
            label={status === 'paused' ? 'Play' : 'Pause'}
            onClick={() => onControl({ action: status === 'paused' ? 'resume' : 'pause' })}
            disabled={!running}
          />
        )}
        <RadioGroup
          variant="segmented"
          label="Speed"
          hideLabel
          options={SPEEDS}
          value={replay.speed}
          onChange={(speed) => onControl({ action: 'speed', speed })}
          disabled={status === 'ended' || status === 'error'}
        />
        <div className={styles.progress}>
          <progress max={Math.max(length, 1)} value={Math.min(position, length)} aria-label="How far the replay has got" />
          <span className={styles.times}>{clockTime(position / 1000)} / {clockTime(length / 1000)}</span>
        </div>
        <Button size="sm" font="secondary" className={styles.back} onClick={onStop}>Back to the game</Button>
      </div>
    </div>
  );
};

/**
 * How long a run's moves are still kept on GameHub's server, in days (at least 1: they go at the first tidy-up after
 * that), as a countdown next to its check
 */
const KeptFor = ({ until }) => {
  const days = Math.max(1, Math.ceil((until - Date.now()) / DAY));
  const text = `Its replay is kept on GameHub’s server for ${days} more ${days === 1 ? 'day' : 'days'}, in any browser.`;
  return (
    <span className={styles.keptFor} title={text}>
      <PiHourglassMediumFill aria-hidden="true" />
      <span aria-hidden="true">{days}d</span>
      <span className="visually-hidden">{text}</span>
    </span>
  );
};

/**
 * One run in the list: its play button (the one way to watch it), its result, then its badges (its record star, its
 * check and, kept on the server, for how long), length and when
 * @param {object} row - { key, endedAt, run, check, keepUntil? } (src/lib/runs.js, src/lib/checks.js)
 * @param {boolean} watching - it's the one being watched
 * @param {boolean} isRecord - it holds the player's record on its level
 */
const RunRow = ({ row, watching, isRecord, signedIn, onWatch }) => {
  const { endedAt, run, check, keepUntil } = row;
  const badge = check && CHECKS[check.state];
  const id = useId();
  return (
    <li className={styles.run} aria-current={watching ? 'true' : undefined}>
      <Button
        size="sm"
        shape="round"
        icon={PiPlayFill}
        label="Watch again"
        onClick={() => onWatch(row)}
        aria-describedby={`${id}-result ${id}-when`}
      />
      {/* The result, with the record's star at the right of its line: there too when the rest goes under it */}
      <span className={styles.runTop}>
        <RunResult run={run} check={check} id={`${id}-result`} />
        {isRecord && (
          <Badge
            Icon={PiStarFill}
            label={signedIn ? 'Record' : 'Best'}
            note={signedIn ? 'Your record on this level: kept on GameHub’s server while it is one.' : null}
            className={styles.best}
          />
        )}
      </span>
      <span className={styles.runMeta}>
        {keepUntil && <KeptFor until={keepUntil} />}
        {badge && <Badge Icon={badge.Icon} label={badge.text} note={badge.note} className={`${styles.check} ${styles[check.state]}`} />}
        {/* How long it lasted, unless its result says (a game's own clock: Minesweeper's time) */}
        {!run.result.some((item) => item.format === 'time') && <span>{clockTime(runSeconds(run))}</span>}
        <span id={`${id}-when`} className={styles.runWhen}>{timeAgo(endedAt)}</span>
      </span>
    </li>
  );
};

/** The player's runs of the game, to watch again: their record (the best) first, then the rest, newest first */
const Replays = ({ runs, records, replay, onWatch, signedIn }) => {
  const all = useDisclosure();
  const headingId = useId();
  const watching = replay?.row.key ?? null;
  const record = recordKeys(runs, records, signedIn);
  // The record (the best: a star) first, then the rest, newest first
  const ordered = [...runs.filter((item) => record.has(item.key)), ...runs.filter((item) => !record.has(item.key))];

  const row = (item) => (
    <RunRow
      key={item.key}
      row={item}
      watching={watching === item.key}
      isRecord={record.has(item.key)}
      signedIn={signedIn}
      onWatch={onWatch}
    />
  );

  return (
    <section className={styles.replays} aria-labelledby={headingId}>
      <div className={styles.replaysHeader}>
        <h2>Your runs</h2>
        <InfoTip label="How your runs are kept">
          {signedIn
            ? 'Runs are kept in this browser: the moves you made, not a video. Games played on a ticket also go to GameHub’s server, which plays them again: only those count in your account, and you can watch them in any browser for 30 days (your records for as long as they are ones).'
            : 'Runs are kept in this browser: the moves you made, not a video.'}
        </InfoTip>
      </div>
      {runs.length === 0 ? (
        <Message>Finish a game, and you can watch it again here.</Message>
      ) : (
        <>
          <ul className={styles.runList}>{ordered.slice(0, SHOWN_RUNS).map(row)}</ul>
          {runs.length > SHOWN_RUNS && (
            <>
              <Collapsible gap="sm" {...all.panelProps}>
                <ul className={styles.runList}>{ordered.slice(SHOWN_RUNS).map(row)}</ul>
              </Collapsible>
              <Button variant="text" size="sm" font="secondary" className={styles.showAll} {...all.buttonProps}>
                {all.open ? 'Show fewer' : `Show all ${runs.length}`}
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
};

/**
 * The panel under the game: what the game says about the player's progress (the score now, their best, and the rest
 * behind More), how long they've played it, and their runs to watch again. Shown once there's something in it.
 * @param {object|null} status - the game's numbers (useGameBridge's gameStatus: { main, more, ongoing })
 * @param {object} played - the time played (usePlayTime)
 * @param {object[]|null} runs - the player's runs of the game (useRuns, with the server's: mergeRuns), null when there
 *   are none to show
 * @param {object[]|null} records - the signed-in player's checked records in the game (useRecords)
 * @param {boolean} canReplay - the game records runs (gamehub.js version 3)
 * @param {boolean} signedIn
 * @param {object|null} replay - the replay being watched: { row, speed, key }
 * @param {object|null} replayState - how it's going (useGameBridge's replayState)
 * @param {function} onWatch - watches a run: gets its row ({ key, endedAt, run, check }, and for a run kept on the
 *   server, serverId and keepUntil; its run has no inputs when this browser doesn't keep it)
 * @param {function} onControlReplay - pauses, resumes or changes the speed (useGameBridge's controlReplay)
 * @param {function} onReplayAgain - watches the same run again from the start
 * @param {function} onStopReplay - back to the game
 */
const GameProgress = ({
  status, played: playedTime, runs, records, canReplay, signedIn, replay, replayState, onWatch, onControlReplay,
  onReplayAgain, onStopReplay,
}) => {
  const played = usePlayed(playedTime);
  const more = useDisclosure();
  // More beside the numbers; if it doesn't fit, its ▼ alone; if that doesn't either, More under them
  const [summaryLook, summaryRef] = useFit(['', styles.compact, '']);

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
        <div ref={summaryRef} className={`${styles.summary} ${summaryLook}`}>
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
            <DisclosureButton font="secondary" className={styles.moreButton} {...more.buttonProps}>
              <span className={styles.moreLabel}>More</span>
            </DisclosureButton>
          )}
        </div>
      )}

      {hasMore && (
        <Collapsible {...more.panelProps}>
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
                <Message>Your best games that GameHub&rsquo;s server played again: only these count.</Message>
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
                <Message>
                  {played.where === 'account'
                    ? 'Counted while you play, in your account.'
                    : 'Counted while you play, in this browser only.'}
                </Message>
              </section>
            )}
          </div>
        </Collapsible>
      )}

      {showReplays && <Replays runs={runs} records={records} replay={replay} onWatch={onWatch} signedIn={signedIn} />}
    </section>
  );
};

export default GameProgress;
