import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, getDoc, 
  updateDoc, addDoc, serverTimestamp, increment, writeBatch 
} from 'firebase/firestore';
import { 
  UserProfile, Withdrawal, OperationType, UserRank, NewsItem 
} from '../types';
import { handleFirestoreError } from '../lib/firestore-utils';
import { motion } from 'motion/react';
import { 
  ArrowLeft, CheckCircle, XCircle, DollarSign, 
  Users, Newspaper, Send, Search, Loader2 
} from 'lucide-react';

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Profit Entry State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [profitAmount, setProfitAmount] = useState('');
  const [postingProfit, setPostingProfit] = useState(false);
  
  // News State
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [postingNews, setPostingNews] = useState(false);

  useEffect(() => {
    const usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
      setLoading(false);
    }, (err) => {
      console.error('Admin Users sub error:', err);
      setLoading(false);
    });

    const withdrawalsUnsub = onSnapshot(
      collection(db, 'withdrawals'),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Withdrawal));
        setWithdrawals(docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      },
      (err) => console.error('Admin Withdrawals sub error:', err)
    );

    return () => {
      usersUnsub();
      withdrawalsUnsub();
    };
  }, []);

  const handlePostProfit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(profitAmount);
    if (!selectedUserId || isNaN(amount) || amount <= 0) return;

    setPostingProfit(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Calculate company fee (30%)
      const companyFee = amount * 0.3;

      // 2. Log Profit Entry
      const profitRef = doc(collection(db, 'profits'));
      batch.set(profitRef, {
        userId: selectedUserId,
        amount,
        companyFee,
        distributedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // 3. Update Member's Profile
      const memberRef = doc(db, 'users', selectedUserId);
      const memberSnap = await getDoc(memberRef);
      const memberData = memberSnap.data() as UserProfile;

      batch.update(memberRef, {
        totalProfit: increment(amount),
        teamVolume: increment(amount),
      });

      // 4. Distribute Referral Commissions (Auto)
      const commissionRates = [0.05, 0.03, 0.02];
      let currentSponsorId = memberData.referrerId;

      for (let i = 0; i < 3; i++) {
        if (!currentSponsorId) break;

        const commAmount = amount * commissionRates[i];
        const sponsorRef = doc(db, 'users', currentSponsorId);
        const sponsorSnap = await getDoc(sponsorRef);
        
        if (sponsorSnap.exists()) {
          const sponsorData = sponsorSnap.data() as UserProfile;
          
          // Log commission
          const commRef = doc(collection(db, 'commissions'));
          batch.set(commRef, {
            userId: currentSponsorId,
            sourceUserId: selectedUserId,
            profitId: profitRef.id,
            amount: commAmount,
            level: i + 1,
            createdAt: serverTimestamp()
          });

          // Update sponsor balance and team volume
          batch.update(sponsorRef, {
            balance: increment(commAmount),
            teamVolume: increment(amount)
          });

          // Check Rank Upgrade
          const newVolume = (sponsorData.teamVolume || 0) + amount;
          let newRank = sponsorData.rank;

          if (newVolume >= 100000) newRank = UserRank.PLATINUM;
          else if (newVolume >= 50000) newRank = UserRank.GOLD;
          else if (newVolume >= 20000) newRank = UserRank.SILVER;
          else if (newVolume >= 5000) newRank = UserRank.BRONZE;

          if (newRank !== sponsorData.rank) {
            batch.update(sponsorRef, { rank: newRank });
          }

          currentSponsorId = sponsorData.referrerId;
        } else {
          break;
        }
      }

      await batch.commit();
      setProfitAmount('');
      alert('Profit and commissions distributed successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'profits_batch');
    } finally {
      setPostingProfit(false);
    }
  };

  const handleWithdrawalStatus = async (id: string, status: 'approved' | 'rejected', userId: string, amount: number) => {
    try {
      if (status === 'approved') {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && (userSnap.data() as UserProfile).balance >= amount) {
          await updateDoc(userRef, { balance: increment(-amount) });
        } else {
          alert('Insufficient user balance for approval');
          return;
        }
      }
      await updateDoc(doc(db, 'withdrawals', id), { 
        status, 
        processedAt: serverTimestamp() 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `withdrawals/${id}`);
    }
  };

  const handlePostNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostingNews(true);
    try {
      await addDoc(collection(db, 'news'), {
        title: newsTitle,
        content: newsContent,
        createdAt: serverTimestamp()
      });
      setNewsTitle('');
      setNewsContent('');
      alert('News broadcasted!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'news');
    } finally {
      setPostingNews(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-500 font-sans">Accessing Akalamba Records...</div>;

  return (
    <div className="p-6 md:p-12 bg-black min-h-screen text-white space-y-12 pb-32">
      <header className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"><ArrowLeft size={20} /></button>
          <h1 className="text-3xl font-bold tracking-tight">Admin Backoffice</h1>
        </div>
        <div className="bg-orange-600/20 text-orange-500 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-orange-600/30">
          Super Admin Privileges
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Profit Entry */}
        <section className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-green-500"><DollarSign size={20} /> Record Trading Profit</h2>
          <form onSubmit={handlePostProfit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Select Member</label>
              <select 
                value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500 appearance-none text-sm text-white"
              >
                <option value="" className="bg-[#0A0A0A]">Choose a member...</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid} className="bg-[#0A0A0A]">
                    {u.displayName} ({u.mt5Login || 'No MT5'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Profit Amount ($)</label>
              <input 
                type="number" step="0.01" required value={profitAmount} onChange={e => setProfitAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500"
                placeholder="1000.00"
              />
            </div>
            <button 
              type="submit" disabled={postingProfit}
              className="w-full bg-green-600 py-4 rounded-xl font-bold hover:bg-green-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {postingProfit ? <Loader2 className="animate-spin" /> : 'Distribute Profit & Commissions'}
            </button>
          </form>
        </section>

        {/* Withdrawal Management */}
        <section className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl flex flex-col shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-orange-500"><CheckCircle size={20} /> Withdrawal Requests</h2>
          <div className="flex-1 overflow-y-auto max-h-[400px] space-y-4 pr-2">
            {withdrawals.map(w => (
              <div key={w.id} className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-all">
                <div>
                  <p className="text-sm font-bold">${w.amount.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500 mb-2 font-mono">{w.address}</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    w.status === 'approved' ? 'text-green-500 bg-green-500/10' : 
                    w.status === 'rejected' ? 'text-red-500 bg-red-500/10' : 
                    'text-orange-500 bg-orange-500/10'
                  }`}>
                    {w.status}
                  </span>
                </div>
                {w.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleWithdrawalStatus(w.id, 'approved', w.userId, w.amount)} className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg"><CheckCircle size={20} /></button>
                    <button onClick={() => handleWithdrawalStatus(w.id, 'rejected', w.userId, w.amount)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"><XCircle size={20} /></button>
                  </div>
                )}
              </div>
            ))}
            {withdrawals.length === 0 && <div className="text-gray-600 text-sm italic text-center py-12">No pending requests.</div>}
          </div>
        </section>

        {/* News & Broadcast */}
        <section className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400"><Newspaper size={18} /> Broadcast Platform News</h2>
          <form onSubmit={handlePostNews} className="space-y-4">
            <input 
              type="text" required value={newsTitle} onChange={e => setNewsTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Headline..."
            />
            <textarea 
              required value={newsContent} onChange={e => setNewsContent(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 min-h-[100px]"
              placeholder="Content..."
            />
            <button 
              type="submit" disabled={postingNews}
              className="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={18} /> Broadcast
            </button>
          </form>
        </section>

        {/* Members Overview */}
        <section className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-purple-400"><Users size={20} /> Members Directory</h2>
          <div className="space-y-4 overflow-y-auto max-h-[400px]">
            {users.map(u => (
              <div key={u.uid} className="flex items-center justify-between p-4 bg-white/5 rounded-xl text-xs border border-white/5">
                <div>
                  <p className="font-bold text-sm">{u.displayName}</p>
                  <p className="text-gray-500">{u.email}</p>
                  <p className="text-orange-500 mt-1 uppercase text-[10px]">Volume: ${u.teamVolume.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold uppercase tracking-widest mb-1">{u.rank}</p>
                  <p className="text-gray-500 font-bold">Bal: ${u.balance.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
