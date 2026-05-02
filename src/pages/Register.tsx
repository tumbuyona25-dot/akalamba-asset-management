import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs, serverTimestamp, limit } from 'firebase/firestore';
import { UserRank } from '../types';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, UserPlus, Mail, LogIn } from 'lucide-react';

interface RegisterProps {
  onBack: () => void;
  onLogin: () => void;
}

export default function Register({ onBack, onLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [refCode, setRefCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('ref');
    if (code) setRefCode(code.toUpperCase());
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Validate referral code if provided
      let referrerId = null;
      if (refCode) {
        const q = query(
          collection(db, 'users'), 
          where('referralCode', '==', refCode.toUpperCase()),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          referrerId = snap.docs[0].id;
        } else {
          throw new Error('Invalid referral code');
        }
      }

      // 2. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      // 3. Create Profile in Firestore
      const myRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email,
        displayName: name,
        referralCode: myRefCode,
        referrerId: referrerId,
        mt5Login: '',
        balance: 0,
        totalProfit: 0,
        teamVolume: 0,
        rank: UserRank.BASIC,
        createdAt: serverTimestamp()
      });

      // 4. Send verification email
      await sendEmailVerification(user);
      
      // Sign out to prevent automatic login
      await signOut(auth);
      
      setVerificationSent(true);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('user already exist. Please sign in.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white/5 p-8 rounded-2xl border border-white/10 shadow-2xl text-center"
        >
          <div className="w-20 h-20 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-500">
            <Mail size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-4">Verify Your Email</h2>
          <p className="text-gray-400 mb-8 font-light leading-relaxed">
            We have sent you a verification email to <span className="text-white font-medium">{email}</span>. Please verify it and log in.
          </p>
          <button 
            onClick={onLogin}
            className="w-full bg-orange-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-500 transition-all"
          >
            <LogIn size={18} /> Go to Log In
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/5 p-8 rounded-2xl border border-white/10 shadow-2xl"
      >
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <h2 className="text-3xl font-bold mb-2">Create Account</h2>
        <p className="text-gray-400 mb-8 font-light">Join the Akalamba network today.</p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-tight text-gray-500 mb-2">Full Name</label>
            <input 
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-colors"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-tight text-gray-500 mb-2">Email Address</label>
            <input 
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-colors"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-tight text-gray-500 mb-2">Password</label>
            <input 
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-colors"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-tight text-gray-500 mb-2">Referral Code (Optional)</label>
            <input 
              type="text" value={refCode} onChange={e => setRefCode(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-colors"
              placeholder="XYZ123"
            />
          </div>
          {error && <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}

          <button 
            type="submit" disabled={loading}
            className="w-full bg-orange-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-500 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><UserPlus size={18} /> Register</>}
          </button>
        </form>

        <p className="mt-8 text-center text-gray-500 text-sm">
          Already have an account? <button onClick={onLogin} className="text-orange-500 font-bold hover:underline">Sign In</button>
        </p>
      </motion.div>
    </div>
  );
}
