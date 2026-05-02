/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { UserProfile } from './types';
import { doc, onSnapshot } from 'firebase/firestore';

// Pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'dashboard' | 'admin'>('landing');

  useEffect(() => {
    let profileUnsub: () => void = () => {};

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        // We set the user even if not verified yet, so we can show verification UI if needed
        // but for now we follow the existing logic of only allowing verified in dashboard
        setUser(firebaseUser);
        
        if (firebaseUser.emailVerified) {
          // Subscribe to user profile changes
          profileUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            } else {
              console.warn('Profile document does not exist for uid:', firebaseUser.uid);
              setProfile(null);
            }
            setLoading(false);
          }, (err) => {
            console.error('Profile subscription error:', err);
            setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
        profileUnsub();
      }
    });

    return () => {
      unsubscribe();
      profileUnsub();
    };
  }, []);

  // Simple Router based on state
  useEffect(() => {
    if (!loading) {
      if (user && user.emailVerified) {
        if (view === 'login' || view === 'register' || view === 'landing') {
          setView('dashboard');
        }
      } else {
        // If not logged in or not verified, only allow landing/login/register
        if (view === 'dashboard' || view === 'admin') {
          setView('login');
        }
      }
    }
  }, [user, loading, view]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-sans">
        <div className="animate-pulse text-orange-500 font-bold tracking-widest text-xl">AKALAMBA</div>
      </div>
    );
  }

  const navigate = (newView: typeof view) => setView(newView);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-orange-500/30">
      {view === 'landing' && <Landing onLogin={() => navigate('login')} onRegister={() => navigate('register')} />}
      {view === 'login' && <Login onBack={() => navigate('landing')} onRegister={() => navigate('register')} />}
      {view === 'register' && <Register onBack={() => navigate('landing')} onLogin={() => navigate('login')} />}
      {view === 'dashboard' && (
        profile ? (
          <Dashboard 
            user={user!} 
            profile={profile} 
            onLogout={() => auth.signOut()} 
            onAdmin={() => navigate('admin')}
          />
        ) : (
          <div className="min-h-screen bg-black flex items-center justify-center p-12 text-center">
            <div className="space-y-4">
              <p className="text-orange-500 font-bold">Profile Initializing...</p>
              <p className="text-gray-500 text-sm max-w-xs">If this takes too long, please ensure your account creation was successful or try logging in again.</p>
              <button onClick={() => auth.signOut()} className="text-white bg-white/10 px-4 py-2 rounded-lg text-xs">Sign Out</button>
            </div>
          </div>
        )
      )}
      {view === 'admin' && <AdminPanel onBack={() => navigate('dashboard')} />}
    </div>
  );
}
