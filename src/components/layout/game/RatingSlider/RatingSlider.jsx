import { useEffect, useRef, useState } from 'react';
import { CiFaceFrown, CiFaceMeh, CiFaceSmile } from 'react-icons/ci';
import styles from './RatingSlider.module.scss';

/** The five ratings, worst first: what each one says, and its face */
export const SCORES = [
  { score: 1, label: 'Not for me', Face: CiFaceFrown },
  { score: 2, label: 'Meh', Face: CiFaceFrown },
  { score: 3, label: "It's OK", Face: CiFaceMeh },
  { score: 4, label: 'Good', Face: CiFaceSmile },
  { score: 5, label: 'Love it!', Face: CiFaceSmile },
];

const clamp = (score) => Math.min(5, Math.max(1, score));

// Reaching 1 or 5 sends a burst of faces out of the handle: sad ones falling, happy ones flying up
const BURST_FACES = 7;
const BURST_TIME = 1100; // ms, the longest a face is in the air (with its delay)

/** Where each face of a burst goes: spread across the top half, each a little different */
const makeBurst = (id, score, at) => ({
  id,
  score,
  at,
  faces: Array.from({ length: BURST_FACES }, (_, i) => {
    const angle = ((-165 + (150 * i) / (BURST_FACES - 1) + (Math.random() * 20 - 10)) * Math.PI) / 180;
    const distance = 30 + Math.random() * 30;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      fall: 30 + Math.random() * 30, // sad faces drop this far below the rail as they fade
      rotate: Math.random() * 90 - 45,
      delay: Math.random() * 120,
      scale: 0.7 + Math.random() * 0.5,
    };
  }),
});

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A 1–5 rating as a slider: a gold bar on a starry rail, and a square handle with a face that frowns,
 * shrugs or smiles. Dragging slides it freely and it settles on the nearest score when let go; a tap
 * jumps there. Arrow keys, Home and End move it one score at a time. Reaching 1 or 5 sends out a
 * burst of sad or happy faces.
 * @param {number|null} value - the score shown (1–5), or null before one is picked
 * @param {function} onChange - gets the new score when the player lets go, taps, or presses a key
 * @param {string} label - the slider's name for screen readers
 * @param {boolean} compact - smaller, without the caption (lists of ratings)
 * @param {boolean} disabled
 */
const RatingSlider = ({ value, onChange, label = 'Your rating', compact = false, disabled = false }) => {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const [drag, setDrag] = useState(null); // where the handle is while it's being dragged (1–5, not rounded)
  const [bursts, setBursts] = useState([]);
  const lastBurstRef = useRef(0);
  const shownRef = useRef(null); // the score the handle last showed, to notice it reaching 1 or 5
  const timersRef = useRef(new Set());

  const position = drag ?? value ?? 3;
  const shown = Math.round(position);
  const { Face, label: scoreLabel } = SCORES[shown - 1];
  const unset = value === null && drag === null;

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // The handle moved to `score` (at `at`, 1–5) because of the player: a burst if that's 1 or 5
  const reached = (score, at) => {
    const previous = shownRef.current ?? value;
    shownRef.current = score;
    if (score === previous || (score !== 1 && score !== 5) || prefersReducedMotion()) return;
    const id = ++lastBurstRef.current;
    setBursts((current) => [...current.slice(-3), makeBurst(id, score, at)]);
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      setBursts((current) => current.filter((burst) => burst.id !== id));
    }, BURST_TIME);
    timersRef.current.add(timer);
  };

  // The score under the pointer. The handle's centre stays inside the rail, like a native slider's.
  const positionAt = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const inset = rect.height / 2;
    const ratio = (clientX - rect.left - inset) / (rect.width - 2 * inset);
    return 1 + 4 * Math.min(1, Math.max(0, ratio));
  };

  const startDrag = (e) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); // no text selection, and the focus stays on the slider
    e.currentTarget.focus({ focusVisible: false }); // arrow keys work next, without a focus ring for a pointer
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    shownRef.current = value ?? 3;
    const at = positionAt(e.clientX);
    setDrag(at);
    reached(Math.round(at), at);
  };

  const moveDrag = (e) => {
    if (!draggingRef.current) return;
    const at = positionAt(e.clientX);
    setDrag(at);
    if (Math.round(at) !== shownRef.current) reached(Math.round(at), at);
  };

  const endDrag = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const score = Math.round(positionAt(e.clientX));
    setDrag(null);
    shownRef.current = null;
    if (score !== value) onChange(score);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    const from = value ?? 3;
    const next = {
      ArrowLeft: from - 1, ArrowDown: from - 1, ArrowRight: from + 1, ArrowUp: from + 1,
      PageDown: from - 1, PageUp: from + 1, Home: 1, End: 5,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    // Before a score is picked, the first press picks the middle one it's showing
    const score = value === null ? 3 : clamp(next);
    if (score === value) return;
    shownRef.current = value;
    reached(score, score);
    shownRef.current = null;
    onChange(score);
  };

  const classes = [
    styles.slider,
    compact && styles.compact,
    unset && styles.unset,
    disabled && styles.disabled,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ '--position': position }}>
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? 'Not rated yet' : `${value} out of 5: ${SCORES[value - 1].label}`}
        aria-disabled={disabled || undefined}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <span className={styles.rail} aria-hidden="true" />
        {SCORES.map(({ score }) => (
          <span key={score} className={styles.stop} style={{ '--stop': score }} aria-hidden="true" />
        ))}
        <span className={styles.fill} aria-hidden="true" />
        <span
          className={`${styles.handle} ${drag !== null ? styles.dragging : ''} ${shown === 5 ? styles.love : ''} ${shown === 1 ? styles.grumpy : ''}`}
          aria-hidden="true"
        >
          {/* A new face each score, so it pops in */}
          <Face key={shown} className={styles.face} />
        </span>
        {bursts.map(({ id, score, at, faces }) => (
          <span key={id} className={styles.burst} style={{ '--at': at }} aria-hidden="true">
            {faces.map((face, i) => {
              const BurstFace = score === 1 ? CiFaceFrown : CiFaceSmile;
              return (
                <BurstFace
                  // A burst's faces never change or move, so their place is their key
                  key={i}
                  className={`${styles.burstFace} ${score === 1 ? styles.sad : styles.happy}`}
                  style={{
                    '--dx': `${face.dx}px`,
                    '--dy': `${face.dy}px`,
                    '--fall': `${face.fall}px`,
                    '--rotate': `${face.rotate}deg`,
                    '--delay': `${face.delay}ms`,
                    '--scale': face.scale,
                  }}
                />
              );
            })}
          </span>
        ))}
      </div>
      {!compact && (
        <p className={styles.caption} aria-hidden="true">
          {unset ? 'Slide to rate' : <><strong>{shown}</strong> / 5 · {scoreLabel}</>}
        </p>
      )}
    </div>
  );
};

export default RatingSlider;
