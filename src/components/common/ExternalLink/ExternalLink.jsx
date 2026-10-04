/**
 * A link to another site, opened in a new tab. Screen readers hear that it opens a new tab; `arrow` also shows a ↗
 * after it, for links that don't otherwise look like they leave the site.
 * @param {string} href
 * @param {boolean} [arrow] - show ↗ after the link's text
 */
const ExternalLink = ({ href, arrow = false, children, ...rest }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
    {children}
    {arrow && <span aria-hidden="true"> ↗</span>}
    <span className="visually-hidden"> (opens in a new tab)</span>
  </a>
);

export default ExternalLink;
