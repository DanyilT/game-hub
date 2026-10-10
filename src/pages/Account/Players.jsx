import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PROFILE_COLUMNS } from '../../lib/account';
import { monthYear } from '../../lib/dates';
import Avatar from '../../components/common/Avatar/Avatar';
import Badge from '../../components/common/Badge/Badge';
import Button from '../../components/common/Button/Button';
import { RadioGroup, TextField } from '../../components/common/Field/Field';
import Message from '../../components/common/Message/Message';
import PageTitle from '../../components/common/PageTitle/PageTitle';
import Status from '../../components/common/Status/Status';
import styles from './Account.module.scss';

const PAGE_SIZE = 24;
const SORTS = [
  { id: 'newest', label: 'Newest', column: 'created_at', ascending: false },
  { id: 'name', label: 'A–Z', column: 'username', ascending: true },
];

// Only letters, digits, spaces, _ and -: anything else would mean something to the search filter
const cleanSearch = (text) => text.replace(/[^\p{L}\p{N} _-]/gu, '').trim();

/** Everyone with an account: /players. Search by username or display name; newest first, or A–Z. */
const Players = () => {
  const { isAvailable, profile: me } = useAuth();
  const [search, setSearch] = useState(''); // as typed
  const [term, setTerm] = useState(''); // what's searched for, a moment after typing stops
  const [sort, setSort] = useState('newest');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);
  // Tagged with the search it answers, so an older answer never replaces a newer one
  const [result, setResult] = useState({ query: null, term: '', players: [], total: 0, error: null });
  const query = `${sort}:${term}:${shown}:${attempt}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(cleanSearch(search));
      setShown(PAGE_SIZE);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!isAvailable) return undefined;
    let active = true;
    const { column, ascending } = SORTS.find(({ id }) => id === sort);
    let request = supabase
      .from('profiles')
      .select(PROFILE_COLUMNS, { count: 'exact' })
      .order(column, { ascending })
      .order('id') // ties in a fixed order, so "Show more" never repeats or skips anyone
      .range(0, shown - 1);
    if (term) {
      // * is PostgREST's wildcard; _ would be one too, so it's matched as itself
      const pattern = `*${term.replaceAll('_', '\\_')}*`;
      request = request.or(`username.ilike.${pattern},display_name.ilike.${pattern}`);
    }
    request.then(({ data, count, error }) => {
      if (!active) return;
      setResult((previous) => ({
        query: `${sort}:${term}:${shown}:${attempt}`,
        term,
        players: data ?? previous.players,
        total: count ?? previous.total,
        error,
      }));
    });
    return () => {
      active = false;
    };
  }, [isAvailable, sort, term, shown, attempt]);

  const page = (content) => (
    <div className={`${styles.page} ${styles.wide}`}>
      <PageTitle>Players</PageTitle>
      {content}
    </div>
  );

  if (!isAvailable) {
    return page(<section className={styles.card}><p>The list of players is coming soon.</p></section>);
  }

  const { players, total, error } = result;
  const loading = result.query !== query;
  let summary;
  if (result.query === null) summary = 'Loading players…';
  else if (total === 0) summary = result.term ? `No players match “${result.term}”.` : 'No players yet.';
  else if (result.term) summary = `${total} ${total === 1 ? 'player matches' : 'players match'} “${result.term}”`;
  else summary = `${total} ${total === 1 ? 'player' : 'players'}`;

  return page(
    <>
      <div className={styles.searchRow}>
        <TextField
          id="users-search"
          type="search"
          label="Search players by name"
          hideLabel
          className={styles.search}
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <RadioGroup
          variant="segmented"
          label="Order"
          hideLabel
          options={SORTS.map(({ id, label }) => ({ value: id, label }))}
          value={sort}
          onChange={(id) => {
            setSort(id);
            setShown(PAGE_SIZE);
          }}
        />
      </div>

      {error ? (
        <Status kind="error" onRetry={() => setAttempt((n) => n + 1)}>
          Couldn&rsquo;t load the players. Check your connection and try again.
        </Status>
      ) : (
        <Message aria-live="polite">{summary}</Message>
      )}

      {players.length > 0 && (
        <ul className={styles.playerGrid} aria-busy={loading}>
          {players.map((player) => {
            const name = player.display_name ?? player.username;
            return (
              <li key={player.id}>
                <Link to={`/u/${player.username}`} className={styles.playerCard}>
                  <Avatar url={player.avatar_url} name={name} size={48} />
                  <span className={styles.playerNames}>
                    {/* Only the name gets cut short ("…"), never the badge */}
                    <span className={styles.playerNameRow}>
                      <span className={styles.playerName}>{name}</span>
                      {player.id === me?.id && <Badge variant="outline" tone="accent">you</Badge>}
                    </span>
                    <span className={styles.playerMeta}>@{player.username}</span>
                    <span className={styles.playerMeta}>Joined {monthYear(player.created_at, 'short')}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!error && players.length < total && (
        <div className={styles.actions}>
          <Button variant="outline" onClick={() => setShown((n) => n + PAGE_SIZE)} disabled={loading}>
            {loading ? 'Loading…' : `Show more (${total - players.length} more)`}
          </Button>
        </div>
      )}
    </>,
  );
};

export default Players;
