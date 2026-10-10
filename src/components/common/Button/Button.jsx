import { Link } from 'react-router';
import styles from './Button.module.scss';

// An icon given as a component (PiPlayFill) or as an element (<PiPlayFill />, <span>?</span>), sized with the label
const renderIcon = (icon) => {
  if (!icon) return null;
  const Icon = icon;
  return typeof icon === 'function' || icon.$$typeof === Symbol.for('react.forward_ref')
    ? <Icon className={styles.icon} aria-hidden="true" />
    : <span className={styles.icon} aria-hidden="true">{icon}</span>;
};

/**
 * The site's one button: every action, and every link that looks like a button.
 *
 * What it does:
 * - an action (the default): a <button type="button">, or `type="submit"` in a form;
 * - a link inside the site: `to` (React Router's Link; `state`, `replace`… are passed on);
 * - a link to another site: `href`, opened in a new tab (screen readers hear that; `arrow` also shows ↗), or in this one
 *   with `sameTab` (a link that opens an app on the device);
 * - anything else: `as` (e.g. a <label> for a file input).
 *
 * How it looks:
 * @param {'filled'|'outline'|'dashed'|'soft'|'glass'|'ghost'|'text'} [variant] - filled: the main action; outline:
 *   the others; dashed: a thin dashed edge, for a quieter extra (the game page's style details); soft: a quiet grey
 *   pill or box that takes its colour on hover; glass: see-through and blurred, over a picture or a game; ghost: no
 *   box until hovered (icon buttons in bars and windows); text: looks like a text link
 * @param {'primary'|'secondary'|'accent'|'danger'|'warning'|'success'|'info'|'neutral'} [tone] - its colour: the site's
 *   purple (primary), pink (secondary) or spring green (accent); red for deleting and removing (danger); yellow
 *   (warning: also a store to get an app from), green (success) and blue (info); or grey and white (neutral)
 * @param {'xs'|'sm'|'md'|'lg'} [size] - xs is for a small mark beside a heading (ⓘ)
 * @param {'square'|'rounded'|'round'} [shape] - square corners (the site's neon look), rounded (the softer corners of
 *   the first GameHub), or round: a pill, a circle around an icon. Unset, it's rounded with the secondary font and
 *   square otherwise.
 * @param {'primary'|'secondary'} [font] - Doto, or Chakra Petch (easier to read small). Unset, it's the text around it.
 * @param {function|object} [icon] - before the label: an icon component (PiPlayFill) or an element
 * @param {function|object} [iconEnd] - after the label (a chevron, an arrow)
 * @param {string} [label] - its name for screen readers (aria-label). With an icon alone it's also the tooltip, unless
 *   `title` gives another.
 * @param {boolean} [block] - as wide as its container
 * @param {boolean} [active] - shown as on, like a toggle with aria-pressed="true" (which is shown as on by itself)
 * @param {boolean} [arrow] - with `href`: a ↗ after the label
 * @param {boolean} [sameTab] - with `href`: opens it in this tab (an app link: the app opens, or its store's page)
 */
const Button = ({
  variant = 'filled',
  tone = 'primary',
  size = 'md',
  font,
  shape = 'square',
  icon,
  iconEnd,
  label,
  block = false,
  active = false,
  arrow = false,
  sameTab = false,
  to,
  href,
  as: Component,
  className = '',
  title,
  children,
  ...rest
}) => {
  const iconOnly = (children === undefined || children === null || children === false) && Boolean(icon || iconEnd);
  const classes = [
    styles.button,
    styles[variant],
    styles[tone],
    styles[size],
    shape !== 'square' && styles[shape],
    font && styles[`${font}Font`],
    iconOnly && styles.iconOnly,
    block && styles.block,
    active && styles.active,
    className,
  ].filter(Boolean).join(' ');
  const props = {
    className: classes,
    'aria-label': label,
    title: title ?? (iconOnly ? label : undefined),
    ...rest,
  };
  const content = (
    <>
      {renderIcon(icon)}
      {children}
      {renderIcon(iconEnd)}
    </>
  );

  if (Component) return <Component {...props}>{content}</Component>;
  if (to !== undefined) return <Link to={to} {...props}>{content}</Link>;
  if (href !== undefined && sameTab) return <a href={href} {...props}>{content}</a>;
  if (href !== undefined) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {content}
        {arrow && <span aria-hidden="true">↗</span>}
        <span className="visually-hidden"> (opens in a new tab)</span>
      </a>
    );
  }
  return <button type="button" {...props}>{content}</button>;
};

export default Button;
