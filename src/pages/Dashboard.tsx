import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, doc, 
  updateDoc, addDoc, serverTimestamp, limit, getDoc
} from 'firebase/firestore';
import { 
  UserProfile, ProfitEntry, Commission, Withdrawal, 
  NewsItem, OperationType, SystemSettings, UserRank, SupportMessage 
} from '../types';
import { handleFirestoreError } from '../lib/firestore-utils';
import { motion } from 'motion/react';
import { 
  BarChart3, Settings, LogOut, Wallet, Users, 
  Trophy, History, ExternalLink, MessageSquare, 
  Copy, Check, LayoutGrid, Info, Send, AlertTriangle, Newspaper, XCircle, Loader2, Zap
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

import { GoogleGenAI } from '@google/genai';

interface DashboardProps {
  user: User;
  profile: UserProfile;
  onLogout: () => void;
  onAdmin: () => void;
}

export default function Dashboard({ user, profile, onLogout, onAdmin }: DashboardProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [mt5Login, setMt5Login] = useState(profile.mt5Login || '');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  const [investorPassword, setInvestorPassword] = useState('');
  const [updatingMT5, setUpdatingMT5] = useState(false);
  const [profits, setProfits] = useState<ProfitEntry[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'mt5' | 'network' | 'history'>('overview');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    // Check if admin
    getDoc(doc(db, 'admins', user.uid)).then(snap => {
      if (snap.exists() || user.email === 'tumbuyona25@gmail.com' || user.uid === 'njO30nloO9c4Qq9fZRTfodj2afE3') setIsAdmin(true);
    });

    // Subscriptions
    const profitsUnsub = onSnapshot(
      query(collection(db, 'profits'), where('userId', '==', user.uid), limit(50)),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProfitEntry));
        setProfits(docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      },
      (err) => {
        console.warn('Profits sub error (likely no index or permissions yet):', err);
        // We don't call handleFirestoreError here to avoid crashing the whole view
      }
    );

    const commissionsUnsub = onSnapshot(
      query(collection(db, 'commissions'), where('userId', '==', user.uid)),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Commission));
        setCommissions(docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      },
      (err) => console.warn('Commissions sub error:', err)
    );

    const withdrawalsUnsub = onSnapshot(
      query(collection(db, 'withdrawals'), where('userId', '==', user.uid)),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Withdrawal));
        setWithdrawals(docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      },
      (err) => console.warn('Withdrawals sub error:', err)
    );

  const newsUnsub = onSnapshot(
      query(collection(db, 'news'), limit(5)),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem));
        setNews(docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      },
      (err) => console.warn('News sub error:', err)
    );

    const settingsUnsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SystemSettings);
    }, (err) => console.warn('Settings sub error:', err));

    const supportUnsub = onSnapshot(
      query(collection(db, 'support_messages'), where('userId', '==', user.uid), orderBy('createdAt', 'asc')),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage));
        setSupportMessages(docs);
      },
      (err) => console.warn('Support sub error:', err)
    );

    return () => {
      profitsUnsub();
      commissionsUnsub();
      withdrawalsUnsub();
      newsUnsub();
      settingsUnsub();
      supportUnsub();
    };
  }, [user.uid, user.email]);

  const analyzeProfits = async () => {
    if (profits.length === 0) {
      setAiAnalysis("No trading volume found yet. Start trading to get AI performance insights.");
      return;
    }
    setAnalyzing(true);
    setIsAiOpen(true);
    try {
      const prompt = `Analyze this trading profit history for Akalamba Asset Management. 
      Latest profits: ${profits.slice(0, 5).map(p => `$${p.amount}`).join(', ')}. 
      Rank: ${profile.rank}. 
      Team Volume: $${profile.teamVolume}.
      Provide a brief, professional, premium-toned investment summary and a tip for network growth. Limit to 3 sentences.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      setAiAnalysis(result.text);
    } catch (err) {
      setAiAnalysis("AI services are currently busy optimizing the network. Please try again later.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateMT5 = async () => {
    setUpdatingMT5(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        mt5Login,
        investorPassword: investorPassword || ''
      });
      alert('MT5 Credentials Updated Successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setUpdatingMT5(false);
    }
  };

  const handleCopyRef = () => {
    const link = `${window.location.origin}?ref=${profile.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0 || amount > profile.balance) {
      alert('Invalid withdrawal amount or insufficient balance');
      return;
    }
    setRequestingWithdrawal(true);
    try {
      await addDoc(collection(db, 'withdrawals'), {
        userId: user.uid,
        amount,
        address: withdrawAddress,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setWithdrawAmount('');
      setWithdrawAddress('');
      alert('Withdrawal request submitted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'withdrawals');
    } finally {
      setRequestingWithdrawal(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      await addDoc(collection(db, 'support_messages'), {
        userId: user.uid,
        userName: profile.displayName,
        userEmail: profile.email,
        message: newMessage,
        isAdmin: false,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'support_messages');
    } finally {
      setSendingMessage(false);
    }
  };

  const chartData = profits.map(p => ({
    date: p.createdAt?.toDate().toLocaleDateString() || '',
    amount: p.amount
  })).reverse();

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505]">
      {/* Sidebar - Desktop */}
      <aside className="w-64 border-r border-white/5 bg-[#0A0A0A] hidden lg:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-sm">A</div>
            <span className="font-sans font-bold tracking-tight text-lg">AKALAMBA</span>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'overview', icon: LayoutGrid, label: 'Overview' },
              { id: 'mt5', icon: BarChart3, label: 'MT5 Trading' },
              { id: 'network', icon: Users, label: 'My Network' },
              { id: 'history', icon: History, label: 'Transactions' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === item.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4">
          {isAdmin && (
            <button 
              onClick={onAdmin}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20 transition-all"
            >
              <Settings size={18} /> Admin Backoffice
            </button>
          )}
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0 pb-12">
        <header className="p-6 md:px-12 flex items-center justify-between sticky top-0 bg-[#050505]/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-gray-500 text-sm font-light">Welcome back, {profile.displayName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">{profile.rank}</span>
              <span className="text-xs text-gray-500">Team Profit: ${profile.teamVolume.toLocaleString()}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-yellow-500 flex items-center justify-center font-bold">
              {profile.displayName.charAt(0)}
            </div>
          </div>
        </header>

        <div className="p-6 md:px-12 space-y-8">
          {activeTab === 'overview' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Available Balance', value: `$${profile.balance.toFixed(2)}`, icon: Wallet, color: 'text-green-400' },
                  { label: 'Total Profits', value: `$${profile.totalProfit.toFixed(2)}`, icon: BarChart3, color: 'text-orange-500' },
                  { label: 'Network Size', value: commissions.length, icon: Users, color: 'text-blue-400' },
                  { label: 'Current Rank', value: profile.rank, icon: Trophy, color: 'text-yellow-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <stat.icon size={48} />
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Chart & News */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-bold flex items-center gap-2"><BarChart3 size={18} className="text-orange-500" /> Performance Analysis</h3>
                    <div className="text-xs text-gray-500">Last 50 Entries</div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EA580C" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#EA580C" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#333" fontSize={10} />
                        <YAxis stroke="#333" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #222', borderRadius: '8px' }}
                          itemStyle={{ color: '#EA580C' }}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#EA580C" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-bold flex items-center gap-2 mb-6"><Newspaper size={18} className="text-blue-400" /> Platform News</h3>
                  <div className="space-y-6">
                    {news.map(item => (
                      <div key={item.id} className="border-l-2 border-white/5 pl-4 hover:border-orange-500 transition-colors">
                        <p className="text-sm font-bold mb-1">{item.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2 font-light">{item.content}</p>
                        <div className="text-[10px] text-gray-600 uppercase font-bold">{item.createdAt?.toDate().toLocaleDateString()}</div>
                      </div>
                    ))}
                    {news.length === 0 && <div className="text-gray-600 text-sm italic">No news updates yet.</div>}
                  </div>
                </div>
              </div>

              {/* Referral & Broker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-8 rounded-2xl shadow-xl shadow-orange-600/10">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Users size={24} /> Grow Your Network</h3>
                  <p className="text-white/80 text-sm mb-6 font-light">Share your unique referral link to earn up to 5% from your direct downline's trading profits automatically.</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-black/20 rounded-xl px-4 py-3 text-xs font-mono truncate items-center flex">
                      {window.location.origin}?ref={profile.referralCode}
                    </div>
                    <button 
                      onClick={handleCopyRef}
                      className="bg-white text-orange-600 px-4 py-3 rounded-xl font-bold hover:bg-black hover:text-white transition-all flex items-center gap-2"
                    >
                      {copySuccess ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-2xl flex flex-col justify-center border-dashed">
                  <h3 className="text-xl font-bold mb-4 text-blue-400 flex items-center gap-2"><ExternalLink size={24} /> Recommended Broker</h3>
                  <p className="text-gray-400 text-sm mb-6 font-light">Join our official partner broker to ensure seamless MT5 synchronization and lower spreads.</p>
                  <a 
                    href="https://fusionmarkets.com/?refcode=108821" 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full bg-blue-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                  >
                    Register with Fusion Markets <ExternalLink size={18} />
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'mt5' && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto space-y-8">
              <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl">
                <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 mb-6">
                  <BarChart3 size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">MT5 Configuration</h2>
                <p className="text-gray-500 mb-8 font-light">Submit your MT5 account credentials for manual profit monitoring by administrators.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">MT5 Login ID</label>
                    <input 
                      type="text" value={mt5Login} onChange={e => setMt5Login(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
                      placeholder="Enter MT5 ID"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Investor Password</label>
                    <input 
                      type="password" value={investorPassword} onChange={e => setInvestorPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
                      placeholder="••••••••"
                    />
                    <p className="text-[10px] text-gray-600 mt-2 italic">* We only need your investor (read-only) password for monitoring.</p>
                  </div>
                  <button 
                    onClick={handleUpdateMT5} disabled={updatingMT5}
                    className="w-full bg-blue-600 py-4 rounded-xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingMT5 ? 'Updating...' : 'Save MT5 Credentials'}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-600/10 border border-yellow-600/20 p-6 rounded-2xl flex gap-4">
                <Info size={24} className="text-yellow-600 shrink-0" />
                <div className="text-sm text-yellow-600/80 leading-relaxed font-light">
                  <strong className="block text-yellow-600 mb-1">Important</strong>
                  Your trading account is managed outside this platform. We monitor your performance to distribute network commissions and calculate leadership rank progress.
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'network' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Trophy size={20} className="text-yellow-500" /> Leadership Path</h3>
                  <div className="space-y-6">
                    {[
                      { name: 'Bronze Leader', target: 5000, salary: 100, bonus: '0.5%' },
                      { name: 'Silver Leader', target: 20000, salary: 300, bonus: '1%' },
                      { name: 'Gold Leader', target: 50000, salary: 700, bonus: '1.5%' },
                      { name: 'Platinum Leader', target: 100000, salary: 1500, bonus: '2%' }
                    ].map((rank, i) => {
                      const progress = Math.min((profile.teamVolume / rank.target) * 100, 100);
                      const isAchieved = profile.teamVolume >= rank.target;
                      return (
                        <div key={i} className={`p-4 rounded-xl border ${isAchieved ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-bold ${isAchieved ? 'text-yellow-500' : ''}`}>{rank.name}</span>
                            <span className="text-xs text-gray-500">${profile.teamVolume} / ${rank.target}</span>
                          </div>
                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
                            <div className="bg-yellow-500 h-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] uppercase font-bold text-gray-600">
                            <span>Salary: ${rank.salary}</span>
                            <span>Bonus: {rank.bonus}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl overflow-hidden flex flex-col">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Users size={20} className="text-orange-500" /> Commission Log</h3>
                  <div className="flex-1 overflow-y-auto max-h-[500px] space-y-4 pr-2">
                    {commissions.map(c => (
                      <div key={c.id} className="bg-white/5 p-4 rounded-xl flex justify-between items-center border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-green-400">+${c.amount.toFixed(2)}</span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-tighter">Level {c.level} Referral</span>
                        </div>
                        <span className="text-[10px] text-gray-600">{c.createdAt?.toDate().toLocaleDateString()}</span>
                      </div>
                    ))}
                    {commissions.length === 0 && <div className="text-gray-600 text-sm italic text-center py-12">No referral earnings yet.</div>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Withdrawals Form */}
                <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Wallet size={20} className="text-green-400" /> Withdrawal (USDT BEP20)</h3>
                  <form onSubmit={handleWithdrawal} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Amount to Withdraw</label>
                      <div className="relative">
                        <input 
                          type="number" step="0.01" required value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500 transition-colors"
                          placeholder="0.00"
                        />
                        <button 
                          type="button"
                          onClick={() => setWithdrawAmount(profile.balance.toString())}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-500 hover:text-white"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-2">USDT BEP20 Address</label>
                      <input 
                        type="text" required value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500 transition-colors"
                        placeholder="0x..."
                      />
                    </div>
                    <button 
                      type="submit" disabled={requestingWithdrawal || parseFloat(withdrawAmount) > profile.balance}
                      className="w-full bg-green-600 py-4 rounded-xl font-bold hover:bg-green-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
                    >
                      {requestingWithdrawal ? 'Requesting...' : <><Send size={18} /> Request Withdrawal</>}
                    </button>
                  </form>
                </div>

                {/* History Table */}
                <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl flex flex-col">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><History size={20} className="text-gray-400" /> Recent Withdrawals</h3>
                  <div className="space-y-4">
                    {withdrawals.map(w => (
                      <div key={w.id} className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center group">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">${w.amount.toFixed(2)}</span>
                          <span className="text-[10px] text-gray-500 truncate max-w-[150px]">{w.address}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                            w.status === 'approved' ? 'bg-green-500/10 text-green-500' : 
                            w.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 
                            'bg-orange-500/10 text-orange-500'
                          }`}>
                            {w.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {withdrawals.length === 0 && <div className="text-gray-600 text-sm italic text-center py-12">No withdrawal history.</div>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* AI Assistant Floating Button */}
        <div className="fixed bottom-6 right-6 z-50">
          {isAiOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute bottom-20 right-0 w-[calc(100vw-3rem)] sm:w-96 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-xs">AI</div>
                  <h4 className="font-bold text-sm">Profit Intelligence</h4>
                </div>
                <button onClick={() => setIsAiOpen(false)} className="text-gray-500 hover:text-white">
                  <XCircle size={18} />
                </button>
              </div>
              
              <div className="space-y-4">
                {analyzing ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Loader2 className="animate-spin text-orange-500" size={32} />
                    <p className="text-xs text-gray-500 animate-pulse">Analyzing network performance...</p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-300 leading-relaxed font-light italic">
                    "{aiAnalysis || "Click the button below to get an AI analysis of your trading performance and network potential."}"
                  </div>
                )}
                
                <button 
                  onClick={analyzeProfits} 
                  disabled={analyzing}
                  className="w-full bg-orange-600/10 text-orange-500 border border-orange-600/20 py-2 rounded-lg text-xs font-bold hover:bg-orange-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <BarChart3 size={14} /> Refresh AI Insights
                </button>
              </div>
              <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                <Zap size={100} className="text-orange-600" />
              </div>
            </motion.div>
          )}
          <button 
            onClick={() => setIsAiOpen(!isAiOpen)}
            className="w-14 h-14 bg-orange-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform group relative"
          >
            <MessageSquare size={24} />
            {!isAiOpen && (
              <div className="absolute right-full mr-4 bg-orange-600 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Akalamba AI Assistant
              </div>
            )}
          </button>
        </div>

        {/* Support System */}
        <div className="p-6 md:px-12 space-y-8">
          <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-green-500"><MessageSquare size={20} /> Customer Support Terminal</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl border border-white/5 h-[300px] overflow-y-auto p-4 flex flex-col gap-3">
                  {supportMessages.map((msg, i) => (
                    <div key={i} className={`max-w-[80%] p-3 rounded-xl text-xs ${msg.isAdmin ? 'bg-blue-600/20 text-blue-300 self-start border border-blue-600/20' : 'bg-orange-600/20 text-orange-300 self-end border border-orange-600/20'}`}>
                      <p className="font-bold mb-1">{msg.isAdmin ? 'Support Agent' : 'You'}</p>
                      <p>{msg.message}</p>
                      <p className="text-[8px] text-gray-500 mt-1 opacity-50">{msg.createdAt instanceof Date ? msg.createdAt.toLocaleString() : msg.createdAt?.toDate?.().toLocaleString() || 'Just now'}</p>
                    </div>
                  ))}
                  {supportMessages.length === 0 && <div className="text-gray-600 text-center mt-20 italic">No messages yet. Send your query below.</div>}
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    type="text" 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type your message to support..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500 text-sm"
                  />
                  <button 
                    disabled={sendingMessage || !newMessage.trim()}
                    className="bg-orange-600 p-3 rounded-xl hover:bg-orange-500 transition-all disabled:opacity-50"
                  >
                    {sendingMessage ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-orange-600/5 border border-orange-600/10 rounded-xl">
                  <h4 className="text-sm font-bold text-orange-500 mb-2">Notice</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">Our support agents are available Mon-Fri 8am-8pm. Response time is typically under 4 hours.</p>
                </div>
                <div className="p-4 bg-blue-600/5 border border-blue-600/10 rounded-xl">
                  <h4 className="text-sm font-bold text-blue-400 mb-2">Account Assistance</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">For MT5 login issues, please include your MT5 ID in the message for faster resolution.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Support Link Footer Removed redundant link */}
        <div className="p-6 md:px-12 text-center text-gray-600 text-xs mt-12 bg-white/5 py-12">
          <p>© 2026 Akalamba Asset Management. High-frequency automated trading terminal.</p>
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0A0A0A] border-t border-white/5 flex items-center justify-around z-50 px-2">
        <button onClick={() => setActiveTab('overview')} className={`p-2 rounded-lg ${activeTab === 'overview' ? 'text-orange-500' : 'text-gray-500'}`}><LayoutGrid size={24} /></button>
        <button onClick={() => setActiveTab('mt5')} className={`p-2 rounded-lg ${activeTab === 'mt5' ? 'text-orange-500' : 'text-gray-500'}`}><BarChart3 size={24} /></button>
        <button onClick={() => setActiveTab('network')} className={`p-2 rounded-lg ${activeTab === 'network' ? 'text-orange-500' : 'text-gray-500'}`}><Users size={24} /></button>
        <button onClick={() => setActiveTab('history')} className={`p-2 rounded-lg ${activeTab === 'history' ? 'text-orange-500' : 'text-gray-500'}`}><History size={24} /></button>
        <button onClick={onLogout} className="p-2 rounded-lg text-red-500"><LogOut size={24} /></button>
      </div>
    </div>
  );
}
