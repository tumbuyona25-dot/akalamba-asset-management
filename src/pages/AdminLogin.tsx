import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, ShieldCheck, Mail, Lock } from 'lucide-react';

interface AdminLoginProps {
  onBack: () => void;
  onAdminSuccess: () => void;
}

export default function AdminLogin({ onBack, onAdminSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Verify admin status
      const isAdminEmail = ['tumbuyona25+admin@gmail.com', 'tumbuyona25@gmail.com'].includes((user.email || '').toLowerCase());
      
      let isAdminDoc = false;
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        isAdminDoc = adminDoc.exists();
      } catch (e) {
        console.warn('Could not check admins collection, relying on email check only.');
      }

      if (isAdminDoc || isAdminEmail) {
        onAdminSuccess();
      } else {
        await auth.signOut();
        setError('Unauthorized access. Your account does not have administrator privileges.');
      }
    } catch (err: any) {
      console.error('Admin Login Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled in Firebase Console. Please enable "Email/Password" in the Authentication -> Sign-in method tab.');
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="inline-block p-4 bg-orange-500/10 rounded-full mb-4">
            <ShieldCheck className="text-orange-500 w-12 h-12" />
          </div>
          <h1 className="text-4xl font-bold tracking-tighter text-white">ADMIN PORTAL</h1>
          <p className="text-gray-500 text-sm">Authenticated access only. Monitored environment.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-[#0A0A0A] p-8 rounded-3xl border border-white/5 shadow-2xl">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input 
                type="email" 
                placeholder="Admin Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-all placeholder:text-gray-700"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input 
                type="password" 
                placeholder="Secure Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-all placeholder:text-gray-700"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 group"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                AUTHENTICATE
                <ShieldCheck size={18} className="group-hover:scale-110 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="flex justify-center">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} /> Return to Public Site
          </button>
        </div>
      </motion.div>

      <div className="fixed bottom-8 text-[10px] text-gray-800 uppercase tracking-widest font-mono">
        System ID: AKALAMBA-SECURE-NODE-01
      </div>
    </div>
  );
}
