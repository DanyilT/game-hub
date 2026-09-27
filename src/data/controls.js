// What a game's `controls` (src/data/games.json) can name: keyboard keys, mouse buttons and phone
// gestures. The game page draws them from here, and scripts/check-catalog.mjs checks names against it.

/**
 * A row of keys, left to right. Each key is [name, label, width, spoken]: `name` as games.json writes
 * it, `label` as the keycap shows it (the name in capitals by default), `width` in key units
 * (1 = a letter key), and `spoken` for screen readers (the label by default).
 */
const row = (y, startX, keys) => {
  let x = startX;
  return keys.map(([name, label = name.toUpperCase(), width = 1, spoken = label]) => {
    const key = { name, label, spoken, x, y, width };
    x += width;
    return key;
  });
};

// A compact keyboard (Esc where ` usually is), plus the navigation keys and arrows of a full one
export const KEYBOARD_KEYS = [
  ...row(0, 0, [
    ['esc', 'Esc', 1, 'Escape'], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0'],
    ['-', '-', 1, 'Minus'], ['=', '=', 1, 'Equals'], ['backspace', '⌫', 2, 'Backspace'],
  ]),
  ...row(1, 0, [
    ['tab', 'Tab', 1.5], ['q'], ['w'], ['e'], ['r'], ['t'], ['y'], ['u'], ['i'], ['o'], ['p'],
    ['[', '[', 1, 'Left bracket'], [']', ']', 1, 'Right bracket'], ['\\', '\\', 1.5, 'Backslash'],
  ]),
  ...row(2, 0, [
    ['capslock', 'Caps', 1.75, 'Caps Lock'], ['a'], ['s'], ['d'], ['f'], ['g'], ['h'], ['j'], ['k'], ['l'],
    [';', ';', 1, 'Semicolon'], ["'", "'", 1, 'Quote'], ['enter', 'Enter', 2.25],
  ]),
  ...row(3, 0, [
    ['shift', 'Shift', 2.25], ['z'], ['x'], ['c'], ['v'], ['b'], ['n'], ['m'],
    [',', ',', 1, 'Comma'], ['.', '.', 1, 'Period'], ['/', '/', 1, 'Slash'],
  ]),
  ...row(4, 0, [['ctrl', 'Ctrl', 1.25, 'Control'], ['meta', 'Meta', 1.25], ['alt', 'Alt', 1.25], ['space', 'Space', 6.25]]),
  ...row(0, 15.25, [['insert', 'Ins', 1, 'Insert'], ['home', 'Home'], ['pageup', 'PgUp', 1, 'Page Up']]),
  ...row(1, 15.25, [['delete', 'Del', 1, 'Delete'], ['end', 'End'], ['pagedown', 'PgDn', 1, 'Page Down']]),
  ...row(3, 16.25, [['up', '↑', 1, 'Up arrow']]),
  ...row(4, 15.25, [['left', '←', 1, 'Left arrow'], ['down', '↓', 1, 'Down arrow'], ['right', '→', 1, 'Right arrow']]),
];

// The keyboard's size in key units
export const KEYBOARD_SIZE = { width: 18.25, height: 5 };

export const MOUSE_BUTTONS = [
  { name: 'click', label: 'L', spoken: 'Left click' },
  { name: 'right-click', label: 'R', spoken: 'Right click' },
  { name: 'wheel', label: '', spoken: 'Mouse wheel' },
];

export const GESTURES = [
  { name: 'tap', label: 'Tap' },
  { name: 'double-tap', label: 'Double tap' },
  { name: 'long-press', label: 'Long press' },
  { name: 'swipe', label: 'Swipe' },
  { name: 'drag', label: 'Drag' },
  { name: 'pinch', label: 'Pinch' },
  { name: 'move', label: 'Move the phone' },
];
