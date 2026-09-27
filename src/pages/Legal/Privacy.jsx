import { developer } from '../../data/games';
import styles from './Legal.module.scss';

// Change this whenever the policy changes. Keep it in step with what the site really does:
// what it stores, and which other sites pages load from (the CSP in vite.config.js lists them).
const LAST_UPDATED = '26 September 2026';

const Privacy = () => (
  <div className={styles.page}>
    <div className={styles.container}>
      <h1>Privacy Policy</h1>

      <p className={styles.intro}>
        GameHub is a hobby project by{' '}
        <a href={developer.url} target="_blank" rel="noopener noreferrer">{developer.name}</a>.
        This page explains what the site stores about you, and which other sites your browser contacts while you use it.
      </p>

      <section className={styles.section}>
        <h2>1. No accounts, nothing kept about you</h2>
        <p>You browse and play without an account, and GameHub keeps nothing about you on a server. Your browser remembers one setting on your device: whether the sidebar is expanded.</p>
      </section>

      <section className={styles.section}>
        <h2>2. Hosting</h2>
        <p>The site is served by <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare</a>, which handles technical data such as your IP address to deliver pages and protect the site from abuse.</p>
      </section>

      <section className={styles.section}>
        <h2>3. Other sites the pages load from</h2>
        <p>Some parts of the pages come from other sites, which see your IP address when your browser fetches them:</p>
        <ul>
          <li>the games, from danyilt-games.pages.dev (also run by {developer.name}, hosted on Cloudflare)</li>
          <li>game pictures, from GitHub (raw.githubusercontent.com and danyilt.github.io)</li>
          <li>the "Get it on Google Play" badge, from Google Play</li>
          <li>the fonts, from Google Fonts</li>
          <li>the cat pictures on error pages, from http.cat</li>
        </ul>
        <p>Links to Google Play, GitHub and other sites open those sites, and their own privacy policies apply there.</p>
      </section>

      <section className={styles.section}>
        <h2>4. Cookies and storage on your device</h2>
        <p>GameHub has no ads, no analytics and no tracking cookies. Besides the sidebar setting, some games save things like your high score or progress in your browser. That stays on your device.</p>
      </section>

      <section className={styles.section}>
        <h2>5. Questions</h2>
        <p>For anything about your privacy, contact {developer.name} through <a href={developer.url} target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
      </section>

      <section className={styles.section}>
        <h2>6. Changes</h2>
        <p>If this policy changes, the date at the bottom changes too. Accounts are planned: this page will say what they store before sign-in opens.</p>
      </section>

      <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>
    </div>
  </div>
);

export default Privacy;
