import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CiCircleChevLeft, CiCircleChevRight, CiMaximize1, CiMinimize1 } from 'react-icons/ci';
import {
  PiArrowsIn, PiDeviceMobile, PiDeviceMobileCamera, PiDeviceMobileSlash, PiHandGrabbing, PiHandPointing,
  PiHandSwipeRight, PiHandTap,
} from 'react-icons/pi';
import InfoTip from '../../../common/InfoTip/InfoTip';
import { GESTURES, KEYBOARD_KEYS, KEYBOARD_SIZE, MOUSE_BUTTONS } from '../../../../data/controls';
import styles from './GameControls.module.scss';

const KEYS_BY_NAME = new Map([...KEYBOARD_KEYS, ...MOUSE_BUTTONS].map((key) => [key.name, key]));
const GESTURE_LABELS = Object.fromEntries(GESTURES.map((gesture) => [gesture.name, gesture.label]));
const GESTURE_ICONS = {
  tap: PiHandTap,
  'double-tap': PiHandTap,
  'long-press': PiHandPointing,
  swipe: PiHandSwipeRight,
  drag: PiHandGrabbing,
  pinch: PiArrowsIn,
  move: PiDeviceMobileCamera,
};
const MOUSE_PARTS = { click: styles.leftButton, 'right-click': styles.rightButton, wheel: styles.wheel };

// The keyboard drawing: KEYBOARD_SIZE with half a key of margin all round, and keys a little apart
const MARGIN = 0.5;
const GAP = 0.1;
const BOARD = { width: KEYBOARD_SIZE.width + 2 * MARGIN, height: KEYBOARD_SIZE.height + 2 * MARGIN };
const percent = (units, of) => `${(units / of) * 100}%`;
const keyPosition = ({ x, y, width }) => ({
  left: percent(x + MARGIN + GAP / 2, BOARD.width),
  top: percent(y + MARGIN + GAP / 2, BOARD.height),
  width: percent(width - GAP, BOARD.width),
  height: percent(1 - GAP, BOARD.height),
});
// Tooltips of keys near the keyboard's sides line up with that side, instead of sticking out past it
const EDGE = 4; // key units
const tipAlign = ({ x, width }) => {
  if (x < EDGE) return 'start';
  return x + width > KEYBOARD_SIZE.width - EDGE ? 'end' : 'center';
};

// Each device's width ÷ height. Side by side they share one height (GameControls.module.scss).
const DEVICE_RATIOS = { keyboard: BOARD.width / BOARD.height, mouse: 3 / 5, phone: 9 / 16 };

/**
 * Reads the game's `keys` list into what each key (or mouse button) does: the lines its tooltip
 * shows ("Move up", or "Shift + Space: Flag the selected cell" for a chord), and the keys that
 * share a line with it, which light up together (W and ↑).
 * @param {{keys: string[], action?: string}[]} bindings - games.json `controls.keys`
 * @return {{lines: Map<string, string[]>, partners: Map<string, Set<string>>}} - by key name
 */
const describeKeys = (bindings = []) => {
  const lines = new Map();
  const partners = new Map();
  for (const { keys, action } of bindings) {
    const together = keys.flatMap((combo) => combo.split('+'));
    for (const combo of keys) {
      const parts = combo.split('+');
      const line = parts.length > 1 ? `${parts.map((part) => KEYS_BY_NAME.get(part).spoken).join(' + ')}: ${action}` : action;
      for (const part of parts) {
        if (!lines.has(part)) lines.set(part, []);
        if (action && !lines.get(part).includes(line)) lines.get(part).push(line);
        partners.set(part, new Set([...(partners.get(part) ?? []), ...together]));
      }
    }
  }
  return { lines, partners };
};

/**
 * A key, mouse button or gesture, drawn as a keycap. Hovering or focusing it (Tab, or a tap on a
 * phone) shows what it does. Screen readers get its name, with what it does as the description.
 */
const Control = ({ as: Tag = 'kbd', spoken, lines, active, linked, events, className, style, tipAt = 'start', children }) => {
  const tipId = useId();
  const tipClass = `${styles.tip} ${{ start: styles.tipStart, end: styles.tipEnd }[tipAt] ?? ''}`;
  return (
    <Tag
      className={`${styles.control} ${className} ${active ? styles.active : ''} ${linked ? styles.linked : ''}`}
      style={style}
      tabIndex={0}
      aria-describedby={lines.length > 0 ? tipId : undefined}
      {...events}
    >
      <span className={styles.face} aria-hidden="true">{children}</span>
      <span className="visually-hidden">{spoken}</span>
      {lines.length > 0 && (
        <span id={tipId} role="tooltip" className={active ? tipClass : 'visually-hidden'}>
          {lines.map((line) => <span key={line}>{line}</span>)}
        </span>
      )}
    </Tag>
  );
};

/**
 * A game's controls (games.json `controls`): its keys where they sit on a keyboard, its mouse
 * buttons on a mouse, and its gestures on a phone (or that it doesn't play on phones).
 * - small (the default, in the info column): the keyboard, and an arrow to show the phone instead
 * - expanded (under the game): every device, side by side at one height
 * @param {object} controls - { keys, mobile, touch }
 * @param {boolean} expanded - which of the two
 * @param {Function} onToggleExpanded - the maximize / minimize button
 * @param {Function} takeFocus - asked when this appears: true if that button just moved it here, so
 *   the button takes the focus again (not when the page moved it, e.g. for Full Width)
 */
