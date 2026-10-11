import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PiCode } from 'react-icons/pi';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PROFILE_COLUMNS, noRolesYet, withRoles } from '../../lib/account';
import { monthYear } from '../../lib/dates';
import { gamesBy, isDeveloper } from '../../lib/roles';
import Avatar from '../../components/common/Avatar/Avatar';
import Badge from '../../components/common/Badge/Badge';
import Button from '../../components/common/Button/Button';
import { RadioGroup, TextField } from '../../components/common/Field/Field';
import Message from '../../components/common/Message/Message';
import PageTitle from '../../components/common/PageTitle/PageTitle';
import Status from '../../components/common/Status/Status';
import styles from './Account.module.scss';

const PAGE_SIZE = 24;

// Who the page lists: everyone (/players), or the developers (/developers), each from its own table (the developers
// view has their profiles, and when they became developers)
const KINDS = {
  players: {
    path: '/players',
    label: 'Players',
    table: 'profiles',
    columns: PROFILE_COLUMNS, // and their roles: developers among them get a badge (anyone may see who's a developer)
    newest: 'created_at',
    one: 'player',
    many: 'players',
  },
  developers: {
    path: '/developers',
    label: 'Developers',
    table: 'developers',
    columns: `${PROFILE_COLUMNS}, developer_since`,
    newest: 'developer_since',
    one: 'developer',
    many: 'developers',
  },
};

const SORTS = [
  { id: 'newest', label: 'Newest', ascending: false },
  { id: 'name', label: 'A–Z', column: 'username', ascending: true },
];

// Only letters, digits, spaces, _ and -: anything else would mean something to the search filter
const cleanSearch = (text) => text.replace(/[^\p{L}\p{N} _-]/gu, '').trim();

// Under a developer's names: how many games they've made on GameHub, or since when they're a developer
const developerLine = (developer) => {
  const made = gamesBy(developer.username).length;
  if (made > 0) return `${made} ${made === 1 ? 'game' : 'games'}`;
  return `Developer since ${monthYear(developer.developer_since, 'short')}`;
};

/**
 * Everyone with an account: /players, or only the developers: /developers (the switch beside the title). Search by
 * username or display name; newest first (for developers: newest developers), or A–Z.
 * @param {'players'|'developers'} [kind]
 */
const Players = ({ kind = 'players' }) => {
  const { isAvailable, profile: me } = useAuth();
  const navigate = useNavigate();
  const listing = KINDS[kind];
  const [search, setSearch] = useState(''); // as typed
  const [term, setTerm] = useState(''); // what's searched for, a moment after typing stops
  const [sort, setSort] = useState('newest');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);
  // Tagged with the search it answers, so an older answer never replaces a newer one
  const [result, setResult] = useState({ query: null, term: '', people: [], total: 0, error: null });
  const query = `${kind}:${sort}:${term}:${shown}:${attempt}`;

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
    const { table, columns, newest } = KINDS[kind];
    const { column = newest, ascending } = SORTS.find(({ id }) => id === sort);
    const build = (selected) => {
      let request = supabase
        .from(table)
        .select(selected, { count: 'exact' })
        .order(column, { ascending })
        .order('id') // ties in a fixed order, so "Show more" never repeats or skips anyone
        .range(0, shown - 1);
      if (term) {
        // * is PostgREST's wildcard; _ would be one too, so it's matched as itself
        const pattern = `*${term.replaceAll('_', '\\_')}*`;
        request = request.or(`username.ilike.${pattern},display_name.ilike.${pattern}`);
      }
      return request;
    };
    // A database without the roles migration yet: players without roles, and no developers
    const request = kind === 'players'
      ? withRoles((roles) => build(`${columns}${roles}`))
      : build(columns).then((answer) => (noRolesYet(answer.error) ? { data: [], count: 0, error: null } : answer));
    request.then(({ data, count, error }) => {
      if (!active) return;
      setResult((previous) => ({
        query: `${kind}:${sort}:${term}:${shown}:${attempt}`,
        term,
        // Another list's people never show under this one's switch
        people: data ?? (previous.query?.startsWith(`${kind}:`) ? previous.people : []),
        total: count ?? previous.total,
        error,
      }));
    });
    return () => {
      active = false;
    };
  }, [isAvailable, kind, sort, term, shown, attempt]);

  const switchTo = (next) => {
    setShown(PAGE_SIZE);
    navigate(KINDS[next].path, { replace: true, state: { keepScroll: true } });
  };

  const page = (content) => (
    <div className={`${styles.page} ${styles.wide}`}>
      <div className={styles.titleRow}>
        <PageTitle>Users</PageTitle>
        {isAvailable && (
          <RadioGroup
            variant="segmented"
            shape="rounded"
            label="Show"
            hideLabel
            options={Object.entries(KINDS).map(([value, { label }]) => ({ value, label }))}
            value={kind}
            onChange={switchTo}
          />
        )}
      </div>
      {content}
    </div>
  );

  if (!isAvailable) {
    return page(<section className={styles.card}><p>The list of players is coming soon.</p></section>);
  }

  const { people, total, error } = result;
  const loading = result.query !== query;
  const { one, many } = listing;
  let summary;
  if (result.query === null || !result.query.startsWith(`${kind}:`)) summary = `Loading ${many}…`;
  else if (total === 0) summary = result.term ? `No ${many} match “${result.term}”.` : `No ${many} yet.`;
  else if (result.term) summary = `${total} ${total === 1 ? `${one} matches` : `${many} match`} “${result.term}”`;
  else summary = `${total} ${total === 1 ? one : many}`;

  return page(
    <>
      <div className={styles.searchRow}>
        <TextField
          id="users-search"
          type="search"
          label={`Search ${many} by name`}
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
          Couldn&rsquo;t load the {many}. Check your connection and try again.
        </Status>
      ) : (
        <Message aria-live="polite">{summary}</Message>
      )}

      {people.length > 0 && (
        <ul className={styles.playerGrid} aria-busy={loading}>
          {people.map((person) => {
            const name = person.display_name ?? person.username;
            return (
              <li key={person.id}>
                <Link to={`/u/${person.username}`} className={styles.playerCard}>
                  <Avatar url={person.avatar_url} name={name} size={48} />
                  <span className={styles.playerNames}>
                    {/* Only the name gets cut short ("…"), never the badges */}
                    <span className={styles.playerNameRow}>
                      <span className={styles.playerName}>{name}</span>
                      {person.id === me?.id && <Badge variant="outline" tone="accent">you</Badge>}
                      {kind === 'players' && isDeveloper(person) && (
                        <Badge variant="soft" tone="accent" icon={PiCode} title="Developer">dev</Badge>
                      )}
                    </span>
                    <span className={styles.playerMeta}>@{person.username}</span>
                    <span className={styles.playerMeta}>
                      {kind === 'developers' ? developerLine(person) : `Joined ${monthYear(person.created_at, 'short')}`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!error && people.length < total && result.query?.startsWith(`${kind}:`) && (
        <div className={styles.actions}>
          <Button variant="outline" onClick={() => setShown((n) => n + PAGE_SIZE)} disabled={loading}>
            {loading ? 'Loading…' : `Show more (${total - people.length} more)`}
          </Button>
        </div>
      )}
    </>,
  );
};

export default Players;
