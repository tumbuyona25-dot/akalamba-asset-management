import { motion } from 'motion/react';
import { ChevronRight, Shield, TrendingUp, Users, Zap, Info } from 'lucide-react';

interface LandingProps {
  onLogin: () => void;
  onRegister: () => void;
}

export default function Landing({ onLogin, onRegister }: LandingProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 md:px-12 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center font-bold text-xl">A</div>
          <span className="font-sans font-bold tracking-tight text-xl hidden sm:inline">AKALAMBA <span className="font-light text-orange-500">ASSET</span></span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onLogin} className="text-sm font-medium hover:text-orange-500 transition-colors">Sign In</button>
          <button 
            onClick={onRegister}
            className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-orange-500 hover:text-white transition-all transform hover:scale-105"
          >
            Join Now
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative h-[80vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="z-10 max-w-4xl"
          >
            <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-orange-500 font-bold mb-6">
              Next-Gen Asset Management
            </span>
            <h1 className="text-5xl md:text-8xl font-sans font-bold leading-tight mb-6 tracking-tighter">
              Multiply Wealth <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-300">by Compounding.</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              Premium networking platform integrated with professional MT5 copy trading. Automated commissions, leadership rewards, and real-time insights.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={onRegister}
                className="w-full sm:w-auto px-8 py-4 bg-orange-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/25"
              >
                Start Trading <ChevronRight size={20} />
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Shield size={16} className="text-green-500" /> Secure MT5 Integration
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section className="px-6 py-24 md:px-12 bg-white/5 border-y border-white/5">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-orange-600/20 border border-orange-600/50 rounded-lg flex items-center justify-center text-orange-500">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-xl font-bold">Copy Trading Profits</h3>
              <p className="text-gray-400 leading-relaxed font-light">Connect your MT5 account and let professional traders grow your assets while you monitor in real-time.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-blue-600/20 border border-blue-600/50 rounded-lg flex items-center justify-center text-blue-400">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-bold">3-Tier Commissions</h3>
              <p className="text-gray-400 leading-relaxed font-light">Earn automatically from your network's success. 5% L1, 3% L2, and 2% L3 on generated profits.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-purple-600/20 border border-purple-600/50 rounded-lg flex items-center justify-center text-purple-400">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold">Leadership Rewards</h3>
              <p className="text-gray-400 leading-relaxed font-light">Ascend the ranks from Bronze to Platinum. Unlock monthly salaries and team performance bonuses.</p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-6 py-24 md:px-12 bg-black border-t border-white/5">
          <div className="max-w-3xl mx-auto space-y-12">
            <h2 className="text-4xl font-bold text-center mb-16 tracking-tight">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                { q: "How do I get started?", a: "Register using a referral link, connect your MT5 account via the dashboard, and join our recommended broker." },
                { q: "What is the minimum withdrawal?", a: "Withdrawals are processed via USDT BEP20 with a minimum of $50." },
                { q: "How are commissions calculated?", a: "Commissions are distributed across 3 levels: 5% for L1, 3% for L2, and 2% for L3 based on net trading profits." },
                { q: "Is my capital safe?", a: "Trading happens entirely outside our platform via MT5. We only monitor performance to calculate network rewards." }
              ].map((faq, i) => (
                <div key={i} className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <h4 className="font-bold flex items-center gap-3 mb-4 text-orange-500">
                    <Info size={18} /> {faq.q}
                  </h4>
                  <p className="text-gray-400 text-sm font-light leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="p-12 border-t border-white/10 text-gray-500 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>© {new Date().getFullYear()} Akalamba Asset Management. All rights reserved.</div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">MT5 Guide</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
