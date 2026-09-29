import { Link } from 'react-router';
import { developer } from '../../data/games';
import styles from './Legal.module.scss';

// Change this whenever the policy changes. Keep it in step with what the site really does:
// sign-in providers, where data is stored, and which other sites pages load from (the CSP in vite.config.js lists them).
const LAST_UPDATED = '29 September 2026';

const Privacy = () => (
  <div className={styles.page}>
    <div className={styles.container}>
      <h1>Privacy Policy</h1>

      <p className={styles.intro}>
        GameHub is a hobby project by{' '}
        <a href={developer.url} target="_blank" rel="noopener noreferrer">{developer.name}</a>.
        This page explains what the site stores about you, why, and how to get rid of it, and which other sites your browser contacts while you use it.
      </p>

      <section className={styles.section}>
        <h2>1. Playing without an account</h2>
        <p>You can browse and play every game without an account. GameHub then keeps nothing about you on a server. Your browser remembers a few small things on your device: whether the sidebar is expanded and, for the suggestion to install GameHub as an app, how many games you've opened, when you last chose "Not now", and whether you've installed it.</p>
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
        <h2>3. Where it's stored</h2>
        <p>Accounts and profiles are stored with <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase</a>, in its data centre in the EU. The site itself is served by <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare</a>, which handles technical data such as your IP address to deliver pages and protect the site from abuse.</p>
      </section>

      <section className={styles.section}>
        <h2>4. Other sites the pages load from</h2>
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
        <h2>5. Cookies and storage on your device</h2>
        <p>GameHub has no ads, no analytics and no tracking cookies. Besides those settings, some games save things like your high score or progress in your browser, each under its own address. That stays on your device.</p>
        <p>When you sign in, your browser keeps a sign-in token in its local storage, so you stay signed in. Signing out removes it.</p>
      </section>

      <section className={styles.section}>
        <h2>6. Deleting your data</h2>
        <p>Your data is kept for as long as you have an account. <strong>Settings → Delete account</strong> deletes your account, your profile and your list of usernames straight away. If a backup of the database was made before that, your data stays in that backup until the backup is deleted.</p>
      </section>

      <section className={styles.section}>
        <h2>7. Your rights</h2>
        <p>You can see and change your profile in Settings at any time, and delete your account there. If you live in the EU or UK, the GDPR also lets you ask for a copy of your data, or ask questions about how it's used. To do that, or for anything else about your privacy, contact {developer.name} through <a href={developer.url} target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
      </section>

      <section className={styles.section}>
        <h2>8. Children</h2>
        <p>Accounts are for people aged 13 and over (or older, if the law where you live says so). See the <Link to="/terms">Terms</Link>.</p>
      </section>

      <section className={styles.section}>
        <h2>9. Changes</h2>
        <p>If this policy changes, the date at the bottom changes too. Bigger changes will be announced on the site.</p>
      </section>

      <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>
    </div>
  </div>
);

export default Privacy;
