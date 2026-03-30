import React, { useState, useEffect } from 'react';
import { UserProfile, Fanz, FanzTemplate } from '../types';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { 
  LogOut, 
  User as UserIcon,
  Clock,
  Menu,
  X,
  ArrowLeft,
  Home as HomeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfileModal } from './UserProfileModal';
import { getImageUrl, cn } from '../lib/utils';
import { FERVEUR_LEVELS, LOGOS } from '../constants';

interface HeaderProps {
  profile: UserProfile;
  onHomeClick?: () => void;
  onMenuClick?: () => void;
  onTransactionsClick?: () => void;
  onBackClick?: () => void;
  absolute?: boolean;
  variant?: 'home' | 'subpage';
}

export function Header({ profile, onHomeClick, onMenuClick, onTransactionsClick, onBackClick, absolute = false, variant = 'home' }: HeaderProps) {
  const [timeUntilRefill, setTimeUntilRefill] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.photoURL || null);

  useEffect(() => {
    if (!profile.uid) return;

    const q = query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const activeFanzDoc = snapshot.docs.find(d => d.id === profile.activeAction?.fanzId) || snapshot.docs[0];
        const fanzData = activeFanzDoc.data() as Fanz;
        
        let imageUrl = fanzData.imageUrl;

        if (fanzData.templateId) {
          try {
            const templateDoc = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
            if (templateDoc.exists()) {
              const templateData = templateDoc.data() as FanzTemplate;
              const equippedSkinData = templateData.skins?.find(s => s.id === fanzData.equippedSkin);
              imageUrl = equippedSkinData?.imageUrl || fanzData.imageUrl || templateData.image;
            }
          } catch (error) {
            console.error("Error fetching template for avatar", error);
          }
        }
        
        setAvatarUrl(profile.photoURL || imageUrl || null);
      } else {
        setAvatarUrl(profile.photoURL || null);
      }
    });

    return () => unsubscribe();
  }, [profile.uid, profile.activeAction?.fanzId, profile.photoURL]);

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

  const currentFerveur = profile.ferveurPoints || 0;
  let nextLevelPoints = FERVEUR_LEVELS[0];
  let currentLevelPoints = 0;
  
  for (let i = 0; i < FERVEUR_LEVELS.length; i++) {
    if (currentFerveur < FERVEUR_LEVELS[i]) {
      nextLevelPoints = FERVEUR_LEVELS[i];
      currentLevelPoints = FERVEUR_LEVELS[i - 1] || 0;
      break;
    }
  }
  
  const ferveurProgressPercent = Math.min(100, Math.max(0, ((currentFerveur - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)) * 100));

  return (
    <>
      <header className={cn(
        "left-0 right-0 z-50 p-4 flex items-start justify-between",
        absolute ? "absolute top-0 bg-gradient-to-b from-black/80 to-transparent" : "sticky top-0 bg-gray-900/80 backdrop-blur-xl border-b border-white/10"
      )}>
        {/* Left: Avatar & Level OR Back Button */}
        {variant === 'subpage' ? (
          <button 
            onClick={() => onBackClick?.()} 
            className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onHomeClick ? onHomeClick() : setShowProfileModal(true)}>
            <div className="relative">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center border-2 border-orange-500 overflow-hidden">
                {avatarUrl ? (
                  <img src={getImageUrl(avatarUrl)} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-black border border-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-black text-orange-500 italic flex items-center gap-1">
                <img src={LOGOS.level} alt="Level" className="w-3 h-3 object-contain" />
                {profile.level}
              </div>
            </div>
          </div>
        )}

        {/* Center: Attributes & Ferveur Progress */}
        <div className="flex flex-col items-center">
          <div 
            className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 relative z-10 cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => onTransactionsClick && onTransactionsClick()}
          >
            <div className="flex items-center gap-1">
              <img src={LOGOS.money} alt="Money" className="w-3.5 h-3.5 object-contain" />
              <span className="text-[10px] font-bold">{profile.money}</span>
            </div>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1">
              <img src={LOGOS.gems} alt="Gems" className="w-3.5 h-3.5 object-contain" />
              <span className="text-[10px] font-bold">{profile.gems}</span>
            </div>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1">
              <img src={LOGOS.boost} alt="Boost" className="w-3.5 h-3.5 object-contain" />
              <span className="text-[10px] font-bold">{profile.boostPoints}</span>
            </div>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1 group relative">
              <img src={LOGOS.energy} alt="Energy" className="w-3.5 h-3.5 object-contain" />
              <span className="text-[10px] font-bold">{profile.energy}</span>
              {timeUntilRefill && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1 text-[8px] font-mono text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-0.5 rounded-full border border-orange-500/30">
                  <Clock className="w-2 h-2" />
                  {timeUntilRefill}
                </div>
              )}
            </div>
          </div>
          
          {/* Ferveur Progress Bar */}
          <div 
            className="mt-1 w-32 h-4 bg-black/60 rounded-full border border-white/10 overflow-hidden relative cursor-pointer hover:border-white/30 transition-colors"
            onClick={() => onTransactionsClick && onTransactionsClick()}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${ferveurProgressPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[8px] font-black text-white uppercase tracking-tighter">
                {currentFerveur} / {nextLevelPoints}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Menu Button OR Home Button */}
        {variant === 'subpage' ? (
          <button 
            onClick={() => onHomeClick?.()} 
            className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
          >
            <HomeIcon className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={() => onMenuClick?.()} 
            className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
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
