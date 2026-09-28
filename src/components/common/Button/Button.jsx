import styles from './Button.module.scss';

/**
 * A button in the site's style. Renders a <button type="button"> by default; pass
 * `as={Link}` (or `as="a"`) for a link that looks like a button.
 * @param {string|function} as - element or component to render
 * @param {'primary'|'outline'|'danger'} variant - look
 */
const Button = ({ as: Component = 'button', variant = 'primary', className = '', ...props }) => {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  if (Component === 'button') return <button type="button" className={classes} {...props} />;
  return <Component className={classes} {...props} />;
};

export default Button;
