import { useEffect, useId, useRef, useState } from 'react';
import Button from '../Button/Button';
import Popover from '../Popover/Popover';
import styles from './Menu.module.scss';

/**
 * A button that opens a short list of actions under it (the ⋯ on a profile, Friends beside it). The arrow keys, Home
 * and End move through the actions; Escape, Tab or a click elsewhere closes it. Choosing an action puts the focus back
 * on the button first, so a window the action opens hands it back there.
 * @param {string} label - the list's name for screen readers ("More for Dany"); also the button's, when it's an icon
 *   alone
 * @param {node} icon - what the button shows (before its text, if it has one)
 * @param {string} [text] - a word on the button ("Friends"), with a ▼ after it
 * @param {object} [look] - how the button looks: Button's variant and tone (an outline by default)
 * @param {boolean} [disabled]
 * @param {{ label: string, icon?: node, onSelect: function, danger?: boolean }[]} items
 */
const Menu = ({ label, icon, text, look, disabled = false, items }) => {
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
      <Button
        ref={buttonRef}
        variant="outline"
        {...look}
        icon={icon}
        iconEnd={text ? <span className={styles.chevron}>▼</span> : undefined}
        label={text ? undefined : label}
        disabled={disabled}
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
        {text}
      </Button>
      <Popover
        open={open}
        align="end"
        as="ul"
        ref={listRef}
        id={menuId}
        role="menu"
        aria-label={label}
        className={styles.list}
        onKeyDown={onListKeyDown}
      >
        {items.map((item) => (
          <li key={item.label} role="none">
            <Button
              variant="ghost"
              tone={item.danger ? 'danger' : 'neutral'}
              font="secondary"
              block
              icon={item.icon}
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
                item.onSelect();
              }}
            >
              {item.label}
            </Button>
          </li>
        ))}
      </Popover>
    </div>
  );
};

export default Menu;
