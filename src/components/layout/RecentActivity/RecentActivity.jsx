import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { gamesById } from '../../../data/games';
import { fetchRecentActivity, playTime, timeAgo } from '../../../lib/activity';
import { supabase } from '../../../lib/supabase';
import Avatar from '../../common/Avatar/Avatar';
import styles from './RecentActivity.module.scss';

/**
 * The games page's recent activity: who played what lately, from the players who show it (Settings →
 * Privacy; src/lib/activity.js). A row that scrolls sideways. Not there when there's nothing to show,
 * or on a site without accounts.
 */
const RecentActivity = () => {
  const [plays, setPlays] = useState([]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    fetchRecentActivity(12).then(
      (rows) => active && setPlays(rows.filter((row) => gamesById.has(row.game_id))),
      () => {}, // nothing to show
    );
    return () => {
      active = false;
    };
  }, []);

  if (plays.length === 0) return null;
  return (
    <section className={styles.activity} aria-labelledby="recent-activity">
      <h2 id="recent-activity" className={styles.title}>Recent activity</h2>
      <ul className={styles.list}>
        {plays.map((play) => {
          const name = play.display_name ?? play.username;
          return (
            <li key={`${play.user_id}:${play.game_id}`} className={styles.play}>
              <Link to={`/u/${play.username}`} className={styles.avatar} tabIndex={-1} aria-hidden="true">
                <Avatar url={play.avatar_url} name={name} size={36} />
              </Link>
              <span className={styles.text}>
                <span>
                  <Link to={`/u/${play.username}`} className={styles.name}>{name}</Link>
                  {' played '}
                  <Link to={`/g/${play.game_id}`} className={styles.game}>{gamesById.get(play.game_id).title}</Link>
                </span>
                <span className={styles.when}>{timeAgo(play.played_at)} · {playTime(play.seconds)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default RecentActivity;
