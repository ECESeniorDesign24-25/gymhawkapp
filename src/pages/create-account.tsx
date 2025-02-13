import { useState } from "react";
import { useRouter } from "next/router";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../lib/firebase";
import styles from "../styles/index.module.css";
import Banner from "../components/banner";

export default function CreateAccount() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Here you might want to store the user's name in your database
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleSignup = async () => {
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
          <h1 className={styles.title}>Create Account</h1>
          {error && <p className={styles.error}>{error}</p>}
          
          <form onSubmit={handleCreateAccount} className={styles.form}>
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              required
            />
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
              Create Account
            </button>
          </form>
          
          <div className={styles.divider}>
            <span>or</span>
          </div>

          <button 
            onClick={handleGoogleSignup} 
            className={`${styles.button} ${styles.goldButton}`}
          >
            Sign up with Google
          </button>
        </div>
      </div>
    </div>
  );
}
