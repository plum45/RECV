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

    let initialCheckDone = false;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
        initialCheckDone = true;
      } else {
        if (!initialCheckDone) {
          // Give IndexedDB / localStorage a brief grace period to restore multi-device session on slow mobile browsers before marking loading false
          setTimeout(() => {
            setUser(auth.currentUser);
            setLoading(false);
            initialCheckDone = true;
          }, 600);
        } else {
          // If already checked before and now null, verify if offline before dropping user state
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            return;
          }
          setUser(null);
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
      console.warn("First ID token attempt failed, retrying without force refresh...", error);
      try {
        await new Promise(r => setTimeout(r, 600));
        return await targetUser.getIdToken(false);
      } catch (retryError) {
        console.error("Get ID token retry error:", retryError);
        return null;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
