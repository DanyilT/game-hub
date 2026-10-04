import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { PiDotsThreeVertical, PiFlag, PiProhibit, PiUserCheck, PiUserMinus, PiUserPlus } from 'react-icons/pi';
import { useAuth } from '../../contexts/AuthContext';
import { useLibrary } from '../../contexts/LibraryContext';
import { gamesById } from '../../data/games';
import { supabase } from '../../lib/supabase';
import { USERNAME_PATTERN } from '../../lib/account';
import { AUDIENCES, fetchMyPrivacy, fetchPlayed, playTime, timeAgo, usePlayingNow } from '../../lib/activity';
import { blockPlayer, fetchIsBlocked, unblockPlayer } from '../../lib/blocks';
import { askToConfirm } from '../../lib/confirm';
import { monthYear } from '../../lib/dates';
import {
  acceptFriendRequest, describeFriendError, fetchFriends, fetchFriendState, fetchMyRequests, removeFriend,
  sendFriendRequest,
} from '../../lib/friends';
import { showToast } from '../../lib/toast';
import ReportPlayer from '../../components/account/ReportPlayer/ReportPlayer';
import Avatar from '../../components/common/Avatar/Avatar';
import Button from '../../components/common/Button/Button';
import Menu from '../../components/common/Menu/Menu';
import RatingSlider from '../../components/layout/game/RatingSlider/RatingSlider';
import styles from './Account.module.scss';

const PUBLIC_COLUMNS = 'id, username, display_name, avatar_url, created_at';

/**
 * Runs something that loads, keeping { loaded, data, error } for it. `reload` runs it again.
 * @param {function|null} load - returns a Promise of the data (null: nothing to load)
 * @param {Array} deps - when to load again
 */
