import { Link } from 'react-router';
import ExternalLink from '../../components/common/ExternalLink/ExternalLink';
import { developer } from '../../data/games';
import PageTitle from '../../components/common/PageTitle/PageTitle';
import styles from './Legal.module.scss';

// Change this whenever the policy changes. Keep it in step with what the site really does:
// sign-in providers, where data is stored, and which other sites pages load from (the CSP in vite.config.js lists them).
const LAST_UPDATED = '11 October 2026';

const Privacy = () => (
  <div className={styles.page}>
    <div className={styles.container}>
      <PageTitle align="center" className={styles.title}>Privacy Policy</PageTitle>

      <p className={styles.intro}>
        GameHub is a hobby project by{' '}
        <ExternalLink href={developer.url}>{developer.name}</ExternalLink>.
        This page explains what the site stores about you, why, and how to get rid of it, and which other sites your browser contacts while you use it.
      </p>

      <section className={styles.section}>
        <h2>1. Playing without an account</h2>
        <p>You can browse and play every game without an account. GameHub then keeps nothing about you on a server. Your browser remembers a few small things on your device: whether the sidebar is expanded, whether you chose the sidebar or the floating button to get around (and its corner), whether you've seen the note that favorites are public, whether a game's controls were left expanded, which games you've downloaded, how long you've played each game (shown under it) and, for the suggestion to install GameHub as an app, how many games you've opened, when you last chose "Not now", and whether you've installed it.</p>
        <p>To open without a network, the site keeps a copy of itself in your browser, and of the pictures and fonts it shows. A game you download from its page is kept there too, with the game's own address, until you remove the download.</p>
      </section>

      <section className={styles.section}>
        <h2>2. When you sign in</h2>
        <p>You sign in with Google. GameHub never sees your password. Google tells GameHub:</p>
        <ul>
          <li>your email address</li>
          <li>your name</li>
          <li>your profile picture</li>
          <li>an ID for your Google account, so you get the same GameHub account next time</li>
        </ul>
        <p>Your GameHub profile is public: anyone can see your username, display name, profile picture and when you joined. Your email address and the name from your Google account are private. They're only used to run your account and are never shown to other players.</p>
        <p>GameHub also keeps a list of the usernames you've picked or kept, and when: your first one, plus the latest ones, up to 20 in all. It's how the once-every-30-days limit on changes works. Other players only ever see your current username.</p>
        <p>Signing in with Discord is coming. This page will say what Discord shares before it's switched on.</p>
      </section>

      <section className={styles.section}>
        <h2>3. What your account keeps as you play</h2>
        <ul>
          <li><strong>Your progress in each game</strong> (scores, levels, a puzzle in progress: whatever the game saves), so you can carry on from any device. Private: only you can read it. A game's <strong>?</strong> button can reset it.</li>
          <li><strong>Your ratings.</strong> Private: others only see each game's average and how many rated it.</li>
          <li><strong>Your favorites.</strong> Public: they're on your profile.</li>
          <li><strong>Your bookmarks.</strong> Private: others only see how many players bookmarked each game.</li>
          <li><strong>Your friends.</strong> Your friends list is public, on your profile. A friend request is only seen by the two of you until it's accepted.</li>
          <li><strong>Who you&rsquo;ve blocked.</strong> Private: only you see it (Settings → Privacy lists them). The player isn&rsquo;t told, though they can&rsquo;t send you a friend request.</li>
          <li><strong>Reports you send</strong> about a player: who it&rsquo;s about, why (cheating or something else), the game and what you wrote. Only GameHub&rsquo;s admins read them, and the player isn&rsquo;t told who sent one. A report is kept until your account or the reported player&rsquo;s is deleted, and so is one about you.</li>
          <li><strong>Your checked games and records.</strong> When you finish a game on a ticket (a random seed GameHub&rsquo;s server picked for it), the game goes to the server to be checked: the moves you made, with their timing, and the result the game showed. The server plays it again, and keeps what that gave as your result, so your records come only from checked games. The moves are deleted after 30 days, unless that game is one of your records; until then, you can watch it again in any browser you sign in on (each shows the days left). Games that don&rsquo;t check out are kept the same way, in case they need a closer look (see the <Link to="/terms">Terms</Link> on cheating). Your tickets are kept until they&rsquo;re used, or for a month after they run out. Private: only you see your records, and GameHub&rsquo;s admins, when looking into cheating.</li>
          <li><strong>Your roles.</strong> Every account is a player. Developers (who make games here) and admins (who look into reports and choose the developers) are given their role by an admin. Being a developer is public, on your profile and in the list of developers; being an admin is shown only to you.</li>
          <li><strong>As a developer, your bio and links</strong> (Settings → Developer). Public: on your profile, with the games you made. They&rsquo;re kept until you change them or your account is deleted, also if you stop being a developer (then they&rsquo;re hidden).</li>
          <li><strong>What you play, and for how long</strong>, unless you turn it off. Each time you play a game here: which game, when, and how many seconds you played (counted only while you're pressing keys or tapping in the game, not while it's just open). From it come the games on your profile, your play time, the games page&rsquo;s recent activity, and what you&rsquo;re playing right now (a game you played in the last 2 minutes). It&rsquo;s kept until you delete it (Settings → Privacy) or your account.</li>
          <li><strong>Messages you send us</strong>, after rating a game or from its help: what you wrote, the game, the rating you gave, and, if you tick the box, your browser's name and version. Only the developer reads them.</li>
        </ul>
        <p>In Settings → Privacy you choose whether your play history is recorded at all (when it&rsquo;s off, nothing is recorded, what was kept before is only yours, and no one sees what you&rsquo;re playing now), and while it is, who sees your played games, your recent activity and what you&rsquo;re playing now (everyone, your friends, or only you). You can also delete your play history. Out of the box it&rsquo;s on; your played games and recent activity are for everyone, and what you&rsquo;re playing now is for your friends.</p>
        <p>You can take back any rating, favorite, bookmark, friend or block at any time, and a message or report goes when your account does.</p>
      </section>

      <section className={styles.section}>
        <h2>4. Where it's stored</h2>
        <p>Accounts and profiles are stored with <ExternalLink href="https://supabase.com/privacy">Supabase</ExternalLink>, in its data centre in the EU. The site itself is served by <ExternalLink href="https://www.cloudflare.com/privacypolicy/">Cloudflare</ExternalLink>, which handles technical data such as your IP address to deliver pages and protect the site from abuse.</p>
      </section>

      <section className={styles.section}>
        <h2>5. Other sites the pages load from</h2>
        <p>Some parts of the pages come from other sites, which see your IP address when your browser fetches them:</p>
        <ul>
          <li>the games, each from its own address on dt-games.pages.dev, such as snake.dt-games.pages.dev (also run by {developer.name}, hosted on Cloudflare)</li>
          <li>game pictures, from the games' own addresses and from GitHub Pages (danyilt.github.io)</li>
          <li>the "Get it on Google Play" badge, from Google Play</li>
          <li>the fonts, from Google Fonts</li>
          <li>the cat pictures on error pages, from http.cat</li>
          <li>profile pictures, from Google</li>
        </ul>
        <p>Links to Google Play, GitHub and other sites open those sites, and their own privacy policies apply there.</p>
      </section>

      <section className={styles.section}>
        <h2>6. Cookies and storage on your device</h2>
        <p>GameHub has no ads, no analytics and no tracking cookies. Besides those settings, games save things like your high score or progress in your browser, each under its own address. When you play in GameHub signed in, that progress is also saved to your account (section 3). On a shared browser each player keeps a copy of their own there, so one player&rsquo;s progress never shows for another, and progress made without signing in stays with the browser, never going into an account.</p>
        <p>The games you finish are kept as replays in your browser, so you can watch them again under the game: the moves you made and the random numbers the game used, not a video. Each player on a browser has their own. A guest&rsquo;s never leave the browser; signed in, a game played on a ticket also goes to GameHub&rsquo;s server to be checked, and can be watched again from there in any browser while its moves are kept (section 3). Resetting a game&rsquo;s progress deletes its replays in the browser.</p>
        <p>Signed in, your browser also keeps a few tickets for each game you play or download (random seeds from GameHub&rsquo;s server, so games played offline can be checked later), and the games played offline until they&rsquo;re checked.</p>
        <p>When you sign in, your browser keeps a sign-in token in its local storage, so you stay signed in. Signing out removes it.</p>
      </section>

      <section className={styles.section}>
        <h2>7. Deleting your data</h2>
        <p>Your data is kept for as long as you have an account. <strong>Settings → Delete account</strong> deletes your account, your profile, your list of usernames, your game progress, checked games, records and tickets, ratings, favorites, bookmarks, friends, blocks, and the messages and reports you sent, straight away. If a backup of the database was made before that, your data stays in that backup until the backup is deleted.</p>
      </section>

      <section className={styles.section}>
        <h2>8. Your rights</h2>
        <p>You can see and change your profile in Settings at any time, and delete your account there. If you live in the EU or UK, the GDPR also lets you ask for a copy of your data, or ask questions about how it's used. To do that, or for anything else about your privacy, contact {developer.name} through <ExternalLink href={developer.url}>GitHub</ExternalLink>.</p>
      </section>

      <section className={styles.section}>
        <h2>9. Children</h2>
        <p>Accounts are for people aged 13 and over (or older, if the law where you live says so). See the <Link to="/terms">Terms</Link>.</p>
      </section>

      <section className={styles.section}>
        <h2>10. Changes</h2>
        <p>If this policy changes, the date at the bottom changes too. Bigger changes will be announced on the site.</p>
      </section>

      <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>
    </div>
  </div>
);

export default Privacy;
