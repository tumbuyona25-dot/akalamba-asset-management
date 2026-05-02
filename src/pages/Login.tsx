import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, LogIn } from 'lucide-react';

interface LoginProps {
  onBack: () => void;
  onRegister: () => void;
}

export default function Login({ onBack, onRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        await auth.signOut();
        setError('Please verify your email before logging in.');
        return;
      }
    } catch (err: any) {
      // Show specific error as requested
      setError('email or password is incorrect.');
    } finally {
      setLoading(false);
    }
  };

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

        <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
        <p className="text-gray-400 mb-8 font-light">Enter your credentials to access the dashboard.</p>

        <form onSubmit={handleLogin} className="space-y-4">
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

          {error && <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}

          <button 
            type="submit" disabled={loading}
            className="w-full bg-orange-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-500 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        <p className="mt-8 text-center text-gray-500 text-sm">
          Don't have an account? <button onClick={onRegister} className="text-orange-500 font-bold hover:underline">Register</button>
        </p>
      </motion.div>
    </div>
  );
}
