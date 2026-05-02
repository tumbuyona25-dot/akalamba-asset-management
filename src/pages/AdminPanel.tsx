import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { 
  collection, query, orderBy, onSnapshot, doc, getDoc, 
  updateDoc, addDoc, serverTimestamp, increment, writeBatch 
} from 'firebase/firestore';
import { 
  UserProfile, Withdrawal, OperationType, UserRank, NewsItem, SupportMessage 
} from '../types';
import { handleFirestoreError } from '../lib/firestore-utils';
import { motion } from 'motion/react';
import { 
  ArrowLeft, CheckCircle, XCircle, DollarSign, 
  Users, Newspaper, Send, Search, Loader2, MessageSquare, TrendingUp, Trophy
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
  const [memberSearch, setMemberSearch] = useState('');
  const [profitAmount, setProfitAmount] = useState('');
  const [postingProfit, setPostingProfit] = useState(false);
  
  // Member Editor State
  const [editingUserId, setEditingUserId] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editVolume, setEditVolume] = useState('');
  const [editProfit, setEditProfit] = useState('');
  const [updatingUser, setUpdatingUser] = useState(false);
  
  // News State
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [postingNews, setPostingNews] = useState(false);
  
  // Support Terminal State
  const [supportTickets, setSupportTickets] = useState<SupportMessage[]>([]);
  const [activeTicketUserId, setActiveTicketUserId] = useState<string | null>(null);
  const [adminReply, setAdminReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isAdminLocal, setIsAdminLocal] = useState(false);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);

  useEffect(() => {
    const checkIsAdmin = async () => {
      const isActuallyAdmin = 
        auth.currentUser?.email?.toLowerCase() === 'tumbuyona25@gmail.com' || 
        auth.currentUser?.email?.toLowerCase() === 'tumbuyona25+admin@gmail.com' || 
        auth.currentUser?.uid === 'njO30nloO9c4Qq9fZRTfodj2afE3';

      if (isActuallyAdmin) {
        setIsAdminLocal(true);
        setIsLoadingAdmin(false);
      } else {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', auth.currentUser?.uid || 'none'));
          if (adminDoc.exists()) {
            setIsAdminLocal(true);
          }
        } catch (e) {
          console.warn('Admin check failed:', e);
        } finally {
          setIsLoadingAdmin(false);
        }
      }
    };
    checkIsAdmin();
  }, []);

  useEffect(() => {
    if (!isAdminLocal || isLoadingAdmin) return;

    const usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error('Admin Users sub error:', err);
      if (err.message.includes('permission')) {
        setError('Super Admin privileges not recognized. Please check your credentials or security rules.');
      }
      setLoading(false);
    });

    const withdrawalsUnsub = onSnapshot(
      query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc')),
      (snap) => {
        setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Withdrawal)));
      },
      (err) => console.error('Admin Withdrawals sub error:', err)
    );

    const supportUnsub = onSnapshot(
      query(collection(db, 'support_messages'), orderBy('createdAt', 'desc')),
      (snap) => {
        setSupportTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage)));
      },
      (err) => console.error('Admin Support sub error:', err)
    );

    return () => {
      usersUnsub();
      withdrawalsUnsub();
      supportUnsub();
    };
  }, [isAdminLocal, isLoadingAdmin]);

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
        balance: increment(amount), // Distribute profit to user balance
        totalProfit: increment(amount),
        teamVolume: increment(amount),
      });

      // 4. Distribute Referral Commissions (Auto)
      let currentSponsorId = memberData.referrerId;

      for (let i = 0; i < 3; i++) {
        if (!currentSponsorId) break;

        const sponsorRef = doc(db, 'users', currentSponsorId);
        const sponsorSnap = await getDoc(sponsorRef);
        
        if (sponsorSnap.exists()) {
          const sponsorData = sponsorSnap.data() as UserProfile;
          
          // Determine percentage based on sponsor's rank
          let rankPercentage = 0;
          if (sponsorData.rank === UserRank.PLATINUM) rankPercentage = 0.02; // 2%
          else if (sponsorData.rank === UserRank.GOLD) rankPercentage = 0.015; // 1.5%
          else if (sponsorData.rank === UserRank.SILVER) rankPercentage = 0.01; // 1%
          else if (sponsorData.rank === UserRank.BRONZE) rankPercentage = 0.005; // 0.5%
          else rankPercentage = 0.002; // Basic/Start: 0.2%

          const commAmount = amount * rankPercentage;
          
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

          // Check Rank Upgrade & Auto Salary payout
          const newVolume = (sponsorData.teamVolume || 0) + amount;
          let newRank = sponsorData.rank;
          let salaryBonus = 0;

          if (newVolume >= 100000 && sponsorData.rank !== UserRank.PLATINUM) {
            newRank = UserRank.PLATINUM;
            salaryBonus = 1500;
          } else if (newVolume >= 50000 && sponsorData.rank !== UserRank.GOLD) {
            newRank = UserRank.GOLD;
            salaryBonus = 700;
          } else if (newVolume >= 20000 && sponsorData.rank !== UserRank.SILVER) {
            newRank = UserRank.SILVER;
            salaryBonus = 300;
          } else if (newVolume >= 5000 && sponsorData.rank !== UserRank.BRONZE) {
            newRank = UserRank.BRONZE;
            salaryBonus = 100;
          }

          if (newRank !== sponsorData.rank) {
            batch.update(sponsorRef, { 
              rank: newRank,
              balance: increment(salaryBonus) 
            });
            
            // Record Salary entry
            const salaryLogRef = doc(collection(db, 'profits'));
            batch.set(salaryLogRef, {
              userId: currentSponsorId,
              amount: salaryBonus,
              type: 'SALARY',
              rank: newRank,
              createdAt: serverTimestamp()
            });
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

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setUpdatingUser(true);
    try {
      await updateDoc(doc(db, 'users', editingUserId), {
        balance: parseFloat(editBalance) || 0,
        teamVolume: parseFloat(editVolume) || 0,
        totalProfit: parseFloat(editProfit) || 0,
      });
      alert('Member data updated successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${editingUserId}`);
    } finally {
      setUpdatingUser(false);
    }
  };

  const selectUserForEdit = (userId: string) => {
    const user = users.find(u => u.uid === userId);
    if (user) {
      setEditingUserId(userId);
      setEditBalance(user.balance.toString());
      setEditVolume(user.teamVolume.toString());
      setEditProfit((user.totalProfit || 0).toString());
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReply.trim() || !activeTicketUserId) return;
    setSendingReply(true);
    try {
      await addDoc(collection(db, 'support_messages'), {
        userId: activeTicketUserId,
        userName: 'Akalamba Admin',
        userEmail: 'support@akalamba.com',
        message: adminReply,
        isAdmin: true,
        createdAt: serverTimestamp()
      });
      setAdminReply('');
      alert('Reply sent to user!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'support_messages');
    } finally {
      setSendingReply(false);
    }
  };

  if (isLoadingAdmin || (isAdminLocal && loading)) return <div className="p-12 text-center text-gray-500 font-sans">Accessing Akalamba Records...</div>;

  if (!isAdminLocal) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0A0A0A] border border-red-900/30 p-8 rounded-3xl text-center space-y-6">
          <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-600/20">
            <XCircle className="text-red-500" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white">Access Restricted</h1>
          <p className="text-gray-400 text-sm">Super Admin privileges not recognized. Please check your credentials or security rules.</p>
          <div className="p-4 bg-white/5 rounded-xl text-[10px] text-gray-500 font-mono text-left break-all">
            Authenticated as: {auth.currentUser?.email} | UID: {auth.currentUser?.uid}
          </div>
          <button onClick={onBack} className="w-full bg-white/5 py-4 rounded-xl font-bold hover:bg-white/10 transition-all border border-white/5 flex items-center justify-center gap-2">
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 bg-black min-h-screen text-white space-y-12 pb-32">
      <header className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all" title="Back to Dashboard"><ArrowLeft size={20} /></button>
          <h1 className="text-3xl font-bold tracking-tight">Admin Backoffice</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block bg-orange-600/20 text-orange-500 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-orange-600/30">
            Super Admin Privileges
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="px-4 py-2 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-lg text-xs font-bold transition-all border border-white/5"
          >
            Terminal Logout
          </button>
        </div>
      </header>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-red-500 text-center space-y-2">
          <p className="font-bold mb-1">Access Restricted</p>
          <p className="text-sm">{error}</p>
          <div className="text-[10px] text-gray-500 font-mono mt-4">
            Authenticated as: {auth.currentUser?.email || 'Unknown'} | 
            UID: {auth.currentUser?.uid || 'None'}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-all"
          >
            Force Sync Terminal
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Profit Entry */}
        <section className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-green-500"><DollarSign size={20} /> Record Trading Profit</h2>
          <form onSubmit={handlePostProfit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Member Search (Name/Email/MT5)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text" 
                    value={memberSearch} 
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search members..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-green-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Select Member Result</label>
                <select 
                  value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500 appearance-none text-sm text-white"
                >
                  <option value="" className="bg-[#0A0A0A]">Choose a member...</option>
                  {users
                    .filter(u => 
                      !memberSearch || 
                      u.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      (u.mt5Login || '').toLowerCase().includes(memberSearch.toLowerCase())
                    )
                    .map(u => (
                      <option key={u.uid} value={u.uid} className="bg-[#0A0A0A]">
                        {u.displayName} ({u.email})
                      </option>
                    ))}
                </select>
                <p className="mt-2 text-[10px] text-gray-500 italic">Showing {users.filter(u => !memberSearch || u.displayName.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase()) || (u.mt5Login || '').toLowerCase().includes(memberSearch.toLowerCase())).length} matches</p>
              </div>
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
              type="submit" disabled={postingProfit || !selectedUserId}
              className="w-full bg-green-600 py-4 rounded-xl font-bold hover:bg-green-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {postingProfit ? <Loader2 className="animate-spin" /> : 'Distribute Profit & Commissions'}
            </button>
          </form>
        </section>

        {/* Member Data Editor */}
        <section className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-yellow-500"><Search size={20} /> Advanced Member Editor</h2>
          <form onSubmit={handleUpdateMember} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Editor Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text" 
                    value={memberSearch} 
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search members to edit..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-yellow-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Select Member to Modify</label>
                <select 
                  value={editingUserId} onChange={e => selectUserForEdit(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-yellow-500 appearance-none text-sm text-white"
                >
                  <option value="" className="bg-[#0A0A0A]">Select a member...</option>
                  {users
                    .filter(u => 
                      !memberSearch || 
                      u.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(memberSearch.toLowerCase())
                    )
                    .map(u => (
                      <option key={u.uid} value={u.uid} className="bg-[#0A0A0A]">
                        {u.displayName} (Bal: ${u.balance.toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            {editingUserId && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Balance ($)</label>
                  <input type="number" step="0.01" value={editBalance} onChange={e => setEditBalance(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-yellow-500 text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Total Profit ($)</label>
                  <input type="number" step="0.01" value={editProfit} onChange={e => setEditProfit(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-yellow-500 text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Team Volume ($)</label>
                  <input type="number" step="1" value={editVolume} onChange={e => setEditVolume(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-yellow-500 text-sm" />
                </div>
              </div>
            )}
            <button 
              type="submit" disabled={updatingUser || !editingUserId}
              className="w-full bg-yellow-600/20 text-yellow-500 border border-yellow-600/30 py-3 rounded-xl font-bold hover:bg-yellow-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {updatingUser ? <Loader2 className="animate-spin text-sm" /> : 'Apply Manual Changes'}
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

        {/* Support Terminal */}
        <section className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl shadow-xl lg:col-span-2">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-pink-400"><MessageSquare size={20} /> Master Support Terminal</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 border-r border-white/5 pr-4 space-y-2 overflow-y-auto max-h-[400px]">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-4">Recent Inquiries</h3>
              {Array.from(new Set(supportTickets.map(t => t.userId))).map(uid => {
                const lastMsg = supportTickets.find(t => t.userId === uid);
                return (
                  <button 
                    key={uid}
                    onClick={() => setActiveTicketUserId(uid)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${activeTicketUserId === uid ? 'bg-pink-600/20 border border-pink-600/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
                  >
                    <p className="font-bold text-xs truncate">{lastMsg?.userName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{lastMsg?.message}</p>
                  </button>
                );
              })}
              {supportTickets.length === 0 && <div className="text-gray-600 text-xs italic">No tickets found.</div>}
            </div>

            <div className="md:col-span-2 space-y-4">
              {activeTicketUserId ? (
                <>
                  <div className="bg-white/5 rounded-xl border border-white/5 h-[300px] overflow-y-auto p-4 flex flex-col gap-3">
                    {supportTickets
                      .filter(t => t.userId === activeTicketUserId)
                      .reverse()
                      .map((msg, i) => (
                        <div key={i} className={`max-w-[80%] p-3 rounded-xl text-xs ${msg.isAdmin ? 'bg-pink-600/20 text-pink-300 self-end' : 'bg-white/10 text-gray-300 self-start'}`}>
                          <p className="font-bold mb-1">{msg.isAdmin ? 'Super Admin (You)' : msg.userName}</p>
                          <p>{msg.message}</p>
                          <p className="text-[8px] text-gray-500 mt-1">{msg.createdAt instanceof Date ? msg.createdAt.toLocaleString() : msg.createdAt?.toDate?.().toLocaleString() || 'Recent'}</p>
                        </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <input 
                      type="text" 
                      value={adminReply} 
                      onChange={e => setAdminReply(e.target.value)}
                      placeholder="Type official response..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 text-sm"
                    />
                    <button 
                      disabled={sendingReply || !adminReply.trim()}
                      className="bg-pink-600 px-6 rounded-xl hover:bg-pink-500 transition-all disabled:opacity-50 font-bold"
                    >
                      {sendingReply ? <Loader2 className="animate-spin" size={18} /> : 'Reply'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="h-[350px] flex flex-col items-center justify-center text-gray-600 space-y-4">
                  <MessageSquare size={48} className="opacity-20" />
                  <p className="italic">Select a member inquiry to start responding</p>
                </div>
              )}
            </div>
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
          <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
            {users.map(u => (
              <div key={u.uid} className="group p-4 bg-white/5 rounded-xl text-xs border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center justify-between mb-4">
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
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => {
                      setSelectedUserId(u.uid);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 py-2 bg-green-600/20 text-green-500 border border-green-600/30 rounded-lg font-bold hover:bg-green-600 hover:text-white transition-all"
                  >
                    Select for Profit
                  </button>
                  <button 
                    onClick={() => {
                      selectUserForEdit(u.uid);
                      // Scroll to editor (it's the second section)
                      const sections = document.querySelectorAll('section');
                      if (sections[1]) sections[1].scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex-1 py-2 bg-yellow-600/20 text-yellow-500 border border-yellow-600/30 rounded-lg font-bold hover:bg-yellow-600 hover:text-white transition-all"
                  >
                    Edit Data
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
