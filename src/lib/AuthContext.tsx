import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from './firestore-errors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  isAuthorized: false,
  isAdmin: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const PRIMARY_ADMIN_EMAIL = "ravindijason@gmail.com";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);
      
      if (user) {
        const userEmail = user.email?.toLowerCase();
        const isPrimaryAdmin = userEmail === PRIMARY_ADMIN_EMAIL.toLowerCase();
        
        // Check authorization
        let authorized = isPrimaryAdmin;
        if (!authorized && userEmail) {
          try {
            const inviteDoc = await getDoc(doc(db, 'invitations', userEmail));
            if (inviteDoc.exists()) {
              authorized = true;
              // Update status to accepted if it was pending
              if (inviteDoc.data().status === 'pending') {
                await setDoc(doc(db, 'invitations', userEmail), { status: 'accepted' }, { merge: true });
              }
            }
          } catch (error) {
            console.error("Auth check error:", error);
          }
        }
        
        setIsAuthorized(authorized);
        // Strictly set isAdmin based on primary admin status initially
        setIsAdmin(isPrimaryAdmin);

        if (authorized) {
          const userDocRef = doc(db, 'users', user.uid);
          try {
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
              const newProfile: UserProfile = {
                uid: user.uid,
                displayName: user.displayName || 'User',
                email: user.email || '',
                dailyCalorieGoal: 2000,
                dailyWaterGoal: 2000,
                createdAt: new Date().toISOString(),
                role: 'user' // Explicitly set default role
              };
              await setDoc(userDocRef, newProfile);
              setProfile(newProfile);
            } else {
              const data = userDoc.data() as UserProfile;
              setProfile(data);
              // Update isAdmin based on DB role, overriding initial state if necessary
              setIsAdmin(isPrimaryAdmin || data.role === 'admin');
            }
          } catch (error) {
            console.error("Profile fetch error:", error);
          }
        }
      } else {
        setProfile(null);
        setIsAuthorized(false);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Separate effect for real-time invitation updates
  useEffect(() => {
    if (!user) return;

    const userEmail = user.email?.toLowerCase();
    if (!userEmail) return;

    const inviteDocRef = doc(db, 'invitations', userEmail);
    const unsubInvite = onSnapshot(inviteDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsAuthorized(true);
        if (data.status === 'pending') {
          await setDoc(inviteDocRef, { status: 'accepted' }, { merge: true });
        }
      }
    }, (error) => {
      console.error("Invite listener error:", error);
    });

    return () => unsubInvite();
  }, [user]);

  // Separate effect for real-time profile updates
  useEffect(() => {
    if (!user || !isAuthorized) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as UserProfile;
        setProfile(data);
        const isPrimaryAdmin = user?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
        setIsAdmin(isPrimaryAdmin || data.role === 'admin');
      }
    }, (error) => {
      console.error("Profile listener error:", error);
    });

    return () => unsubProfile();
  }, [user, isAuthorized]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, isAuthorized, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);