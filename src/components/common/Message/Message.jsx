import styles from './Message.module.scss';

/**
 * A line or two of text that says something about what's around it: a note under a field or a card ("Only you see
 * it"), an error, a warning, a success. Small, in the easy-to-read font, in its tone's colour; links in it look like
 * links in any text.
 * @param {'note'|'error'|'warning'|'success'|'info'} [tone] - note is grey; an error is also announced to screen
 *   readers as it appears (role="alert"), unless `role` says otherwise (null for none)
 * @param {boolean} [boxed] - in a box of its tone's colour (a window's message at its top)
 * @param {boolean} [appear] - slides down into view as it appears (a form's message once there is one)
 * @param {string} [as] - its element: p (the default), span, div, li…
 */
const Message = ({ tone = 'note', boxed = false, appear = false, as: Element = 'p', className = '', role, children, ...rest }) => (
  <Element
    className={[styles.message, styles[tone], boxed && styles.boxed, appear && styles.appear, className].filter(Boolean).join(' ')}
    role={role === undefined ? (tone === 'error' ? 'alert' : undefined) : role || undefined}
    {...rest}
  >
    {children}
  </Element>
);

export default Message;
