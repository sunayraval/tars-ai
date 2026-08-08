'use client';

/**
 * AuthContext
 *
 * Wraps Firebase Auth state and exposes it to the component tree.
 * On auth state change, creates or updates the user document in Firestore.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  subscribeToAuthChanges,
  signInWithGoogle,
  signOut as firebaseSignOut,
} from '@/lib/firebase/auth';
import { createUserDocument } from '@/lib/firebase/firestore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Persist user document on sign-in
      if (firebaseUser) {
        try {
          await createUserDocument({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            preferences: {},
          });
        } catch (err) {
          console.error('Failed to create/update user document:', err);
        }
      }
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed:', err);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut();
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
}
