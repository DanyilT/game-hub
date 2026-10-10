import styles from './PageTitle.module.scss';

/**
 * A page's title (its h1), in the site's neon gradient sliding through it
 * @param {'start'|'center'} [align]
 */
const PageTitle = ({ align = 'start', className = '', children, ...rest }) => (
  <h1 className={[styles.title, styles[align], className].filter(Boolean).join(' ')} {...rest}>{children}</h1>
);

export default PageTitle;
