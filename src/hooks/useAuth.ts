"use client";

import { useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";
import {
  auth,
  signInWithGoogle as firebaseSignIn,
  signOut as firebaseSignOut,
  subscribeToAuthChanges,
} from "@/lib/firebase/auth";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<User | undefined>;
  signOut: () => Promise<void>;
}

/**
 * Custom hook for Firebase auth state management.
 * Provides reactive user state, sign-in, and sign-out.
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    try {
      const result = await firebaseSignIn();
      return result;
    } catch (error) {
      console.error("Sign-in error:", error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut();
    } catch (error) {
      console.error("Sign-out error:", error);
      throw error;
    }
  }, []);

  return { user, loading, signIn, signOut };
}
