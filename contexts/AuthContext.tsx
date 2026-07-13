/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, onIdTokenChanged, setPersistence, browserLocalPersistence, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  getIdToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    
    // Ensure persistence is set to local storage across all tabs and devices
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    let initialCheckDone = false;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!initialCheckDone) {
        if (!currentUser) {
          // Give IndexedDB / localStorage a brief grace period to restore multi-device session on slow mobile browsers before marking loading false
          setTimeout(() => {
            setUser(auth.currentUser);
            setLoading(false);
            initialCheckDone = true;
          }, 450);
        } else {
          setLoading(false);
          initialCheckDone = true;
        }
      }
    });

    const unsubscribeToken = onIdTokenChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    const targetUser = user || auth?.currentUser;
    if (!targetUser) return null;
    try {
      return await targetUser.getIdToken(forceRefresh);
    } catch (error) {
      console.error("Get ID token error", error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
