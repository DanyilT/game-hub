import { useEffect, useId, useRef, useState } from 'react';
import styles from './Menu.module.scss';

/**
 * A button that opens a short list of actions under it (the ⋯ on a profile). The arrow keys, Home and
 * End move through the actions; Escape, Tab or a click elsewhere closes it. Choosing an action puts
 * the focus back on the button first, so a window the action opens hands it back there.
 * @param {string} label - the button's name, for screen readers ("More for Dany")
 * @param {node} icon - what the button shows
 * @param {{ label: string, icon?: node, onSelect: function, danger?: boolean }[]} items
 */
const Menu = ({ label, icon, items }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const menuId = useId();

  const actions = () => [...(listRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];

  // Opening moves the focus to the first action; a click or the focus going elsewhere closes it
  useEffect(() => {
    if (!open) return undefined;
    actions()[0]?.focus();
    const away = (e) => {
      if (!buttonRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('focusin', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('focusin', away);
    };
  }, [open]);

  const onListKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    const list = actions();
    const at = list.indexOf(document.activeElement);
    const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    list[(next + list.length) % list.length]?.focus();
  };

  return (
    <div className={styles.menu}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {icon}
      </button>
      {open && (
        <ul ref={listRef} id={menuId} role="menu" aria-label={label} className={styles.list} onKeyDown={onListKeyDown}>
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Menu;
