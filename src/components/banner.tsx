import Link from 'next/link';
import styles from '../styles/index.module.css';
import { useAuth } from '../lib/auth'; 

export default function Banner() {
  const { isAuthenticated } = useAuth(); // Get authentication status

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
        {!isAuthenticated && (
          <Link href="/login" className={styles.navLink}> 
            Login
          </Link>
        )}
        {!isAuthenticated && (
          <Link href="/create-account" className={styles.navLink}>
            Sign Up
          </Link>
        )}
      </nav>
    </div>
  );
}
