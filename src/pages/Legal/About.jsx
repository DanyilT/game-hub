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
            <li>Download a game from its page to play it offline, in the browser or the installed app. GameHub itself opens without a network too.</li>
            <li>On a phone, you can install GameHub as an app on your home screen.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Your progress</h2>
          <p>Games keep your scores and progress in your browser. Sign in, and that&rsquo;s saved to your account too, so you can pick up where you left off on any device. The first time you sign in on a device, progress already saved there moves into your account, if your account doesn&rsquo;t have any for that game yet. Progress made offline goes up to your account the next time you play that game online, unless you&rsquo;ve played it on another device in the meantime: then your account&rsquo;s progress wins. On a shared browser, each player keeps their own, and progress made without signing in stays in the browser.</p>
          <p>Under each game, a panel shows your numbers (your score, your best, and more), how long you&rsquo;ve played, and your finished games, to watch again: the moves you made, played back by the game itself, not a video.</p>
        </section>

        <section className={styles.section}>
          <h2>How the game, GameHub and its server talk</h2>
          <ul>
            <li><strong>The game</strong> runs from its own address, in a frame on GameHub&rsquo;s page, and saves in your browser. It never gets your sign-in.</li>
            <li><strong>GameHub&rsquo;s page</strong> hears from the game through a small script GameHub gives it (a &ldquo;bridge&rdquo;), with messages that only GameHub&rsquo;s page and the game&rsquo;s own address can exchange: your saves, the game&rsquo;s numbers, and each game you finish.</li>
            <li><strong>GameHub&rsquo;s server</strong> (Supabase, and the site&rsquo;s own Cloudflare Worker) gets your saves from GameHub&rsquo;s page when you&rsquo;re signed in, and nothing straight from the game.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Checked games and records</h2>
          <p>Saves are in your browser, so they could say anything. That&rsquo;s why records come only from games GameHub&rsquo;s server has checked itself:</p>
          <ul>
            <li>Signed in, each game you start takes a <strong>ticket</strong>: a random seed the server picked (where the food goes, which pieces come, where the mines are, which puzzle). Your browser keeps a few for each game you play or download, so games played offline get them too.</li>
            <li>When you finish, the game sends the moves you made, with their timing. The server plays them again on the ticket&rsquo;s seed, with the game&rsquo;s own rules, and keeps the result <em>it</em> gets as yours, never the one the game claims. A ticket is good for one game, and a game can&rsquo;t have lasted longer than its ticket has existed.</li>
            <li>Offline, games wait on your device and are checked once you&rsquo;re back online. When the tickets run out offline, the games you play after that stay on your device only: they can&rsquo;t be checked, so they don&rsquo;t count. Back online, GameHub gets you new tickets.</li>
            <li>Under each game, your finished games say whether they count, and <strong>More</strong> shows your checked records.</li>
          </ul>
          <p>No check can stop everything (a good enough bot plays like a person), so odd results get a closer look, and cheating is against the <Link to="/terms">Terms</Link>. Found a way around it? Please tell the developer on <Out href={HUB_ISSUES_URL}>GitHub issues</Out>.</p>
        </section>

        <section className={styles.section}>
          <h2>With an account</h2>
          <ul>
            <li>Rate games from 1 to 5. Only you see your ratings; everyone sees each game&rsquo;s average.</li>
            <li>Add the games you love to your favorites (the heart): they show on your profile.</li>
            <li>Bookmark games to play later: only you see your bookmarks.</li>
            <li>Add friends: friends lists are on profiles, for everyone to see. The <strong>⋯</strong> on a player&rsquo;s profile blocks them, or reports them to the developer.</li>
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