const GameControls = ({ controls, expanded, onToggleExpanded, takeFocus }) => {
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const [showPhone, setShowPhone] = useState(false); // small panel: the phone instead of the keyboard
  const toggleRef = useRef(null);
  const active = hovered ?? focused; // whose tooltip shows
  const { lines, partners } = useMemo(() => describeKeys(controls.keys), [controls.keys]);

  useEffect(() => {
    if (takeFocus?.()) toggleRef.current?.focus();
  }, [takeFocus]);

  const keyboardKeys = KEYBOARD_KEYS.filter((key) => lines.has(key.name));
  const touch = controls.touch ?? [];
  const has = {
    keyboard: keyboardKeys.length > 0,
    mouse: MOUSE_BUTTONS.some((button) => lines.has(button.name)),
    phone: controls.mobile !== undefined,
  };
  // The small panel shows one device: the keyboard (the mouse if there's none), or the phone
  const main = ['keyboard', 'mouse'].find((device) => has[device]);
  const smallShows = showPhone || !main ? 'phone' : main;
  const devices = expanded
    ? ['keyboard', 'mouse', 'phone'].filter((device) => has[device])
    : [smallShows].filter((device) => has[device]);
  const canSwitch = !expanded && main && has.phone;
  const hasTips = [...lines.values()].some((keyLines) => keyLines.length > 0) || touch.some((gesture) => gesture.action);

  // What every control gets: its tooltip lines, whether it's the one shown or lit up with it, and the events
  const controlProps = (id, controlLines) => ({
    lines: controlLines,
    active: active === id,
    linked: active !== id && Boolean(partners.get(active)?.has(id)),
    events: {
      onMouseEnter: () => setHovered(id),
      onMouseLeave: () => setHovered(null),
      onFocus: () => setFocused(id),
      onBlur: () => setFocused(null),
    },
  });

  return (
    <section className={`${styles.controls} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.header}>
        <h2>Controls</h2>
        {hasTips && (
          <InfoTip label="How the controls work">
            Hover over a key or gesture, or tap it, to see what it does.
          </InfoTip>
        )}
        <div className={styles.headerButtons}>
          {canSwitch && (
            <button
              type="button"
              className={styles.headerButton}
              onClick={() => setShowPhone((shown) => !shown)}
              aria-label={showPhone ? `Show the ${main} controls` : 'Show the phone controls'}
              title={showPhone ? `${main === 'mouse' ? 'Mouse' : 'Keyboard'} controls` : 'Phone controls'}
            >
              {showPhone ? <CiCircleChevLeft aria-hidden="true" /> : <CiCircleChevRight aria-hidden="true" />}
            </button>
          )}
          <button
            ref={toggleRef}
            type="button"
            className={styles.headerButton}
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Show the controls small, in the info column' : 'Show every control, under the game'}
            title={expanded ? 'Minimize' : 'Maximize'}
          >
            {expanded ? <CiMinimize1 aria-hidden="true" /> : <CiMaximize1 aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        className={styles.devices}
        style={{
          '--row-ratio': devices.reduce((sum, device) => sum + DEVICE_RATIOS[device], 0),
          '--gaps': devices.length - 1,
        }}
      >
        {devices.includes('keyboard') && (
          <div
            className={styles.keyboard}
            style={{ '--ratio': DEVICE_RATIOS.keyboard }}
            role="group"
            aria-label="Keyboard"
          >
            {keyboardKeys.map((key) => (
              <Control
                key={key.name}
                spoken={key.spoken}
                className={styles.key}
                style={keyPosition(key)}
                tipAt={tipAlign(key)}
                {...controlProps(key.name, lines.get(key.name))}
              >
                {key.label}
              </Control>
            ))}
          </div>
        )}

        {devices.includes('mouse') && (
          <div className={styles.mouse} role="group" aria-label="Mouse">
            {MOUSE_BUTTONS.map((button) => (lines.has(button.name) ? (
              <Control
                key={button.name}
                spoken={button.spoken}
                className={`${styles.mousePart} ${MOUSE_PARTS[button.name]}`}
                {...controlProps(button.name, lines.get(button.name))}
              >
                {button.label}
              </Control>
            ) : (
              <span key={button.name} className={`${styles.mousePart} ${MOUSE_PARTS[button.name]} ${styles.unused}`} aria-hidden="true" />
            )))}
          </div>
        )}

        {devices.includes('phone') && (
          <div className={`${styles.phone} ${controls.mobile ? '' : styles.notOnPhones}`} role="group" aria-label="Phone">
            {!controls.mobile && (
              <p className={styles.phoneNote}>
                <PiDeviceMobileSlash aria-hidden="true" />
                Not made for phones
              </p>
            )}
            {controls.mobile && touch.length === 0 && (
              <p className={styles.phoneNote}>
                <PiDeviceMobile aria-hidden="true" />
                Plays on phones
              </p>
            )}
            {/* Keyed by position: a game can list the same gesture twice (e.g. two kinds of tap) */}
            {touch.map(({ gesture, action }, index) => {
              const Icon = GESTURE_ICONS[gesture];
              return (
                <Control
                  key={index}
                  as="span"
                  spoken={GESTURE_LABELS[gesture]}
                  className={styles.gesture}
                  {...controlProps(`touch-${index}`, action ? [action] : [])}
                >
                  <Icon />
                  {GESTURE_LABELS[gesture]}
                </Control>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default GameControls;
