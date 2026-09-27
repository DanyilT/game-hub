import styles from './Legal.module.scss';

// Change this whenever the terms text changes
const LAST_UPDATED = '13 May 2025';

const Terms = () => (
  <div className={styles.page}>
    <div className={styles.container}>
      <h1>Terms & Conditions</h1>

      <section className={styles.section}>
        <h2>1. Introduction</h2>
        <p>Welcome to GameHub. These terms and conditions outline the rules and regulations for the use of our website.</p>
      </section>

      <section className={styles.section}>
        <h2>2. Intellectual Property Rights</h2>
        <p>All content on this website, including but not limited to text, graphics, logos, and software, is the property of GameHub and is protected by copyright laws.</p>
      </section>

      <section className={styles.section}>
        <h2>3. User Responsibilities</h2>
        <p>Users are responsible for maintaining the confidentiality of their account information and for all activities that occur under their account.</p>
      </section>

      <section className={styles.section}>
        <h2>4. Limitation of Liability</h2>
        <p>GameHub shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.</p>
      </section>

      <section className={styles.section}>
        <h2>5. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time. We will notify users of any changes by updating the date at the bottom of these terms.</p>
      </section>

      <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>
    </div>
  </div>
);

export default Terms;
