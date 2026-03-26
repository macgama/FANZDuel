import React from 'react';
import { UserProfile } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  Coins, 
  Gem, 
  Zap, 
  TrendingUp, 
  LogOut, 
  User as UserIcon 
} from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  profile: UserProfile;
}

export function Header({ profile }: HeaderProps) {
  const handleLogout = () => {
    signOut(auth);
  };

  // Calculate progress percentage (assuming 100,000 XP per level for now as seen in Dashboard)
  const progress = (profile.ferveurPoints / 100000) * 100;

  return (
    <header className="bg-gray-900/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50 px-4 py-2 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* User Info & Level */}
        <div className="flex items-center gap-4 min-w-[200px]">
          <div className="relative">
            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-lg shadow-orange-600/20">
              <UserIcon className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-black border border-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-black text-orange-500 italic">
              L{profile.level}
            </div>
          </div>
          
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black italic uppercase tracking-tight text-white truncate max-w-[100px]">
                {profile.pseudo}
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {Math.floor(progress)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-orange-600 to-orange-400"
              />
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="flex items-center gap-3 md:gap-6 overflow-x-auto no-scrollbar py-1">
          <ResourceItem 
            icon={<Coins className="w-4 h-4 text-yellow-500" />} 
            value={profile.money.toLocaleString()} 
            label="Argent"
          />
          <ResourceItem 
            icon={<Gem className="w-4 h-4 text-purple-500" />} 
            value={profile.gems.toLocaleString()} 
            label="Gemmes"
          />
          <ResourceItem 
            icon={<TrendingUp className="w-4 h-4 text-blue-500" />} 
            value={profile.boostPoints.toLocaleString()} 
            label="Boost"
          />
          <ResourceItem 
            icon={<Zap className="w-4 h-4 text-orange-500" />} 
            value={`${profile.energy}/100`} 
            label="Énergie"
          />
        </div>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group border border-transparent hover:border-red-500/20"
          title="Déconnexion"
        >
          <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
        </button>

      </div>
    </header>
  );
}

function ResourceItem({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-default group">
      <div className="group-hover:scale-110 transition-transform">{icon}</div>
      <div className="flex flex-col">
        <span className="text-xs font-black tracking-tight">{value}</span>
        <span className="text-[8px] uppercase font-bold text-gray-500 leading-none">{label}</span>
      </div>
    </div>
  );
}
