import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import {
  PiBookmarkSimple, PiCode, PiDotsThreeVertical, PiFlag, PiGameController, PiHeart, PiProhibit, PiStar, PiUserCheck,
  PiUserCircle, PiUserMinus, PiUserPlus, PiUsers,
} from 'react-icons/pi';
import { useAuth } from '../../contexts/AuthContext';
import { useLibrary } from '../../contexts/LibraryContext';
import { gamesById } from '../../data/games';
import { supabase } from '../../lib/supabase';
import { PROFILE_COLUMNS, USERNAME_PATTERN, withRoles } from '../../lib/account';
import { AUDIENCES, fetchMyPrivacy, fetchPlayed, playTime, timeAgo, usePlayingNow } from '../../lib/activity';
import { blockPlayer, fetchIsBlocked, unblockPlayer } from '../../lib/blocks';
import { askToConfirm } from '../../lib/confirm';
import { monthYear } from '../../lib/dates';
import {
  acceptFriendRequest, describeFriendError, fetchFriends, fetchFriendState, fetchMyRequests, removeFriend,
  sendFriendRequest,
} from '../../lib/friends';
import {
  describeRoleError, developerInfo, gamesBy, isAdmin, isDeveloper, linkSite, setDeveloper,
} from '../../lib/roles';
import { showToast } from '../../lib/toast';
import { useLoad } from '../../lib/useLoad';
import ReportPlayer from '../../components/account/ReportPlayer/ReportPlayer';
import Avatar from '../../components/common/Avatar/Avatar';
import Badge from '../../components/common/Badge/Badge';
import Button from '../../components/common/Button/Button';
import Menu from '../../components/common/Menu/Menu';
import Message from '../../components/common/Message/Message';
import PageTitle from '../../components/common/PageTitle/PageTitle';
import Status from '../../components/common/Status/Status';
import Tabs from '../../components/common/Tabs/Tabs';
import RatingSlider from '../../components/layout/game/RatingSlider/RatingSlider';
import styles from './Account.module.scss';

