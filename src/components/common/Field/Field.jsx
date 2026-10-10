import { useId } from 'react';
import Message from '../Message/Message';
import styles from './Field.module.scss';

// The form fields: a text field, a text box, a list to pick from, a checkbox, a switch and a set of choices. Each ties
// its label, hint and error to its control (ids, aria-describedby, aria-invalid), so screen readers hear them together.

const useFieldIds = (id) => {
  const own = useId();
  const base = id ?? own;
  return { id: base, hint: `${base}-hint`, error: `${base}-error` };
};

const join = (...names) => names.filter(Boolean).join(' ') || undefined;

/**
 * A field's frame: its label, the control (with what goes beside it), then its hint and its error.
 * @param {React.ReactNode} [hint] - under the control (in hintTone's colour: note, success, error)
 * @param {boolean} [live] - the hint changes as you type, and screen readers hear it (role="status")
 * @param {React.ReactNode} [error] - under it in red, announced, and the control is marked invalid
 * @param {React.ReactNode} [after] - beside the control (a button), going under it when there's no room
 * @param {'lg'|'md'} [size] - a one-line field's height: a Button's of the same size (48px, 40px); md also has a
 *   text box padded less
 */
const Frame = ({ ids, label, hideLabel, hint, hintTone = 'note', live, error, after, size = 'lg', className, children }) => (
  <div className={join(styles.field, styles[size], className)}>
    <label htmlFor={ids.id} className={hideLabel ? 'visually-hidden' : styles.label}>{label}</label>
    {after ? <div className={styles.row}>{children}{after}</div> : children}
    {hint && <Message id={ids.hint} tone={hintTone} role={live ? 'status' : null}>{hint}</Message>}
    {error && <Message id={ids.error} tone="error">{error}</Message>}
  </div>
);

// What every control gets from its frame
const controlProps = (ids, { hint, error, invalid }) => ({
  id: ids.id,
  'aria-describedby': join(hint && ids.hint, error && ids.error),
  'aria-invalid': error || invalid ? true : undefined,
});

/**
 * A one-line text field. Everything else (value, onChange, type, placeholder, maxLength, ref…) goes to its <input>.
 * @param {string} label
 * @param {'lg'|'md'} [size] - as tall as a Button of that size: lg (the default) for a form, md beside an md Button
 * @param {boolean} [hideLabel] - read by screen readers only (a search box whose placeholder says what it's for)
 * @param {React.ReactNode} [prefix] - shown at the start inside it (the @ of a username)
 * @param {boolean} [invalid] - marks it invalid without an error under it (the hint says why)
 */
export const TextField = ({ id, label, hideLabel, hint, hintTone, live, error, after, size, prefix, invalid, className, ...rest }) => {
  const ids = useFieldIds(id);
  const input = <input className={join(styles.input, prefix && styles.withPrefix)} {...controlProps(ids, { hint, error, invalid })} {...rest} />;
  return (
    <Frame {...{ ids, label, hideLabel, hint, hintTone, live, error, after, size, className }}>
      {prefix ? (
        <span className={styles.prefixed}>
          <span className={styles.prefix} aria-hidden="true">{prefix}</span>
          {input}
        </span>
      ) : input}
    </Frame>
  );
};

/** A text box for a few lines (a message). Its props are TextField's, without `prefix`; the rest go to its <textarea>. */
export const TextArea = ({ id, label, hideLabel, hint, hintTone, live, error, after, size, invalid, className, rows = 4, ...rest }) => {
  const ids = useFieldIds(id);
  return (
    <Frame {...{ ids, label, hideLabel, hint, hintTone, live, error, after, size, className }}>
      <textarea className={join(styles.input, styles.textarea)} rows={rows} {...controlProps(ids, { hint, error, invalid })} {...rest} />
    </Frame>
  );
};

