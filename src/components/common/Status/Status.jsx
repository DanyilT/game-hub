import Button from '../Button/Button';
import Message from '../Message/Message';
import styles from './Status.module.scss';

/**
 * Where something isn't there to show yet: it's loading, there's none, or it couldn't load (with Try again).
 * @param {'loading'|'empty'|'error'} kind - loading is said politely to screen readers as it shows; an error is
 *   announced (role="alert")
 * @param {function} [onRetry] - with an error: a Try again button that calls it
 * @param {string} [retryLabel]
 * @param {React.ReactNode} [children] - what it says ("Loading…" when loading and nothing's given)
 */
const Status = ({ kind, onRetry, retryLabel = 'Try again', className = '', children }) => {
  if (kind === 'error') {
    return (
      <div className={[styles.status, className].filter(Boolean).join(' ')}>
        <Message tone="error">{children}</Message>
        {onRetry && <Button variant="outline" size="sm" font="secondary" onClick={onRetry}>{retryLabel}</Button>}
      </div>
    );
  }
  return (
    <Message className={className} aria-live={kind === 'loading' ? 'polite' : undefined}>
      {children ?? (kind === 'loading' ? 'Loading…' : null)}
    </Message>
  );
};

export default Status;