/** The games in a list of ids (newest first), as tiles linking to each game's page, each with an optional line under its title */
const GameTiles = ({ entries, empty }) => {
  const known = entries.filter(({ gameId }) => gamesById.has(gameId));
  if (known.length === 0) return <Status kind="empty">{empty}</Status>;
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
      <Badge variant="dot" tone="accent" className={styles.liveDot} aria-hidden="true" />
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
 * You and another player, as one button beside their ⋯: Add friend, or, once there's something between you, a menu of
 * what you can do about it (Friends: remove, block; Request sent: cancel; Friend request: accept, decline; Blocked:
 * unblock). Signed out, Add friend opens the sign-in window.
 * @param {object} player - their profile
 * @param {object} friendship - where you stand (useLoad of fetchFriendState: 'friends', 'outgoing', 'incoming', or none)
 * @param {boolean} blocked - you've blocked them
 * @param {function} onBlock - asks, then blocks them
 * @param {function} onUnblock
 * @param {function} onChange - after a change (their friends list, and where you stand, load again)
 */
const FriendButton = ({ player, friendship, blocked, onBlock, onUnblock, onChange }) => {
  const { user, openSignIn } = useAuth();
  const { refreshRequests } = useLibrary();
  const [busy, setBusy] = useState(false);
  const name = player.display_name ?? player.username;

  if (blocked) {
    return (
      <Menu
        label={`You blocked ${name}`}
        text="Blocked"
        icon={<PiProhibit aria-hidden="true" />}
        look={{ tone: 'danger' }}
        items={[{ label: 'Unblock', icon: <PiProhibit aria-hidden="true" />, onSelect: onUnblock }]}
      />
    );
  }
  if (!user) return <Button icon={PiUserPlus} onClick={openSignIn}>Add friend</Button>;
  if (friendship.error) {
    return <Status kind="error" onRetry={friendship.reload}>Couldn&rsquo;t check whether you&rsquo;re friends.</Status>;
  }
  if (!friendship.loaded) return null;

  // `question`: askToConfirm's, for actions that need a yes first
  const run = async (action, question) => {
    if (question && !(await askToConfirm(question))) return;
    setBusy(true);
    try {
      await action(player.id);
      refreshRequests();
      onChange();
    } catch (err) {
      showToast(describeFriendError(err), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const menu = (text, icon, items, look) => (
    <Menu label={`You and ${name}`} text={text} icon={icon} look={look} disabled={busy} items={items} />
  );
  switch (friendship.data) {
    case 'friends':
      return menu('Friends', <PiUserCheck aria-hidden="true" />, [
        {
          label: 'Remove friend',
          icon: <PiUserMinus aria-hidden="true" />,
          danger: true,
          onSelect: () => run(removeFriend, {
            title: 'Remove friend?',
            message: `${name} comes off your friends list, and you come off theirs. You can send a new request any time.`,
            confirmLabel: 'Remove',
            danger: true,
          }),
        },
        { label: 'Block', icon: <PiProhibit aria-hidden="true" />, danger: true, onSelect: onBlock },
      ], { tone: 'accent' });
    case 'outgoing':
      return menu('Request sent', <PiUserCircle aria-hidden="true" />, [
        { label: 'Cancel request', icon: <PiUserMinus aria-hidden="true" />, onSelect: () => run(removeFriend) },
      ]);
    case 'incoming':
      return menu('Friend request', <PiUserPlus aria-hidden="true" />, [
        { label: 'Accept', icon: <PiUserCheck aria-hidden="true" />, onSelect: () => run(acceptFriendRequest) },
        { label: 'Decline', icon: <PiUserMinus aria-hidden="true" />, danger: true, onSelect: () => run(removeFriend) },
      ], { variant: 'filled' });
    default:
      return <Button icon={PiUserPlus} disabled={busy} onClick={() => run(sendFriendRequest)}>Add friend</Button>;
  }
};

/**
 * The ⋯ on another player's profile: block them (while you aren't friends: friends block them from the Friends button,
 * and Blocked's unblocks them), and report them to GameHub's admins. Signed out, each opens the sign-in window. An admin
 * also makes them a developer, or not.
 * @param {object} player - their profile
 * @param {boolean} canBlock - not blocked, and not friends
 * @param {function} onBlock - asks, then blocks them
 * @param {function} onRolesChange - after an admin changed their roles (their profile loads again)
 */
const PlayerActions = ({ player, canBlock, onBlock, onRolesChange }) => {
  const { user, profile: me, openSignIn } = useAuth();
  const [reporting, setReporting] = useState(false);
  const name = player.display_name ?? player.username;
  const signedIn = Boolean(user);
  const developer = isDeveloper(player);

  const toggleDeveloper = async () => {
    const yes = await askToConfirm(developer ? {
      title: `Take away ${name}'s developer role?`,
      message: `Their profile stops showing their bio, links and games, and they're no longer listed with the developers. Their bio and links are kept, in case they're a developer again. Games that name ${name} still link to their profile.`,
      confirmLabel: 'Take it away',
      danger: true,
    } : {
      title: `Make ${name} a developer?`,
      message: `Their profile gets a bio, links and the games they made (once a game names their account in the games table), and they're listed with the developers. They can take the role back only through an admin.`,
      confirmLabel: 'Make developer',
    });
    if (!yes) return;
    try {
      await setDeveloper(player.id, !developer);
      showToast(developer ? `${name} isn't a developer any more.` : `${name} is a developer now.`);
      onRolesChange();
    } catch (error) {
      showToast(describeRoleError(error), { tone: 'error' });
    }
  };

  const items = [
    ...(canBlock ? [{ label: 'Block', icon: <PiProhibit aria-hidden="true" />, onSelect: signedIn ? onBlock : openSignIn, danger: true }] : []),
    { label: 'Report…', icon: <PiFlag aria-hidden="true" />, onSelect: signedIn ? () => setReporting(true) : openSignIn, danger: true },
    ...(isAdmin(me) ? [{
      label: developer ? 'Take away developer role' : 'Make developer',
      icon: <PiCode aria-hidden="true" />,
      onSelect: toggleDeveloper,
      danger: developer,
    }] : []),
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
            showToast(`Thanks. Your report on ${name} went to GameHub's admins.`);
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
      <Message as="span" tone={state === 'error' ? 'error' : 'note'} role="status" className={styles.ratingState}>
        {{ saving: 'Saving…', saved: 'Saved', error: "Couldn't save" }[state] ?? `${draft ?? score} / 5`}
      </Message>
      <Button variant="text" size="sm" font="secondary" onClick={remove}>Remove</Button>
    </li>
  );
};

const Ratings = () => {
  const { ratings } = useLibrary();
  const rows = [...ratings]
    .filter(([gameId]) => gamesById.has(gameId))
    .sort(([, a], [, b]) => b.updated_at.localeCompare(a.updated_at));
  if (rows.length === 0) {
    return <Status kind="empty">You haven&rsquo;t rated any games yet. Rate one from its page.</Status>;
  }
  return (
    <>
      <Message>Only you see your ratings. Everyone sees each game&rsquo;s average.</Message>
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

  if (!requests.loaded) return <Status kind="loading" />;
  if (requests.error) return <Status kind="error" onRetry={requests.reload}>Couldn&rsquo;t load your requests.</Status>;

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
    return <Status kind="empty">No friend requests. Add friends from their profiles.</Status>;
  }

  return (
    <>
      {error && <Message tone="error">{error}</Message>}
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
  if (!friends.loaded) return <Status kind="loading" />;
  if (friends.error) return <Status kind="error" onRetry={friends.reload}>Couldn&rsquo;t load the friends list.</Status>;
  if (friends.data.length === 0) {
    return <Status kind="empty">{isMe ? 'No friends yet. Add friends from their profiles.' : 'No friends yet.'}</Status>;
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
  if (!played.loaded) return <Status kind="loading" />;
  if (played.error) return <Status kind="error">Couldn&rsquo;t load the games played.</Status>;
  const audience = privacy.data && AUDIENCES.find(({ value }) => value === privacy.data.show_played);
  const historyOff = privacy.data?.record_played === false;
  return (
    <>
      {isMe && (
        <Message>
          {historyOff
            ? 'Your play history is off: nothing new is recorded, and only you see what was kept before'
            : `Games you’ve played for a minute or more.${audience ? ` ${audience.value === 'nobody' ? 'Only you see them' : `${audience.label} can see them`}` : ''}`}
          {' '}(<Link to="/settings">Settings → Privacy</Link>).
        </Message>
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
 * The tabs under the profile header: public ones for everyone, private ones on your own. Your friends tab has your
 * friend requests in it, as a tab of its own.
 * @param {boolean} blocked - you've blocked this player: no friend buttons, but Unblock
 * @param {function} onUnblock
 */
const ProfileTabs = ({ player, isMe, blocked }) => {
  const library = useLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const theirFavorites = useFavorites(player, isMe);
  const friends = useLoad(() => fetchFriends(player.id), [player.id]);
  const played = useLoad(() => fetchPlayed(player.id), [player.id]);
  const myPrivacy = useLoad(isMe ? fetchMyPrivacy : null, [player.id, isMe]);

  const favorites = isMe ? { loaded: library.loaded, data: newestFirst(library.favorites) } : theirFavorites;
  const requestAlert = { count: isMe ? library.requestCount : 0, text: library.requestCount === 1 ? 'friend request' : 'friend requests' };
  const tabs = [
    // Another player's only when they let you see some (yours always)
    ...(isMe || played.data?.length ? [{ id: 'played', label: 'Played', icon: PiGameController, count: played.data?.length }] : []),
    { id: 'friends', label: 'Friends', icon: PiUsers, count: friends.data?.length, alert: requestAlert },
    { id: 'favorites', label: 'Favorites', icon: PiHeart, count: favorites.data?.length },
    ...(isMe ? [
      { id: 'bookmarks', label: 'Bookmarks', icon: PiBookmarkSimple, count: library.bookmarks.size, private: true },
      { id: 'ratings', label: 'Ratings', icon: PiStar, count: library.ratings.size, private: true },
    ] : []),
  ];
  // The tab is in the address (?tab=ratings; ?tab=requests is the friends tab's requests), so it can be linked to.
  // The first tab needs none.
  const requested = searchParams.get('tab');
  const showRequests = isMe && requested === 'requests';
  const wanted = showRequests ? 'friends' : requested;
  const tab = tabs.some(({ id }) => id === wanted) ? wanted : tabs[0].id;

  // Changing it keeps the scroll
  const select = (id) => {
    setSearchParams(id === tabs[0].id ? {} : { tab: id }, { replace: true, state: { keepScroll: true } });
  };

  const reloadFriends = friends.reload;

  // Another player's tabs wait to know whether there's a Played tab, which comes first
  if (!isMe && !played.loaded) {
    return <section className={styles.card}><Status kind="loading" /></section>;
  }

  let panel;
  if (tab === 'played') {
    panel = <Played played={played} isMe={isMe} privacy={myPrivacy} />;
  } else if (tab === 'friends') {
    panel = isMe ? (
      <>
        <Tabs
          label="Friends and requests"
          idPrefix="profile-friends-tab"
          panelId="profile-friends-panel"
          small
          tabs={[
            { id: 'list', label: 'Your friends', icon: PiUsers, count: friends.data?.length },
            { id: 'requests', label: 'Requests', icon: PiUserPlus, alert: requestAlert, private: true },
          ]}
          selected={showRequests ? 'requests' : 'list'}
          onSelect={(id) => select(id === 'requests' ? 'requests' : 'friends')}
        />
        <div
          id="profile-friends-panel"
          role="tabpanel"
          aria-labelledby={`profile-friends-tab-${showRequests ? 'requests' : 'list'}`}
          className={styles.tabPanel}
        >
          {showRequests ? <Requests onChange={reloadFriends} /> : <Friends friends={friends} isMe />}
        </div>
      </>
    ) : <Friends friends={friends} isMe={false} />;
  } else if (tab === 'favorites') {
    panel = favorites.error
      ? <Status kind="error">Couldn&rsquo;t load the favorites.</Status>
      : favorites.loaded && (
        <>
          {isMe && <Message>Your favorite games show here, for everyone to see.</Message>}
          <GameTiles
            entries={favorites.data}
            empty={isMe ? 'Add the games you love to your favorites with the heart on their pages.' : 'No favorites yet.'}
          />
        </>
      );
  } else if (tab === 'bookmarks') {
    panel = (
      <>
        <Message>Games saved to play later. Only you see these.</Message>
        <GameTiles entries={newestFirst(library.bookmarks)} empty="No bookmarks yet. Bookmark games from the games list or their pages." />
      </>
    );
  } else {
    panel = <Ratings />;
  }

  return (
    <section className={styles.card}>
      {blocked && (
        <Message className={styles.profileFriend}>
          You blocked {player.display_name ?? player.username}: you aren&rsquo;t friends, neither of you can add the
          other, and you don&rsquo;t see each other&rsquo;s activity. They aren&rsquo;t told.
        </Message>
      )}
      <Tabs label="Profile" idPrefix="profile-tab" panelId="profile-panel" tabs={tabs} selected={tab} onSelect={select} />
      <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${tab}`} className={styles.tabPanel}>
        {panel}
      </div>
    </section>
  );
};

/** A developer's bio, links and games, between their name and the tabs */
const DeveloperCard = ({ player, isMe }) => {
  const info = developerInfo(player);
  if (!info) return null;
  const name = player.display_name ?? player.username;
  const made = gamesBy(player.username);
  return (
    <section className={`${styles.card} ${styles.developerCard}`} aria-labelledby="developer-title">
      <h2 id="developer-title" className={styles.cardTitle}>Developer</h2>
      {info.bio && <p className={styles.bio}>{info.bio}</p>}
      {isMe && !info.bio && info.links.length === 0 && (
        <Message>Your bio and links go here: add them in <Link to="/settings#developer">Settings</Link>.</Message>
      )}
      {info.links.length > 0 && (
        <ul className={styles.developerLinks} aria-label="Links">
          {info.links.map((url) => {
            const { label, Icon } = linkSite(url);
            return (
              <li key={url}>
                <Button href={url} variant="outline" shape="rounded" font="secondary" size="sm" icon={Icon} rel="me noopener noreferrer">
                  {label}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <h3 className={styles.subTitle}>Games</h3>
      <GameTiles
        entries={made.map((game) => ({ gameId: game.id, meta: game.released ? `Released ${game.released.slice(0, 4)}` : null }))}
        empty={isMe ? 'Your games show here once they’re linked to your account.' : `No games by ${name} on GameHub yet.`}
      />
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
const ProfileBody = ({ player, isMe, onRolesChange }) => {
  const { user } = useAuth();
  const { refreshRequests } = useLibrary();
  const me = user?.id ?? null;
  const block = useLoad(me && !isMe ? () => fetchIsBlocked(player.id) : null, [me, player.id]);
  const [blockedNow, setBlockedNow] = useState(null); // after blocking or unblocking here
  const blocked = blockedNow ?? block.data === true;
  // Bumped by blocking, unblocking or a friend change: what each of you sees of the other changes, so it loads again
  const [seen, setSeen] = useState(0);
  const friendship = useLoad(me && !isMe ? () => fetchFriendState(me, player.id) : null, [me, player.id, seen]);
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
          <PageTitle>{name}</PageTitle>
          <p className={styles.handle}>@{player.username}</p>
          {(isDeveloper(player) || (isMe && isAdmin(player))) && (
            <p className={styles.roles}>
              {isDeveloper(player) && <Badge variant="soft" tone="accent" size="md" icon={PiCode}>Developer</Badge>}
              {isMe && isAdmin(player) && <Badge variant="outline" tone="primary" size="md">Admin</Badge>}
            </p>
          )}
          <Message>Joined {monthYear(player.created_at)}</Message>
          <PlayingNowLine key={seen} playerId={player.id} />
        </div>
        {isMe && <Button to="/settings" variant="outline">Edit profile</Button>}
        {!isMe && (!me || block.loaded) && (
          <div className={styles.headerActions}>
            <FriendButton
              player={player}
              friendship={friendship}
              blocked={blocked}
              onBlock={blockThem}
              onUnblock={unblockThem}
              onChange={() => setSeen((n) => n + 1)}
            />
            <PlayerActions
              player={player}
              canBlock={!blocked && friendship.data !== 'friends'}
              onBlock={blockThem}
              onRolesChange={onRolesChange}
            />
          </div>
        )}
      </section>

      <DeveloperCard player={player} isMe={isMe} />

      <ProfileTabs key={seen} player={player} isMe={isMe} blocked={blocked} />
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
    withRoles((roles) => supabase.from('profiles').select(`${PROFILE_COLUMNS}${roles}`).eq('username', lookup).maybeSingle())
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
    return page(<Status kind="loading">Loading profile…</Status>);
  }
  if (!isOwn && valid && result.error) {
    return page(
      <section className={styles.card}>
        <Status kind="error" onRetry={() => setAttempt((n) => n + 1)}>
          Couldn&rsquo;t load this profile. Check your connection and try again.
        </Status>
      </section>,
    );
  }
  if (!isOwn && (!valid || !result.data)) {
    return page(
      <section className={styles.card}>
        <h1 className={styles.cardTitle}>No player called @{username}</h1>
        <Message>They may have changed their username or deleted their account.</Message>
        <p><Link to="/players">See all players</Link></p>
      </section>,
    );
  }

  const isMe = isOwn || me?.id === result.data.id;
  const player = isMe ? me : result.data;

  // Keyed by player, so moving to another profile starts afresh
  return page(<ProfileBody key={player.id} player={player} isMe={isMe} onRolesChange={() => setAttempt((n) => n + 1)} />);
};

export default Profile;
