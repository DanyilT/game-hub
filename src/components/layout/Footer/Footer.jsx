import { Link } from 'react-router';
import { developer } from '../../../data/games';
import styles from './Footer.module.scss';

// Links out from the catalogue's `developer` section (src/data/games.json)
const LinkItems = ({ links }) =>
  links.map(({ label, url, Icon }) => (
    <li key={url}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </a>
    </li>
  ));

const Footer = () => (
  <footer className={styles.footer}>
    <div className={styles.footerContent}>
      <section className={styles.footerSection}>
        <h3>About GameHub</h3>
        <p>
          A collection of fun and interactive games built with modern web technologies (not flash).
          And this page has RGB, so it is 100% gamerproof.
          Each game is carefully crafted to provide an engaging experience.
          Have fun! 😸
        </p>
      </section>

      <section className={styles.footerSection}>
        <h3>Legal</h3>
        <ul>
          <li><Link to="/terms">Terms & Conditions</Link></li>
          <li><Link to="/privacy">Privacy Policy</Link></li>
          <LinkItems links={developer.repos} />
        </ul>
      </section>
  
      {developer.projects.length > 0 && (
        <section className={styles.footerSection}>
          <h3>More by {developer.name}</h3>
          <ul>
            <LinkItems links={developer.projects} />
          </ul>
        </section>
      )}

      {developer.socials.length > 0 && (
        <section className={styles.footerSection}>
          <h3>Social</h3>
          <ul>
            <LinkItems links={developer.socials} />
          </ul>
        </section>
      )}
    </div>

    <div className={styles.footerBottom}>
      <p>
        <strong>
          &copy; 2025-{new Date().getFullYear()}{' '}
          <a href={developer.url} target="_blank" rel="noopener noreferrer"><b>{developer.name}</b></a>.
        </strong>{' '}
        All rights reserved.
      </p>
    </div>
  </footer>
);

export default Footer;
