import styles from '../styles/index.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div>© {new Date().getFullYear()} GymHawk. The University of Iowa.</div>
    </footer>
  );
}
