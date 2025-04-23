import Link from 'next/link';
import styles from '../styles/index.module.css';
import { useAuth } from '../lib/auth'; 

export default function Banner() {
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

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
        {isAuthenticated && (
          <button 
            onClick={handleLogout} 
            className={`${styles.navLink} ${styles.logoutButton}`}
          >
            Logout
          </button>
        )}
      </nav>
    </div>
  );
}