/** A list to pick one from: its <option>s are its children. Its props are TextField's, without `prefix`. */
export const Select = ({ id, label, hideLabel, hint, hintTone, live, error, after, size, invalid, className, children, ...rest }) => {
  const ids = useFieldIds(id);
  return (
    <Frame {...{ ids, label, hideLabel, hint, hintTone, live, error, after, size, className }}>
      <select className={join(styles.input, styles.select)} {...controlProps(ids, { hint, error, invalid })} {...rest}>
        {children}
      </select>
    </Frame>
  );
};

// A checkbox or a switch, with its label beside it and its hint under the label
const Check = ({ id, label, hint, look, className, ...rest }) => {
  const ids = useFieldIds(id);
  return (
    <div className={join(styles.check, className)}>
      <input
        type="checkbox"
        id={ids.id}
        role={look === 'switch' ? 'switch' : undefined}
        className={look === 'switch' ? styles.switch : styles.box}
        aria-describedby={hint ? ids.hint : undefined}
        {...rest}
      />
      <span className={styles.checkText}>
        <label htmlFor={ids.id} className={look === 'switch' ? styles.label : styles.checkLabel}>{label}</label>
        {hint && <Message id={ids.hint}>{hint}</Message>}
      </span>
    </div>
  );
};

/**
 * A checkbox, with a sentence beside it ("Include my browser's name"). checked, onChange… go to its <input>.
 * @param {React.ReactNode} label
 * @param {React.ReactNode} [hint]
 */
export const Checkbox = (props) => <Check {...props} look="box" />;

/**
 * A setting that's on or off, drawn as a switch, named like a field ("Keep a history of what I play"), with what it
 * does under its name (hint). checked, onChange… go to its <input> (a checkbox with role="switch").
 */
export const Switch = (props) => <Check {...props} look="switch" />;

/**
 * One choice out of a few, as radio buttons (the arrow keys move through them):
 * - list: a row each, the radio then its label and hint (why you're reporting a player);
 * - cards: a card each, with a picture (the navigation style in Settings);
 * - segmented: side by side in one box, a word each (who sees what, the replay's speed, the order of a list).
 * @param {React.ReactNode} label - the group's name
 * @param {boolean} [hideLabel] - read by screen readers only
 * @param {React.ReactNode} [info] - beside the name, outside it (an ⓘ InfoTip)
 * @param {{ value: *, label: React.ReactNode, hint?: React.ReactNode, picture?: React.ReactNode, disabled?: boolean }[]} options
 * @param {*} value - the chosen option's value (none chosen: null)
 * @param {function} onChange - gets the chosen option's value
 * @param {'list'|'cards'|'segmented'} [variant]
 * @param {boolean} [inline] - the name and the choices on one row (a segmented one in a list of settings)
 * @param {'rounded'|'square'} [shape] - a segmented box's corners: rounded like the secondary-font buttons (the
 *   replay's speed, a list's order), or square like the cards around it (Settings)
 * @param {boolean} [disabled]
 * @param {string} [name] - the radios' name (one is made up otherwise)
 */
export const RadioGroup = ({
  label, hideLabel, info, options, value, onChange, variant = 'list', inline = false, shape = 'square', disabled = false, name, className,
}) => {
  const labelId = useId();
  const ownName = useId();
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-disabled={disabled || undefined}
      className={join(styles.choices, styles[variant], inline && styles.inline, shape === 'square' && styles.square, className)}
    >
      <span className={hideLabel && !info ? 'visually-hidden' : styles.choicesLabel}>
        <span id={labelId} className={hideLabel ? 'visually-hidden' : styles.label}>{label}</span>
        {info}
      </span>
      <span className={styles.options}>
        {options.map((option) => (
          <label key={String(option.value)} className={join(styles.option, value === option.value && styles.chosen)}>
            <input
              type="radio"
              name={name ?? ownName}
              value={String(option.value)}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled || option.disabled}
              className={variant === 'list' ? styles.radio : 'visually-hidden'}
            />
            {option.picture}
            {variant === 'segmented' ? option.label : (
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{option.label}</span>
                {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
              </span>
            )}
          </label>
        ))}
      </span>
    </div>
  );
};
