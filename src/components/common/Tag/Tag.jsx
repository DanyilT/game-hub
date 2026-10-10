import styles from './Tag.module.scss';

// What each kind is called, for its tooltip and for screen readers ("Genre: arcade")
const KIND_NAMES = { genre: 'Genre', easy: 'Difficulty', medium: 'Difficulty', hard: 'Difficulty', platform: 'Platform' };

/**
 * A game's tag, genre, difficulty or platform, as a small pill: the same everywhere (the games list's filters, the
 * cards, the game page). With `onClick` it's a button that can be picked (`selected`: aria-pressed); without, a label.
 * @param {'tag'|'genre'|'easy'|'medium'|'hard'|'platform'} [kind] - its colour; a plain tag has none
 * @param {boolean} [selected] - picked (a filter that's on)
 * @param {'sm'|'md'} [size]
 * @param {function} [onClick]
 */
const Tag = ({ kind = 'tag', selected, size = 'sm', onClick, className = '', children, ...rest }) => {
  const kindName = KIND_NAMES[kind];
  const props = {
    className: [styles.tag, styles[kind], styles[size], className].filter(Boolean).join(' '),
    title: kindName ? `${kindName}: ${children}` : undefined,
    ...rest,
  };
  const content = (
    <>
      {kindName && <span className="visually-hidden">{kindName}: </span>}
      {children}
    </>
  );
  if (!onClick) return <span {...props}>{content}</span>;
  return (
    <button type="button" aria-pressed={selected ?? undefined} onClick={onClick} {...props}>
      {content}
    </button>
  );
};

export default Tag;
