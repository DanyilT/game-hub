import { useRef, useState } from 'react';
import { PiLockSimple } from 'react-icons/pi';
import Badge from '../Badge/Badge';
import Popover from '../Popover/Popover';
import styles from './Tabs.module.scss';

// The lock on a private tab's icon: pointing at it says what it means (screen readers hear it as the tab's description)
const PrivateLock = ({ id }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.lock} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <PiLockSimple className={styles.lockIcon} aria-hidden="true" />
      <Popover open={open} keepMounted as="span" id={id} role="tooltip" className={styles.tip}>
        Private: only you see this tab
      </Popover>
    </span>
  );
};

/**
 * A row of tabs (with the usual keys: the arrows, Home and End), each with an icon, and a count or a waiting count
 * after its name. A private tab has a lock on its icon. Choosing one shows its panel, which the page draws (an element
 * with role="tabpanel", id `panelId`, labelled by the chosen tab: `${idPrefix}-${tab.id}`).
 * @param {string} label - the row's name
 * @param {string} idPrefix - for the tabs' ids
 * @param {{ id: string, label: string, icon: function, count?: number, alert?: { count: number, text: string },
 *   private?: boolean }[]} tabs - alert: how many are waiting (a pink count), and what they are, for screen readers
 * @param {string} selected - the id of the tab that's showing
 * @param {function} onSelect - gets a tab's id
 * @param {string} panelId - the panel the tabs show
 * @param {boolean} [small] - sub-tabs, inside a tab's panel: smaller, as pills
 */
const Tabs = ({ label, idPrefix, tabs, selected, onSelect, panelId, small = false }) => {
  const refs = useRef({});
  const onKeyDown = (e) => {
    const at = tabs.findIndex(({ id }) => id === selected);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const { id } = tabs[(next + tabs.length) % tabs.length];
    onSelect(id);
    refs.current[id]?.focus();
  };
  return (
    <div className={`${styles.tabs} ${small ? styles.small : ''}`} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map(({ id, label: tabLabel, icon: Icon, count, alert, private: isPrivate }) => (
        <button
          key={id}
          ref={(element) => { refs.current[id] = element; }}
          type="button"
          role="tab"
          id={`${idPrefix}-${id}`}
          aria-selected={selected === id}
          aria-controls={panelId}
          aria-describedby={isPrivate ? `${idPrefix}-${id}-private` : undefined}
          tabIndex={selected === id ? 0 : -1}
          className={`${styles.tab} ${selected === id ? styles.active : ''}`}
          onClick={() => onSelect(id)}
        >
          <span className={styles.icon}>
            <Icon aria-hidden="true" />
            {isPrivate && <PrivateLock id={`${idPrefix}-${id}-private`} />}
          </span>
          {tabLabel}
          {count !== undefined && <Badge tone="neutral">{count}</Badge>}
          {alert?.count > 0 && (
            <Badge>{alert.count}<span className="visually-hidden"> {alert.text}</span></Badge>
          )}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
