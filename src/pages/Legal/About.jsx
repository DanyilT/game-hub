import { Link } from 'react-router';
import { version } from '../../../package.json';
import { developer, games, getEmbedUrl } from '../../data/games.js';
import { HUB_ISSUES_URL, HUB_REPO_URL, hubBugReportUrl } from '../../lib/support.js';
import styles from './Legal.module.scss';

const GAMES_REPO_URL = 'https://github.com/DanyilT/dt-games';

const NewTab = () => <span className="visually-hidden"> (opens in a new tab)</span>;
const Out = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{children}<NewTab /></a>
);

/** /about: what GameHub is, how saving works, and where the code and bug reports live */
const About = () => {
  const inHub = games.filter((game) => getEmbedUrl(game)).length;
  const elsewhere = games.length - inHub;
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1>About GameHub</h1>

        <p className={styles.intro}>
          GameHub is a small arcade of browser games made by <Out href={developer.url}>{developer.name}</Out>:{' '}
          {inHub} games to play right here{elsewhere > 0 && `, and ${elsewhere} more to try on their own sites`}. No
          downloads, no ads, and no account needed to play. The hub is free and we are not collecting or selling your data.
        </p>

        <section className={styles.section}>
          <h2>Playing</h2>
          <ul>
            <li>Pick a game on the <Link to="/">games list</Link> and play it in the page, or open it on its own.</li>
            <li>Each game runs from its own address (on dt-games.pages.dev), in a frame, so games can&rsquo;t reach your account or each other.</li>
            <li>The <strong>?</strong> button on a game&rsquo;s page has help: reporting a bug, and starting the game from scratch.</li>
            <li>On a phone, you can install GameHub as an app on your home screen.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Your progress</h2>
          <p>Games keep your scores and progress in your browser. Sign in, and that&rsquo;s saved to your account too, so you can pick up where you left off on any device. The first time you sign in on a device, progress already saved there moves into your account, if your account doesn&rsquo;t have any for that game yet.</p>
        </section>

        <section className={styles.section}>
          <h2>With an account</h2>
          <ul>
            <li>Rate games from 1 to 5. Only you see your ratings; everyone sees each game&rsquo;s average.</li>
            <li>Add the games you love to your favorites (the heart): they show on your profile.</li>
            <li>Bookmark games to play later: only you see your bookmarks.</li>
            <li>Add friends: friends lists are on profiles, for everyone to see.</li>
          </ul>
          <p>Sign in with Google. What&rsquo;s stored, and how to delete it, is in the <Link to="/privacy">Privacy Policy</Link>.</p>
        </section>

        <section className={styles.section}>
          <h2>Found a bug?</h2>
          <p>
            Report it on GitHub: problems with a game go to <Out href={`${GAMES_REPO_URL}/issues`}>the games&rsquo; repo</Out>,
            and anything about the site to <Out href={hubBugReportUrl()}>GameHub&rsquo;s</Out> (see what&rsquo;s{' '}
            <Out href={HUB_ISSUES_URL}>already reported</Out>). No GitHub account? Sign in, and use the <strong>?</strong> button
            on the game&rsquo;s page to send a message instead.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Open source</h2>
          <p>
            The code is on GitHub: <Out href={HUB_REPO_URL}>the site</Out> (React, Vite, Supabase, on Cloudflare) and{' '}
            <Out href={GAMES_REPO_URL}>the games</Out>, a branch per game. Fonts: Doto and Chakra Petch. Icons: react-icons.
          </p>
        </section>

        <p className={styles.updated}>GameHub v{version} · <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></p>
      </div>
    </div>
  );
};

export default About;
