import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  Coins, 
  Gem, 
  Zap, 
  TrendingUp, 
  LogOut, 
  User as UserIcon,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfileModal } from './UserProfileModal';
import { getImageUrl } from '../lib/utils';

interface HeaderProps {
  profile: UserProfile;
}

export function Header({ profile }: HeaderProps) {
  const [timeUntilRefill, setTimeUntilRefill] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (profile.energy >= 100) {
      setTimeUntilRefill('');
      return;
    }

    const calculateTime = () => {
      const lastRefill = new Date(profile.lastEnergyRefill || new Date().toISOString());
      const nextRefill = new Date(lastRefill.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();
      const diff = nextRefill.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilRefill('00:00:00');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilRefill(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [profile.lastEnergyRefill, profile.energy]);

  const handleLogout = () => {
    signOut(auth);
  };

  // Calculate progress percentage (assuming 100,000 XP per level for now as seen in Dashboard)
  const progress = (profile.ferveurPoints / 100000) * 100;

  return (
    <>
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50 px-4 py-2 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* User Info & Level */}
          <div className="flex items-center gap-4 min-w-[200px] cursor-pointer group" onClick={() => setShowProfileModal(true)}>
            <div className="relative">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-lg shadow-orange-600/20 overflow-hidden group-hover:border-white transition-colors">
                {profile.photoURL ? (
                  <img src={getImageUrl(profile.photoURL)} alt={profile.pseudo} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-black border border-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-black text-orange-500 italic">
                L{profile.level}
              </div>
            </div>
            
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-black italic uppercase tracking-tight text-white truncate max-w-[100px] group-hover:text-orange-500 transition-colors">
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
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-default group relative">
              <div className="group-hover:scale-110 transition-transform">
                <Zap className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-tight">{profile.energy}/100</span>
                <span className="text-[8px] uppercase font-bold text-gray-500 leading-none">Énergie</span>
              </div>
              {timeUntilRefill && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1 text-[10px] font-mono text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-0.5 rounded-full border border-orange-500/30">
                  <Clock className="w-3 h-3" />
                  {timeUntilRefill}
                </div>
              )}
            </div>
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

      {showProfileModal && (
        <UserProfileModal 
          profile={profile} 
          onClose={() => setShowProfileModal(false)} 
        />
      )}
    </>
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
