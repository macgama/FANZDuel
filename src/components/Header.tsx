import React, { useState, useEffect } from 'react';
import { UserProfile, Fanz, FanzTemplate, GlobalFervorConfig } from '../types';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs } from 'firebase/firestore';
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
import { LOGOS } from '../constants';
import { generateFervorPath } from '../utils/fervorPath';

interface HeaderProps {
  profile: UserProfile;
  onHomeClick?: () => void;
  onMenuClick?: () => void;
  onTransactionsClick?: () => void;
  onFervorClick?: () => void;
  onBackClick?: () => void;
  absolute?: boolean;
  variant?: 'home' | 'subpage';
}

export function Header({ profile, onHomeClick, onMenuClick, onTransactionsClick, onFervorClick, onBackClick, absolute = false, variant = 'home' }: HeaderProps) {
  const [timeUntilRefill, setTimeUntilRefill] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.photoURL || null);
  const [maxFerveur, setMaxFerveur] = useState(100000);

  useEffect(() => {
    const fetchMaxFerveur = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'global_configs', 'user_fervor'));
        if (configDoc.exists()) {
          const config = configDoc.data() as GlobalFervorConfig;
          if (config.ranges && config.ranges.length > 0) {
            setMaxFerveur(config.ranges[config.ranges.length - 1].max);
            return;
          }
        }
        
        // Fallback
        const fanzSnapshot = await getDocs(collection(db, 'fanz_templates'));
        const activeCount = fanzSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isActive !== false;
        }).length;
        if (activeCount > 0) {
          setMaxFerveur(activeCount * 1000);
        }
      } catch (err) {
        console.error("Error fetching max ferveur", err);
      }
    };
    fetchMaxFerveur();
  }, []);

  useEffect(() => {
    if (!profile.uid) return;

    const q = query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const sortedDocs = [...snapshot.docs].sort((a, b) => {
          const dataA = a.data() as Fanz;
          const dataB = b.data() as Fanz;
          // Prefer Fanz with equipped skin
          if (dataA.equippedSkin && !dataB.equippedSkin) return -1;
          if (!dataA.equippedSkin && dataB.equippedSkin) return 1;
          // Then by level, xp, id
          if ((dataB.level || 0) !== (dataA.level || 0)) return (dataB.level || 0) - (dataA.level || 0);
          if ((dataB.xp || 0) !== (dataA.xp || 0)) return (dataB.xp || 0) - (dataA.xp || 0);
          return a.id.localeCompare(b.id);
        });
        const activeFanzDoc = sortedDocs.find(d => d.id === profile.activeAction?.fanzId) || sortedDocs[0];
        const fanzData = activeFanzDoc.data() as Fanz;
        
        let imageUrl = fanzData.imageUrl;

        if (fanzData.templateId) {
          try {
            const templateDoc = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
            if (templateDoc.exists()) {
              const templateData = templateDoc.data() as FanzTemplate;
              const equippedSkinData = templateData.skins?.find(s => s.id === fanzData.equippedSkin);
              
              let currentImageUrl = templateData.image;
              if (fanzData.imageUrl) currentImageUrl = fanzData.imageUrl;
              if (equippedSkinData) {
                currentImageUrl = equippedSkinData.imageUrl || currentImageUrl;
              }
              imageUrl = currentImageUrl;
            }
          } catch (error) {
            console.error("Error fetching template for avatar", error);
          }
        }
        
        const finalImageUrl = getImageUrl(imageUrl);
        setAvatarUrl(finalImageUrl ? imageUrl : (profile.photoURL || null));
      } else {
        setAvatarUrl(profile.photoURL || null);
      }
    }, (error) => {
      console.error("Error in Header fanz listener:", error);
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
  const ferveurProgressPercent = Math.min(100, Math.max(0, (currentFerveur / maxFerveur) * 100));

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
            className="flex items-center gap-2 sm:gap-3 bg-black/50 backdrop-blur-md rounded-full px-3 sm:px-4 py-1.5 sm:py-2 border border-white/10 relative z-10 cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => onTransactionsClick && onTransactionsClick()}
          >
            <div className="flex items-center gap-1 sm:gap-1.5">
              <img src={LOGOS.money} alt="Money" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
              <span className="text-[10px] sm:text-xs font-bold">{profile.money}</span>
            </div>
            <div className="w-px h-3 sm:h-4 bg-white/20" />
            <div className="flex items-center gap-1 sm:gap-1.5">
              <img src={LOGOS.gems} alt="Gems" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
              <span className="text-[10px] sm:text-xs font-bold">{profile.gems}</span>
            </div>
            <div className="w-px h-3 sm:h-4 bg-white/20" />
            <div className="flex items-center gap-1 sm:gap-1.5">
              <img src={LOGOS.boost} alt="Boost" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
              <span className="text-[10px] sm:text-xs font-bold">{profile.boostPoints}</span>
            </div>
            <div className="w-px h-3 sm:h-4 bg-white/20" />
            <div className="flex items-center gap-1 sm:gap-1.5 group relative">
              <img src={LOGOS.energy} alt="Energy" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
              <span className="text-[10px] sm:text-xs font-bold">{profile.energy}</span>
              {timeUntilRefill && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1 text-[8px] sm:text-[10px] font-mono text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-0.5 rounded-full border border-orange-500/30">
                  <Clock className="w-2 h-2 sm:w-3 sm:h-3" />
                  {timeUntilRefill}
                </div>
              )}
            </div>
          </div>
          
          {/* Ferveur Progress Bar */}
          <div 
            className="mt-1 sm:mt-2 w-32 sm:w-40 h-4 sm:h-5 bg-black/60 rounded-full border border-white/10 overflow-hidden relative cursor-pointer hover:border-white/30 transition-colors"
            onClick={() => onFervorClick && onFervorClick()}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${ferveurProgressPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-tighter">
                {currentFerveur} / {maxFerveur}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Menu Button OR Home Button */}
        <div className="shrink-0 ml-2">
          {variant === 'subpage' ? (
            <button 
              onClick={() => onHomeClick?.()} 
              className="w-11 h-11 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
            >
              <HomeIcon className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick?.();
              }} 
              className="flex flex-col items-center justify-center w-14 h-14 bg-black/60 backdrop-blur-md rounded-full border-2 border-white/20 hover:bg-white/20 transition-all active:scale-95 shadow-lg"
            >
              <Menu className="w-6 h-6 text-white" />
              <span className="text-[9px] font-black italic uppercase tracking-tighter mt-0.5 text-orange-500 leading-none">Menu</span>
            </button>
          )}
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
