import { Link } from 'react-router';
import ExternalLink from '../../components/common/ExternalLink/ExternalLink';
import { GAMES_ISSUES_URL, HUB_ISSUES_URL, HUB_REPO_URL, hubBugReportUrl } from '../../lib/support';
import PageTitle from '../../components/common/PageTitle/PageTitle';
import styles from './Legal.module.scss';

// Change this whenever the terms text changes
const LAST_UPDATED = '11 October 2026';


const Terms = () => (
  <div className={styles.page}>
    <div className={styles.container}>
      <PageTitle align="center" className={styles.title}>Terms & Conditions</PageTitle>

      <section className={styles.section}>
        <h2>1. Introduction</h2>
        <p>Welcome to GameHub. These terms are the rules for using the site. By using it, you agree to them.</p>
      </section>

      <section className={styles.section}>
        <h2>2. Intellectual Property</h2>
        <p>GameHub is open source. Its code is © 2025-2026 Danyil Tymchuk, under the MIT License: you can read it, copy it and build on it, as long as you keep the copyright and license notice. It&rsquo;s on <ExternalLink href={HUB_REPO_URL}>GitHub</ExternalLink>.</p>
        <p>Each game belongs to whoever made it: its page says who, and links to its code when that&rsquo;s open source. GameHub only shows the games; it doesn&rsquo;t own them.</p>
        <p>The fonts (Doto and Chakra Petch, from Google Fonts) and the icons (react-icons) are used under their own open licenses. Google Play and the Google Play logo are trademarks of Google LLC.</p>
      </section>

      <section className={styles.section}>
        <h2>3. Using GameHub</h2>
        <ul>
          <li>Play fair (section 4). Don&rsquo;t try to break or overload the site or the games, or get into other players&rsquo; accounts or private data.</li>
          <li>Look after your account: you&rsquo;re responsible for what&rsquo;s done with it. On a shared computer, sign out when you&rsquo;re done (Settings can also sign you out on every device).</li>
          <li>Don&rsquo;t use GameHub for anything illegal.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>4. Fair play: no cheating, no tampering</h2>
        <p>Your saves are yours: they live in your browser, and changing them only changes your own game. Records are different. They come only from games GameHub&rsquo;s server has checked by playing them again (the <Link to="/about">About</Link> page explains how), so they mean something to everyone who sees them. So these aren&rsquo;t allowed:</p>
        <ul>
          <li>changing a game&rsquo;s saved data, its tickets or its recorded games, in the browser or on the way to the server, to get results you didn&rsquo;t play</li>
          <li>sending GameHub made-up games or results, or getting around its checks or its tickets</li>
          <li>letting a bot, a script or another program play for you, or show you what the game hides (the mines, the next pieces, the solution)</li>
          <li>using a bug to get a record</li>
        </ul>
        <p>Games that don&rsquo;t check out are kept for a while, and so are odd ones. If we have reason to think an account cheats or tampers with GameHub&rsquo;s data, we&rsquo;ll look into it, and may remove its games and records, suspend it, or delete it for good (a permanent ban).</p>
        <p>Think another player cheats? Report them with the <strong>⋯</strong> on their profile (signed in). Only GameHub&rsquo;s admins read reports, and the player isn&rsquo;t told who sent one. Please only report what you really think happened: reports made to get at someone break these Terms too.</p>
        <p>Found a way to cheat, fake a record, or get past the checks? Please don&rsquo;t use it: tell the developer on <ExternalLink href={HUB_ISSUES_URL}>GitHub issues</ExternalLink>, or, if it&rsquo;s serious, privately with the <strong>?</strong> button on a game&rsquo;s page (signed in), so it can be fixed before anyone else finds it. The same goes for any bug: reporting it keeps GameHub fair for everyone. Thank you!</p>
      </section>

      <section className={styles.section}>
        <h2>5. Accounts</h2>
        <p>You don't need an account to play. If you create one, you sign in with Google, and you need to be at least 13 (or older, if the law where you live says so).</p>
        <p>Your username, display name and picture are public, and so are your favorite games and your friends list. Your ratings, bookmarks and game progress are private. Don't use your profile to pretend to be someone else, to harass anyone, or for anything offensive or illegal. Names and profiles that break these rules may be changed or removed, and accounts that keep breaking them may be deleted.</p>
        <p>Only add friends you want on your public friends list, and don't send friend requests to pester people. If someone bothers you, block them with the <strong>⋯</strong> on their profile: they can't add you as a friend, and neither of you sees the other's activity. Report anyone who breaks these rules from the same menu.</p>
        <p>You can delete your account at any time in Settings. What we store about you is explained in the <Link to="/privacy">Privacy Policy</Link>.</p>
      </section>

      <section className={styles.section}>
        <h2>6. Reporting bugs and problems</h2>
        <p>Found a bug, or something that doesn't work the way it should? Please tell us, it's how GameHub gets better:</p>
        <ul>
          <li>a problem with a game: <ExternalLink href={GAMES_ISSUES_URL}>report it on GitHub</ExternalLink>, in the games' repo</li>
          <li>a problem with the site itself (accounts, saving, pages): <ExternalLink href={hubBugReportUrl()}>report it on GitHub</ExternalLink> (and see <ExternalLink href={HUB_ISSUES_URL}>what's already reported</ExternalLink>)</li>
          <li>no GitHub account? Sign in, and use the <strong>?</strong> button on the game's page to send a message</li>
        </ul>
        <p>Issues on GitHub are public, so don't put personal details in them. Messages sent from the site are private: only the developer reads them. For anything about your personal data, see the <Link to="/privacy">Privacy Policy</Link>.</p>
      </section>

      <section className={styles.section}>
        <h2>7. Limitation of Liability</h2>
        <p>GameHub is free, and provided as it is. We do our best to keep it running and your progress safe, but can&rsquo;t promise it will always be available, or that nothing is ever lost.</p>
        <p>GameHub shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.</p>
      </section>

      <section className={styles.section}>
        <h2>8. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time. We will notify users of any changes by updating the date at the bottom of these terms.</p>
      </section>

      <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>
    </div>
  </div>
);

export default Terms;
