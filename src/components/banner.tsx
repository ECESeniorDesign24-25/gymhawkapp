import Link from 'next/link';
import styles from '../styles/index.module.css';

export default function Banner() {
  return (
    <div className={styles.banner}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLink}>
          Home
        </Link>
        <Link href="/analytics" className={styles.navLink}>
          Analytics
        </Link>
        <Link href="/about" className={styles.navLink}>
          About
        </Link>
      </nav>
    </div>
  );
}
