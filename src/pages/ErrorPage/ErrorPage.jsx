import { Link } from 'react-router';
import styles from './ErrorPage.module.scss';

// What each status says (the picture comes from http.cat)
const ERRORS = {
  404: { title: 'Page not found', text: "There's nothing at this address. The link may be wrong, or the page has moved." },
  418: { title: "I'm a teapot", text: "This server is a teapot, not a coffee machine. It can't brew coffee." },
  500: { title: 'Something went wrong', text: 'This page crashed. Reloading usually fixes it.' },
};

/**
 * An error page in the site's style, with the http.cat cat for the status code.
 * @param {number} status - one of ERRORS: 404 (nothing here), 418 (a teapot) or 500 (the page crashed; see ErrorBoundary)
 * @param {string} [title] - replaces the status's usual title (e.g. "Game not found")
 * @param {string} [text] - replaces the status's usual text
 */
const ErrorPage = ({ status, title, text }) => {
  const error = ERRORS[status] ?? ERRORS[500];
  return (
    <div className={styles.errorPage}>
      <p className={styles.code}>Error {status}</p>
      <h1>{title ?? error.title}</h1>
      <p className={styles.text}>{text ?? error.text}</p>

      <figure className={styles.cat}>
        <div className={styles.catCrop}>
          <img src={`https://http.cat/${status}`} alt={`A cat acting out error ${status}`} width="750" height="600" />
        </div>
        <figcaption>
          Cat by <a href="https://http.cat" target="_blank" rel="noopener noreferrer">http.cat</a>
        </figcaption>
      </figure>

      <div className={styles.actions}>
        {status === 500 && (
          <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
            Reload
          </button>
        )}
        <Link to="/games" className={status === 500 ? styles.secondary : styles.primary}>Back to Games</Link>
      </div>
    </div>
  );
};

export default ErrorPage;