const useLoad = (load, deps) => {
  const [state, setState] = useState({ key: null, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const key = `${deps.join(':')}:${attempt}`;
  useEffect(() => {
    if (!load) return undefined;
    let active = true;
    load().then(
      (data) => active && setState({ key, data, error: null }),
      (error) => active && setState({ key, data: null, error }),
    );
    return () => {
      active = false;
    };
  }, [key]); // not on `load`, a new function each render: the key says when to load again
  const loaded = state.key !== null && state.key.startsWith(`${deps.join(':')}:`);
  return { loaded, data: loaded ? state.data : null, error: loaded ? state.error : null, reload: () => setAttempt((n) => n + 1) };
};

/** The games in a list of ids (newest first), as tiles linking to each game's page, each with an optional line under its title */
const GameTiles = ({ entries, empty }) => {
  const known = entries.filter(({ gameId }) => gamesById.has(gameId));
  if (known.length === 0) return <p className={styles.muted}>{empty}</p>;
  return (
    <ul className={styles.gameTiles}>
      {known.map(({ gameId, meta }) => {
        const game = gamesById.get(gameId);
        return (
          <li key={gameId}>
            <Link to={`/g/${gameId}`} className={styles.gameTile}>
              {game.thumb
                ? <img src={game.thumb} alt="" className={styles.gameTileImage} loading="lazy" />
                : <span className={`${styles.gameTileImage} ${styles.gameTileFallback}`} aria-hidden="true" />}
              <span className={styles.gameTileTitle}>
                {game.iconUrl && <img src={game.iconUrl} alt="" className={styles.gameTileIcon} />}
                {game.title}
              </span>
              {meta && <span className={styles.gameTileMeta}>{meta}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

// Newest first, from a Map of game id → when (the library's favorites and bookmarks)
const newestFirst = (map) => [...map].map(([gameId, at]) => ({ gameId, at })).sort((a, b) => b.at.localeCompare(a.at));

/** What a player is playing now, as a line: "Playing Snake" */
const PlayingNow = ({ gameId }) => {
  const game = gamesById.get(gameId);
  return game && (
    <span className={styles.playingNow}>
      <span className={styles.liveDot} aria-hidden="true" />
      Playing {game.title}
    </span>
  );
};

/** A player card linking to their profile (friends, requests), with what they're playing now if that's known */
const PlayerCard = ({ player, meta, playing, children }) => {
  const name = player.display_name ?? player.username;
  return (
    <div className={styles.playerRow}>
      <Link to={`/u/${player.username}`} className={styles.playerCard}>
        <Avatar url={player.avatar_url} name={name} size={48} />
        <span className={styles.playerNames}>
          <span className={styles.playerName}>{name}</span>
          <span className={styles.playerMeta}>@{player.username}</span>
          {playing ? <PlayingNow gameId={playing.game_id} /> : meta && <span className={styles.playerMeta}>{meta}</span>}
        </span>
      </Link>
      {children && <div className={styles.playerActions}>{children}</div>}
    </div>
  );
};

/**
 * Add friend / Request sent / Accept / Friends, on another player's profile. Signed out, "Add
 * friend" opens the sign-in window.
 * @param {object} player - their profile
 * @param {function} onChange - after a change (their friends list may have changed)
 */
const FriendButton = ({ player, onChange }) => {
  const { user, openSignIn } = useAuth();
  const { refreshRequests } = useLibrary();
  const me = user?.id ?? null;
  const status = useLoad(me ? () => fetchFriendState(me, player.id) : null, [me, player.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!me) {
    return <Button variant="outline" onClick={openSignIn}><PiUserPlus aria-hidden="true" />Add friend</Button>;
  }
  if (!status.loaded) return null;

  // `question`: askToConfirm's, for actions that need a yes first
  const run = async (action, question) => {
    if (question && !(await askToConfirm(question))) return;
    setBusy(true);
    setError(null);
    try {
      await action(player.id);
      status.reload();
      refreshRequests();
      onChange();
    } catch (err) {
      setError(describeFriendError(err));
    } finally {
      setBusy(false);
    }
  };

  const name = player.display_name ?? player.username;
  let buttons;
  switch (status.data) {
    case 'friends':
      buttons = (
        <>
          <span className={styles.friendsBadge}><PiUserCheck aria-hidden="true" />Friends</span>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(removeFriend, {
              title: 'Remove friend?',
              message: `${name} comes off your friends list, and you come off theirs. You can send a new request any time.`,
              confirmLabel: 'Remove',
              danger: true,
            })}
          >
            <PiUserMinus aria-hidden="true" />Remove
          </Button>
        </>
      );
      break;
    case 'outgoing':
      buttons = (
        <>
          <span className={styles.friendsBadge}>Request sent</span>
          <Button variant="outline" disabled={busy} onClick={() => run(removeFriend)}>Cancel request</Button>
        </>
      );
      break;
    case 'incoming':
      buttons = (
        <>
          <Button variant="outline" disabled={busy} onClick={() => run(removeFriend)}>Decline</Button>
          <Button disabled={busy} onClick={() => run(acceptFriendRequest)}><PiUserCheck aria-hidden="true" />Accept request</Button>
        </>
      );
      break;
    default:
      buttons = <Button disabled={busy} onClick={() => run(sendFriendRequest)}><PiUserPlus aria-hidden="true" />Add friend</Button>;
  }

  return (
    <div className={styles.friendButton}>
      <div className={styles.actions}>{buttons}</div>
      {(error || status.error) && (
        <p className={styles.error} role="alert">{error ?? "Couldn't check whether you're friends."}</p>
      )}
    </div>
  );
};

/** In place of the friend buttons, on the profile of a player you've blocked */
const BlockedNote = ({ onUnblock }) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className={styles.friendButton}>
      <div className={styles.actions}>
        <span className={styles.blockedBadge}><PiProhibit aria-hidden="true" />Blocked</span>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onUnblock();
            setBusy(false);
          }}
        >
          Unblock
        </Button>
      </div>
      <p className={styles.muted}>
        You aren&rsquo;t friends, neither of you can add the other, and you don&rsquo;t see each other&rsquo;s
        activity. They aren&rsquo;t told.
      </p>
    </div>
  );
};

/**
 * The ⋯ on another player's profile: block or unblock them, and report them to the developer. Signed out, each opens
 * the sign-in window.
 * @param {object} player - their profile
 * @param {boolean} blocked - you've blocked them
 * @param {function} onBlock - asks, then blocks them
 * @param {function} onUnblock
 */
const PlayerActions = ({ player, blocked, onBlock, onUnblock }) => {
  const { user, openSignIn } = useAuth();
  const [reporting, setReporting] = useState(false);
  const name = player.display_name ?? player.username;
  const signedIn = Boolean(user);

  const items = [
    blocked
      ? { label: 'Unblock', icon: <PiProhibit aria-hidden="true" />, onSelect: signedIn ? onUnblock : openSignIn }
      : { label: 'Block', icon: <PiProhibit aria-hidden="true" />, onSelect: signedIn ? onBlock : openSignIn, danger: true },
    { label: 'Report…', icon: <PiFlag aria-hidden="true" />, onSelect: signedIn ? () => setReporting(true) : openSignIn, danger: true },
  ];

  return (
    <>
      <Menu label={`More for ${name}`} icon={<PiDotsThreeVertical aria-hidden="true" />} items={items} />
      {reporting && (
        <ReportPlayer
          player={player}
          onClose={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            showToast(`Thanks. Your report on ${name} went to the developer.`);
          }}
        />
      )}
    </>
  );
};

/** Your ratings, each with a small slider that saves a moment after it's moved */
const RatingRow = ({ game, score }) => {
  const { rateGame } = useLibrary();
  const [draft, setDraft] = useState(null);
  const [state, setState] = useState(null); // 'saving', 'saved' or 'error'
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (value) => {
    setDraft(value);
    setState(null);
    clearTimeout(timer.current);
    // A moment after the last change, so pressing an arrow key a few times makes one save
    timer.current = setTimeout(async () => {
      setState('saving');
      try {
        await rateGame(game.id, value);
        setDraft(null);
        setState('saved');
      } catch {
        setState('error');
      }
    }, 500);
  };

  const remove = async () => {
    const yes = await askToConfirm({
      title: 'Remove rating?',
      message: `Your rating comes off ${game.title}’s average. You can rate it again any time.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!yes) return;
    clearTimeout(timer.current);
    setState('saving');
    try {
      await rateGame(game.id, null);
    } catch {
      setState('error');
    }
  };

  return (
    <li className={styles.ratingRow}>
      <Link to={`/g/${game.id}`} className={styles.ratingGame}>
        {game.iconUrl && <img src={game.iconUrl} alt="" className={styles.gameTileIcon} />}
        {game.title}
      </Link>
      <div className={styles.ratingSlider}>
        <RatingSlider value={draft ?? score} onChange={save} label={`Your rating for ${game.title}`} compact />
      </div>
      <span className={`${styles.ratingState} ${state === 'error' ? styles.error : ''}`} role="status">
        {{ saving: 'Saving…', saved: 'Saved', error: "Couldn't save" }[state] ?? `${draft ?? score} / 5`}
      </span>
      <button type="button" className={styles.textButton} onClick={remove}>Remove</button>
    </li>
  );
};

const Ratings = () => {
  const { ratings } = useLibrary();
  const rows = [...ratings]
    .filter(([gameId]) => gamesById.has(gameId))
    .sort(([, a], [, b]) => b.updated_at.localeCompare(a.updated_at));
  if (rows.length === 0) {
    return <p className={styles.muted}>You haven&rsquo;t rated any games yet. Rate one from its page.</p>;
  }
  return (
    <>
      <p className={styles.muted}>Only you see your ratings. Everyone sees each game&rsquo;s average.</p>
      <ul className={styles.ratingList}>
        {rows.map(([gameId, { score }]) => <RatingRow key={gameId} game={gamesById.get(gameId)} score={score} />)}
      </ul>
    </>
  );
};

/** Your friend requests: the ones waiting for your answer, then the ones you sent */
const Requests = ({ onChange }) => {
  const { refreshRequests } = useLibrary();
  const requests = useLoad(fetchMyRequests, ['requests']);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  if (!requests.loaded) return <p className={styles.muted}>Loading…</p>;
  if (requests.error) {
    return (
      <div className={styles.actions} role="alert">
        <span className={styles.error}>Couldn&rsquo;t load your requests.</span>
        <Button variant="outline" onClick={requests.reload}>Try again</Button>
      </div>
    );
  }

  const run = async (action, id) => {
    setBusy(id);
    setError(null);
    try {
      await action(id);
      requests.reload();
      refreshRequests();
      onChange();
    } catch (err) {
      setError(describeFriendError(err));
    } finally {
      setBusy(null);
    }
  };

  const incoming = requests.data.filter((r) => r.direction === 'incoming');
  const outgoing = requests.data.filter((r) => r.direction === 'outgoing');
  if (incoming.length + outgoing.length === 0) {
    return <p className={styles.muted}>No friend requests. Add friends from their profiles.</p>;
  }

  return (
    <>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {incoming.length > 0 && (
        <>
          <h3 className={styles.subTitle}>Waiting for your answer</h3>
          <ul className={styles.playerList}>
            {incoming.map((player) => (
              <li key={player.id}>
                <PlayerCard player={player} meta={`Asked ${monthYear(player.sent_at, 'short')}`}>
                  <Button variant="outline" disabled={busy === player.id} onClick={() => run(removeFriend, player.id)}>Decline</Button>
                  <Button disabled={busy === player.id} onClick={() => run(acceptFriendRequest, player.id)}>Accept</Button>
                </PlayerCard>
              </li>
            ))}
          </ul>
        </>
      )}
      {outgoing.length > 0 && (
        <>
          <h3 className={styles.subTitle}>Sent by you</h3>
          <ul className={styles.playerList}>
            {outgoing.map((player) => (
              <li key={player.id}>
                <PlayerCard player={player} meta="Waiting for an answer">
                  <Button variant="outline" disabled={busy === player.id} onClick={() => run(removeFriend, player.id)}>Cancel</Button>
                </PlayerCard>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};

const Friends = ({ friends, isMe }) => {
  const playing = usePlayingNow(friends.data?.map((friend) => friend.id) ?? []);
  if (!friends.loaded) return <p className={styles.muted}>Loading…</p>;
  if (friends.error) {
    return (
      <div className={styles.actions} role="alert">
        <span className={styles.error}>Couldn&rsquo;t load the friends list.</span>
        <Button variant="outline" onClick={friends.reload}>Try again</Button>
      </div>
    );
  }
  if (friends.data.length === 0) {
    return <p className={styles.muted}>{isMe ? 'No friends yet. Add friends from their profiles.' : 'No friends yet.'}</p>;
  }
  return (
    <ul className={styles.playerList}>
      {friends.data.map((friend) => (
        <li key={friend.id}>
          <PlayerCard player={friend} meta={`Friends since ${monthYear(friend.since, 'short')}`} playing={playing.get(friend.id)} />
        </li>
      ))}
    </ul>
  );
};

/** The games a player has played for a minute or more: when last, how long in all, how many plays */
const Played = ({ played, isMe, privacy }) => {
  if (!played.loaded) return <p className={styles.muted}>Loading…</p>;
  if (played.error) return <p className={styles.error} role="alert">Couldn&rsquo;t load the games played.</p>;
  const audience = privacy.data && AUDIENCES.find(({ value }) => value === privacy.data.show_played);
  return (
    <>
      {isMe && (
        <p className={styles.muted}>
          Games you&rsquo;ve played for a minute or more.
          {audience && ` ${audience.value === 'nobody' ? 'Only you see them' : `${audience.label} can see them`}`}
          {' '}(<Link to="/settings" className={styles.textLink}>Settings → Privacy</Link>).
        </p>
      )}
      <GameTiles
        entries={played.data.map((row) => ({
          gameId: row.game_id,
          meta: [timeAgo(row.last_played), `${playTime(row.seconds)} played`, row.plays > 1 && `${row.plays} plays`]
            .filter(Boolean).join(' · '),
        }))}
        empty={isMe ? 'Games you play for a minute or more show here.' : 'Nothing played yet.'}
      />
    </>
  );
};

/** Another player's favorites (yours come from the library, which is kept up to date) */
const useFavorites = (player, isMe) => useLoad(
  isMe ? null : async () => {
    const { data, error } = await supabase.from('favorites').select('game_id, created_at')
      .eq('user_id', player.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map((row) => ({ gameId: row.game_id, at: row.created_at }));
  },
  [player.id],
);

/**
 * The tabs under the profile header: public ones for everyone, private ones on your own
 * @param {boolean} blocked - you've blocked this player: no friend buttons, but Unblock
 * @param {function} onUnblock
 */
const ProfileTabs = ({ player, isMe, blocked, onUnblock }) => {
  const library = useLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const theirFavorites = useFavorites(player, isMe);
  const friends = useLoad(() => fetchFriends(player.id), [player.id]);
  const played = useLoad(() => fetchPlayed(player.id), [player.id]);
  const myPrivacy = useLoad(isMe ? fetchMyPrivacy : null, [player.id, isMe]);
  const tabRefs = useRef({});

  const favorites = isMe ? { loaded: library.loaded, data: newestFirst(library.favorites) } : theirFavorites;
  const tabs = [
    { id: 'favorites', label: 'Favorites', count: favorites.data?.length },
    // Another player's only when they let you see some (yours always)
    ...(isMe || played.data?.length ? [{ id: 'played', label: 'Played', count: played.data?.length }] : []),
    { id: 'friends', label: 'Friends', count: friends.data?.length },
    ...(isMe ? [
      { id: 'bookmarks', label: 'Bookmarks', count: library.bookmarks.size, private: true },
      { id: 'ratings', label: 'Ratings', count: library.ratings.size, private: true },
      { id: 'requests', label: 'Requests', count: library.requestCount || undefined, private: true, alert: library.requestCount > 0 },
    ] : []),
  ];
  const requested = searchParams.get('tab');
  const tab = tabs.some(({ id }) => id === requested) ? requested : 'favorites';

  // The tab is in the address (?tab=ratings), so it can be linked to; changing it keeps the scroll
  const select = (id, focus = false) => {
    setSearchParams(id === 'favorites' ? {} : { tab: id }, { replace: true, state: { keepScroll: true } });
    if (focus) tabRefs.current[id]?.focus();
  };

  // Arrow keys move between the tabs (the usual tab keys), Home and End to the ends
  const onKeyDown = (e) => {
    const at = tabs.findIndex(({ id }) => id === tab);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length].id, true);
  };

  const reloadFriends = friends.reload;

  let panel;
  if (tab === 'favorites') {
    panel = favorites.error
      ? <p className={styles.error} role="alert">Couldn&rsquo;t load the favorites.</p>
      : favorites.loaded && (
        <>
          {isMe && <p className={styles.muted}>Your favorite games show here, for everyone to see.</p>}
          <GameTiles
            entries={favorites.data}
            empty={isMe ? 'Add the games you love to your favorites with the heart on their pages.' : 'No favorites yet.'}
          />
        </>
      );
  } else if (tab === 'played') {
    panel = <Played played={played} isMe={isMe} privacy={myPrivacy} />;
  } else if (tab === 'friends') {
    panel = <Friends friends={friends} isMe={isMe} />;
  } else if (tab === 'bookmarks') {
    panel = (
      <>
        <p className={styles.muted}>Games saved to play later. Only you see these.</p>
        <GameTiles entries={newestFirst(library.bookmarks)} empty="No bookmarks yet. Bookmark games from the games list or their pages." />
      </>
    );
  } else if (tab === 'ratings') {
    panel = <Ratings />;
  } else {
    panel = <Requests onChange={reloadFriends} />;
  }

  return (
    <section className={styles.card}>
      {!isMe && (
        <div className={styles.profileFriend}>
          {blocked ? <BlockedNote onUnblock={onUnblock} /> : <FriendButton player={player} onChange={reloadFriends} />}
        </div>
      )}
      <div className={styles.tabs} role="tablist" aria-label="Profile" onKeyDown={onKeyDown}>
        {tabs.map(({ id, label, count, alert }) => (
          <button
            key={id}
            ref={(element) => { tabRefs.current[id] = element; }}
            type="button"
            role="tab"
            id={`profile-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="profile-panel"
            tabIndex={tab === id ? 0 : -1}
            className={`${styles.tab} ${tab === id ? styles.active : ''}`}
            onClick={() => select(id)}
          >
            {label}
            {count !== undefined && <span className={`${styles.tabCount} ${alert ? styles.alert : ''}`}>{count}</span>}
          </button>
        ))}
      </div>
      <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${tab}`} className={styles.tabPanel}>
        {tabs.find(({ id }) => id === tab)?.private && <p className={styles.privateNote}>Private: only you see this tab</p>}
        {panel}
      </div>
    </section>
  );
};

/** "Playing Snake", under a player's name while they play (when they let the viewer see it) */
const PlayingNowLine = ({ playerId }) => {
  const playing = usePlayingNow([playerId]).get(playerId);
  return playing && (
    <Link to={`/g/${playing.game_id}`} className={styles.playingLink}>
      <PlayingNow gameId={playing.game_id} />
    </Link>
  );
};

/** A profile once it's loaded: the header, and the tabs under it */
const ProfileBody = ({ player, isMe }) => {
  const { user } = useAuth();
  const { refreshRequests } = useLibrary();
  const me = user?.id ?? null;
  const block = useLoad(me && !isMe ? () => fetchIsBlocked(player.id) : null, [me, player.id]);
  const [blockedNow, setBlockedNow] = useState(null); // after blocking or unblocking here
  const blocked = blockedNow ?? block.data === true;
  // Bumped by blocking or unblocking: what each of you sees of the other changes, so it loads again
  const [seen, setSeen] = useState(0);
  const name = player.display_name ?? player.username;

  const changed = (now) => {
    setBlockedNow(now);
    setSeen((n) => n + 1);
  };

  const blockThem = async () => {
    const yes = await askToConfirm({
      title: `Block ${name}?`,
      message: `Neither of you can add the other as a friend (if you're friends, that ends), and you won't see each other's games, what you're playing or your recent activity. ${name} isn't told. You can unblock them any time, here or in Settings.`,
      confirmLabel: 'Block',
      danger: true,
    });
    if (!yes) return;
    try {
      await blockPlayer(player.id);
      refreshRequests(); // a request either way is gone
      changed(true);
      showToast(`You blocked ${name}.`);
    } catch (error) {
      showToast(describeFriendError(error), { tone: 'error' });
    }
  };

  const unblockThem = async () => {
    try {
      await unblockPlayer(player.id);
      changed(false);
      showToast(`You unblocked ${name}.`);
    } catch (error) {
      showToast(describeFriendError(error), { tone: 'error' });
    }
  };

  return (
    <>
      <section className={styles.profileHeader}>
        <Avatar url={player.avatar_url} name={name} size={96} />
        <div className={styles.profileNames}>
          <h1 className={styles.title}>{name}</h1>
          <p className={styles.handle}>@{player.username}</p>
          <p className={styles.muted}>Joined {monthYear(player.created_at)}</p>
          <PlayingNowLine key={seen} playerId={player.id} />
        </div>
        {isMe && <Button as={Link} to="/settings" variant="outline">Edit profile</Button>}
        {!isMe && (!me || block.loaded) && (
          <PlayerActions player={player} blocked={blocked} onBlock={blockThem} onUnblock={unblockThem} />
        )}
      </section>

      <ProfileTabs key={seen} player={player} isMe={isMe} blocked={blocked} onUnblock={unblockThem} />
    </>
  );
};

/** Public profile: /u/:username */
const Profile = () => {
  const { username = '' } = useParams();
  const { isAvailable, profile: me } = useAuth();
  const lookup = username.toLowerCase();
  const valid = USERNAME_PATTERN.test(lookup);
  // Tagged with the name it's for, so a previous player never flashes on the next profile
  const [result, setResult] = useState({ lookup: null, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  // Your own profile needs no fetch (e.g. straight after sign-up), and shows your latest edits
  const isOwn = me?.username === lookup;

  useEffect(() => {
    if (!isAvailable || !valid || isOwn) return undefined;
    let active = true;
    supabase.from('profiles').select(PUBLIC_COLUMNS).eq('username', lookup).maybeSingle()
      .then(({ data, error }) => {
        if (active) setResult({ lookup, data, error });
      });
    return () => {
      active = false;
    };
  }, [isAvailable, valid, isOwn, lookup, attempt]);

  // Usernames are lowercase: /u/Dany → /u/dany
  if (username !== lookup) return <Navigate to={`/u/${lookup}`} replace />;

  const page = (content) => <div className={styles.page}>{content}</div>;

  if (!isAvailable) {
    return page(<section className={styles.card}><p>Player profiles are coming soon.</p></section>);
  }
  if (!isOwn && valid && result.lookup !== lookup) {
    return page(<p className={styles.muted} aria-live="polite">Loading profile…</p>);
  }
  if (!isOwn && valid && result.error) {
    return page(
      <section className={styles.card}>
        <p className={styles.error} role="alert">Couldn't load this profile. Check your connection and try again.</p>
        <div className={styles.actions}><Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button></div>
      </section>,
    );
  }
  if (!isOwn && (!valid || !result.data)) {
    return page(
      <section className={styles.card}>
        <h1 className={styles.cardTitle}>No player called @{username}</h1>
        <p className={styles.muted}>They may have changed their username or deleted their account.</p>
        <p><Link to="/players" className={styles.textLink}>See all players</Link></p>
      </section>,
    );
  }

  const isMe = isOwn || me?.id === result.data.id;
  const player = isMe ? me : result.data;

  // Keyed by player, so moving to another profile starts afresh
  return page(<ProfileBody key={player.id} player={player} isMe={isMe} />);
};

export default Profile;
