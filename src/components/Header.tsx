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
  Home as HomeIcon,
  Zap,
  Flame,
  Shield,
  Star,
  TrendingUp
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
  unreadSocialCount?: number;
  hasClaimableFervorAlert?: boolean;
}

export function Header({ 
  profile, 
  onHomeClick, 
  onMenuClick, 
  onTransactionsClick, 
  onFervorClick, 
  onBackClick, 
  absolute = false, 
  variant = 'home',
  unreadSocialCount = 0,
  hasClaimableFervorAlert
}: HeaderProps) {
  const [timeUntilRefill, setTimeUntilRefill] = useState<string>('');
  const [countdownInfiniteEnergy, setCountdownInfiniteEnergy] = useState<string>('');
  const [countdownXpBoost, setCountdownXpBoost] = useState<string>('');
  const [countdownDoubleGains, setCountdownDoubleGains] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.photoURL || null);
  const [maxFerveur, setMaxFerveur] = useState(100000);

  useEffect(() => {
    if (profile.photoURL) {
      setAvatarUrl(profile.photoURL);
    }
  }, [profile.photoURL]);

  useEffect(() => {
    if (!profile.uid) return;
    const fetchMaxFerveur = async () => {
      try {
        const fanzSnapshot = await getDocs(collection(db, 'fanz_templates'));
        let calculatedMax = 0;
        fanzSnapshot.docs.forEach(doc => {
          const data = doc.data() as FanzTemplate;
          if (data.isActive !== false) {
            const fMax = data.ferveurConfig?.ranges?.[data.ferveurConfig.ranges.length - 1]?.max || 150000;
            calculatedMax += fMax;
          }
        });
        
        if (calculatedMax > 0) {
          setMaxFerveur(calculatedMax);
        } else {
          setMaxFerveur(150000); // default
        }
      } catch (err: any) {
        if (err?.code !== 'permission-denied' && !err?.message?.includes('Missing or insufficient permissions')) {
          console.error("Error fetching max ferveur", err);
        }
      }
    };
    fetchMaxFerveur();
  }, [profile.uid]);

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
        const activeFanzDoc = sortedDocs.find(d => d.id === (profile.activeFanzId || profile.activeAction?.fanzId)) || sortedDocs[0];
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
          } catch (error: any) {
            if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
              console.error("Error fetching template for avatar", error);
            }
          }
        }
        
        const finalImageUrl = getImageUrl(imageUrl);
        const resolvedUrl = finalImageUrl ? imageUrl : (profile.photoURL || null);
        setAvatarUrl(resolvedUrl);

        if (resolvedUrl && profile.photoURL !== resolvedUrl) {
          try {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'users', profile.uid), { photoURL: resolvedUrl });
          } catch(e) {
             console.error('Failed to sync photoURL', e);
          }
        }
      } else {
        setAvatarUrl(profile.photoURL || null);
      }
    }, (error) => {
      console.error("Error in Header fanz listener:", error);
    });

    return () => unsubscribe();
  }, [profile.uid, profile.activeFanzId, profile.activeAction?.fanzId, profile.photoURL]);

  useEffect(() => {
    const maxEner = (profile.maxEnergy || 100) + (profile.skinEnergyBonus || 0);
    if (profile.energy >= maxEner) {
      setTimeUntilRefill('');
      return;
    }

    const calculateTime = () => {
      const lastRefill = new Date(profile.lastEnergyRefill || new Date().toISOString());
      // Show time until NEXT 1 hour refill (+5 energy)
      const nextRefill = new Date(lastRefill.getTime() + 1 * 60 * 60 * 1000);
      const now = new Date();
      let diff = nextRefill.getTime() - now.getTime();

      // If already passed, but App.tsx hasn't synced yet, show very low time or calculate next hourly window
      if (diff <= 0) {
        // If we missed multiple hours, show time until the next upcoming hourly slot
        const msSinceLast = now.getTime() - lastRefill.getTime();
        const msNext = 3600000 - (msSinceLast % 3600000);
        diff = msNext;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilRefill(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
      
      const getTimeLeftString = (until: string | undefined): string => {
        if (!until) return '';
        const endDate = new Date(until);
        const timeDiff = endDate.getTime() - new Date().getTime();
        if (timeDiff <= 0) return '';
        
        const h = Math.floor(timeDiff / (1000 * 60 * 60));
        const m = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((timeDiff % (1000 * 60)) / 1000);
        return `${h > 0 ? h + 'h ' : ''}${m.toString().padStart(h > 0 ? 2 : 1, '0')}:${s.toString().padStart(2, '0')}`;
      };

      setCountdownInfiniteEnergy(getTimeLeftString(profile.infiniteEnergyUntil));
      setCountdownXpBoost(getTimeLeftString(profile.boostXpUntil));
      setCountdownDoubleGains(getTimeLeftString(profile.doubleGainsUntil));
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [profile.lastEnergyRefill, profile.energy]);

  const isXpBoostActive = profile.boostXpUntil && new Date(profile.boostXpUntil) > new Date();
  const isInfiniteEnergyActive = profile.infiniteEnergyUntil && new Date(profile.infiniteEnergyUntil) > new Date();
  const isAntiMalusActive = (profile.antiMalusMatches || 0) > 0;
  const isDoubleGainsActive = profile.doubleGainsUntil && new Date(profile.doubleGainsUntil) > new Date();

  const currentFerveur = profile.ferveurPoints || 0;
  const ferveurProgressPercent = Math.min(100, Math.max(0, (currentFerveur / maxFerveur) * 100));

  return (
    <>
      <header className={cn(
        "left-0 right-0 z-50 shrink-0",
        variant === 'home' || absolute 
          ? "absolute top-0 bg-gradient-to-b from-black/80 to-transparent" 
          : "relative bg-[#0a0a0a]/95 backdrop-blur-xl"
      )}>
        <div className="w-full max-w-3xl mx-auto flex items-start justify-between px-4 md:px-6 py-4">
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
                    <img src={getImageUrl(avatarUrl)} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-black border border-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-black text-orange-500 italic flex items-center gap-1">
                  <img src={LOGOS.level} alt="Level" className="w-3 h-3 object-contain" referrerPolicy="no-referrer" />
                  {profile.level}
                  {isAntiMalusActive && (
                    <div className="ml-1 flex items-center gap-0.5 text-blue-400">
                      <Shield className="w-2.5 h-2.5 fill-blue-400/20" />
                      <span className="text-[8px]">{profile.antiMalusMatches}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Center: Attributes & Ferveur Progress */}
          <div className="flex flex-col items-center relative">
            {isDoubleGainsActive && (
              <div className="absolute -top-6 bg-red-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse flex items-center gap-1 z-20">
                <TrendingUp className="w-2.5 h-2.5" />
                Gains x2 ({countdownDoubleGains})
              </div>
            )}
            <div 
              className="flex items-center gap-2 sm:gap-3 bg-black/50 backdrop-blur-md rounded-full px-3 sm:px-4 py-1.5 sm:py-2 border border-white/10 relative z-10 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => onTransactionsClick && onTransactionsClick()}
            >
              <div className="flex items-center gap-1 sm:gap-1.5 group/money relative">
                <img src={LOGOS.money} alt="Money" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" referrerPolicy="no-referrer" />
                <span className="text-[10px] sm:text-xs font-bold">{profile.money}</span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 group-hover/money:opacity-100 transition-opacity bg-black/95 px-3 py-2 rounded-xl border border-white/10 pointer-events-none z-[100] whitespace-nowrap shadow-2xl flex flex-col items-center">
                  <div className="text-[10px] sm:text-xs font-black text-orange-500 uppercase tracking-widest">Monnaie</div>
                  <div className="text-[9px] text-gray-300">Achats en boutique et améliorations</div>
                </div>
              </div>
              <div className="w-px h-3 sm:h-4 bg-white/20" />
              <div className="flex items-center gap-1 sm:gap-1.5 group/gems relative">
                <img src={LOGOS.gems} alt="Gems" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" referrerPolicy="no-referrer" />
                <span className="text-[10px] sm:text-xs font-bold">{profile.gems}</span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 group-hover/gems:opacity-100 transition-opacity bg-black/95 px-3 py-2 rounded-xl border border-white/10 pointer-events-none z-[100] whitespace-nowrap shadow-2xl flex flex-col items-center">
                  <div className="text-[10px] sm:text-xs font-black text-blue-400 uppercase tracking-widest">Gemmes</div>
                  <div className="text-[9px] text-gray-300">Monnaie rare pour le contenu premium</div>
                </div>
              </div>
              <div className="w-px h-3 sm:h-4 bg-white/20" />
              <div className="flex items-center gap-1 sm:gap-1.5 group/boost relative">
                <img src={LOGOS.boost} alt="Boost" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" referrerPolicy="no-referrer" />
                <span className="text-[10px] sm:text-xs font-bold">{profile.boostPoints}</span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 group-hover/boost:opacity-100 transition-opacity bg-black/95 px-3 py-2 rounded-xl border border-white/10 pointer-events-none z-[100] whitespace-nowrap shadow-2xl flex flex-col items-center">
                  <div className="text-[10px] sm:text-xs font-black text-yellow-500 uppercase tracking-widest">Points de Boost</div>
                  <div className="text-[9px] text-gray-300">Avantages temporaires lors des duels</div>
                </div>
              </div>
              <div className="w-px h-3 sm:h-4 bg-white/20" />
              <div className="flex items-center gap-1 sm:gap-1.5 group/energy relative">
                <div className="relative">
                  <img src={LOGOS.energy} alt="Energy" className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain", isInfiniteEnergyActive && "animate-pulse")} referrerPolicy="no-referrer" />
                  {isInfiniteEnergyActive && (
                    <Zap className="absolute -top-1 -right-1 w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
                <span className={cn("text-[10px] sm:text-xs font-bold", isInfiniteEnergyActive && "text-yellow-400")}>
                  {isInfiniteEnergyActive ? '∞' : profile.energy}
                </span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 group-hover/energy:opacity-100 transition-opacity bg-black/95 px-3 py-2 rounded-xl border border-white/10 pointer-events-none z-[100] whitespace-nowrap shadow-2xl flex flex-col items-center">
                  <div className="text-[10px] sm:text-xs font-black text-green-400 uppercase tracking-widest">
                    {isInfiniteEnergyActive ? 'Énergie Infinie' : 'Énergie'}
                  </div>
                  {isInfiniteEnergyActive && (
                    <div className="flex flex-col items-center gap-1 text-[9px] font-mono text-yellow-400 mt-1 border-t border-white/10 pt-1 w-full justify-center">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        FIN DU BOOST DANS
                      </div>
                      <div className="text-white font-black">{countdownInfiniteEnergy}</div>
                    </div>
                  )}
                  <div className="text-[9px] text-gray-300 mt-1">Nécessaire pour affronter des adversaires</div>
                  {timeUntilRefill && !isInfiniteEnergyActive && (
                    <div className="flex flex-col items-center gap-1 text-[9px] font-mono text-orange-400 mt-1 border-t border-white/10 pt-1 w-full justify-center">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        +5 ÉNERGIE DANS
                      </div>
                      <div className="text-white font-black">{timeUntilRefill}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Ferveur Progress Bar */}
            <div className="relative group/ferveur mt-1 sm:mt-2">
              {hasClaimableFervorAlert && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10" />
              )}
              <div 
                className="w-32 sm:w-40 h-4 sm:h-5 bg-black/60 rounded-full border border-white/10 overflow-hidden relative cursor-pointer hover:border-white/30 transition-colors"
                onClick={() => onFervorClick && onFervorClick()}
              >
                <div 
                  className={cn("absolute top-0 left-0 h-full transition-all duration-500", isXpBoostActive ? "bg-yellow-500" : "bg-orange-500")}
                  style={{ width: `${ferveurProgressPercent}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-tighter flex items-center gap-1">
                    {currentFerveur} / {maxFerveur}
                    {isXpBoostActive && <Star className="w-2 h-2 text-yellow-300 fill-yellow-300 animate-pulse" />}
                  </span>
                </div>
              </div>
              
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover/ferveur:opacity-100 transition-opacity bg-black/95 px-3 py-2 rounded-xl border border-white/10 pointer-events-none z-[100] whitespace-nowrap shadow-2xl flex flex-col items-center">
                <div className="text-[10px] sm:text-xs font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                  Ferveur {isXpBoostActive && <span className="text-yellow-500">(XP x2 ACTIF)</span>}
                </div>
                {isXpBoostActive && (
                  <div className="flex flex-col items-center gap-1 text-[9px] font-mono text-yellow-400 mt-1 border-t border-white/10 pt-1 w-full justify-center">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      FIN DU BOOST DANS
                    </div>
                    <div className="text-white font-black">{countdownXpBoost}</div>
                  </div>
                )}
                <div className="text-[9px] text-gray-300 mt-1">Répandez votre ferveur pour progresser !</div>
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
                className="flex flex-col items-center justify-center w-14 h-14 bg-black/60 backdrop-blur-md rounded-full border-2 border-white/20 hover:bg-white/20 transition-all active:scale-95 shadow-lg relative"
              >
                <Menu className="w-6 h-6 text-white" />
                <span className="text-[9px] font-black italic uppercase tracking-tighter mt-0.5 text-orange-500 leading-none">Menu</span>
                
                {unreadSocialCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-red-600 rounded-full text-[10px] font-bold text-white shadow-lg border-2 border-[#1a1a1a] animate-pulse">
                    {unreadSocialCount > 9 ? '9+' : unreadSocialCount}
                  </span>
                )}
              </button>
            )}
          </div>
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
