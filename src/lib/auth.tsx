// auth.tsx
import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { useRouter } from 'next/router';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  logout: async () => {},
  loading: true,
  user: null,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const logout = async () => {
    try {
      await auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
      setIsAdmin(false);
      router.push('/login');
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setIsAuthenticated(!!user);
      setUser(user);
      setLoading(false);

      if (user) {
        // Reference to the admin document with the user's UID
        const adminDocRef = doc(db, "admins", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        // Set isAdmin to true if the document exists and has isAdmin: true
        setIsAdmin(adminDocSnap.exists() && adminDocSnap.data().isAdmin === true);
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
      <AuthContext.Provider value={{ isAuthenticated, logout, loading, user, isAdmin }}>
        {children}
      </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
