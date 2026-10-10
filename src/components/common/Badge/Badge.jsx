import styles from './Badge.module.scss';

// An icon given as a component (PiCloudCheck) or as an element
const renderIcon = (icon) => {
  if (!icon) return null;
  const Icon = icon;
  return typeof icon === 'function' || icon.$$typeof === Symbol.for('react.forward_ref')
    ? <Icon className={styles.icon} aria-hidden="true" />
    : <span className={styles.icon} aria-hidden="true">{icon}</span>;
};

/**
 * A small mark on or beside something: how many are waiting, a dot that says something is, or a word ("soon", "you").
 * Not a button: it says something, and does nothing.
 * @param {'count'|'dot'|'outline'|'soft'} [variant] - count: a number in a filled pill; dot: just a dot (put what it
 *   means in a visually hidden text nearby); outline: a word in a pill with an edge; soft: a word on a dark see-through
 *   pill (over a picture)
 * @param {'secondary'|'primary'|'accent'|'danger'|'neutral'} [tone] - pink (the default: something waiting), purple,
 *   green, red or grey
 * @param {'sm'|'md'} [size] - md for a word that stands on its own (Friends, Blocked)
 * @param {function|object} [icon] - before the text
 */
const Badge = ({ variant = 'count', tone = 'secondary', size = 'sm', icon, className = '', children, ...rest }) => (
  <span className={[styles.badge, styles[variant], styles[tone], styles[size], className].filter(Boolean).join(' ')} {...rest}>
    {variant !== 'dot' && (
      <>
        {renderIcon(icon)}
        {children}
      </>
    )}
  </span>
);

export default Badge;
