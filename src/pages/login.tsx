// src/pages/login.tsx
import { useState } from "react";
import { useRouter } from "next/router";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../lib/firebase";
import styles from "../styles/index.module.css";
import Banner from "../components/banner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/"); // Redirect on successful login
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.container}>
      <Banner />
      <div className={styles.loginContainer}>
        <div className={styles.contentWrapper}>
          <h1 className={styles.title}>Login</h1>
          {error && <p className={styles.error}>{error}</p>}
          
          <form onSubmit={handleLogin} className={styles.form}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
            <button type="submit" className={`${styles.button} ${styles.blackButton}`}>
              Login with Email
            </button>
          </form>
          
          <div className={styles.divider}>
            <span>or</span>
          </div>

          <button 
            onClick={handleGoogleLogin} 
            className={`${styles.button} ${styles.goldButton}`}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
