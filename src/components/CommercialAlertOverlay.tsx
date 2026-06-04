import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, X, Sparkles, ShoppingBag, Eye } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { OptimizedMedia } from './OptimizedMedia';

interface CommercialAlert {
  id: string;
  type: 'fanz' | 'skin' | 'emote' | 'general';
  title: string;
  message: string;
  itemId?: string;
  fanzId?: string;
  imageUrl?: string;
  createdAt: string;
  isActive: boolean;
}

interface CommercialAlertOverlayProps {
  setView: (view: any) => void;
}

export function CommercialAlertOverlay({ setView }: CommercialAlertOverlayProps) {
  const [activeAlert, setActiveAlert] = useState<CommercialAlert | null>(null);
  const [itemDetails, setItemDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    // Listen for active commercial alerts
    const q = query(
      collection(db, 'commercial_alerts'),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CommercialAlert));
      
      // Sort in memory by date descending to get the newest first
      alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Get list of dismissed alerts from localStorage
      let seenAlerts: string[] = [];
      try {
        const stored = localStorage.getItem('seen_commercial_alerts');
        if (stored) {
          seenAlerts = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Error reading localStorage seen_commercial_alerts", e);
      }

      // Find the first alert we haven't seen yet
      const unseen = alerts.find(a => !seenAlerts.includes(a.id));
      if (unseen) {
        setActiveAlert(unseen);
      } else {
        setActiveAlert(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch target item details (Fanz template, skin, or emote) if applicable for enhanced visuals!
  useEffect(() => {
    if (!activeAlert) {
      setItemDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setLoadingDetails(true);
      try {
        // If type is FANZ, fetch FanzTemplate
        if (activeAlert.type === 'fanz' && activeAlert.itemId) {
          const docSnap = await getDoc(doc(db, 'fanz_templates', activeAlert.itemId));
          if (docSnap.exists()) {
            setItemDetails(docSnap.data());
          }
        } 
        // If type is SKIN or EMOTE, fetch FanzTemplate to extract inner item details
        else if ((activeAlert.type === 'skin' || activeAlert.type === 'emote') && activeAlert.fanzId) {
          const docSnap = await getDoc(doc(db, 'fanz_templates', activeAlert.fanzId));
          if (docSnap.exists()) {
            const fanzData = docSnap.data();
            if (activeAlert.type === 'skin') {
              const skinObj = (fanzData.skins || []).find((s: any) => s.id === activeAlert.itemId);
              if (skinObj) {
                setItemDetails({ ...skinObj, fanzName: fanzData.name });
              }
            } else {
              const emoteObj = (fanzData.emotes || []).find((e: any) => e.id === activeAlert.itemId);
              if (emoteObj) {
                setItemDetails({ ...emoteObj, fanzName: fanzData.name });
              }
            }
          }
        }
      } catch (e) {
        console.error("Error fetching item details for alert", e);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [activeAlert]);

  const handleDismiss = () => {
    if (!activeAlert) return;

    try {
      const stored = localStorage.getItem('seen_commercial_alerts');
      const seenAlerts = stored ? JSON.parse(stored) : [];
      if (!seenAlerts.includes(activeAlert.id)) {
        seenAlerts.push(activeAlert.id);
        localStorage.setItem('seen_commercial_alerts', JSON.stringify(seenAlerts));
      }
    } catch (e) {
      console.error("Error writing dismissed alerts", e);
    }
    setActiveAlert(null);
  };

  const handleCta = () => {
    if (!activeAlert) return;
    
    // Dismiss the alert first
    handleDismiss();

    // Navigate to respective views
    if (activeAlert.type === 'fanz') {
      setView('fanz');
    } else if (activeAlert.type === 'skin' || activeAlert.type === 'emote') {
      setView('shop');
    } else {
      setView('home');
    }
  };

  if (!activeAlert) return null;

  // Visual Assets fallback
  const fallbackImage = activeAlert.imageUrl || 'https://thebestfan.online/img/public/logo/chest.png';

  const getTypeLabel = () => {
    switch (activeAlert.type) {
      case 'fanz': return 'Nouveau FANZ !';
      case 'skin': return 'Nouveau SKIN !';
      case 'emote': return 'Nouvel EMOTE !';
      default: return 'Annonce Spéciale !';
    }
  };

  return (
    <AnimatePresence>
      <div id="commercial-alert-wrapper" className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-[#1c1917] to-[#0c0a09] border border-orange-500/30 text-white shadow-2xl p-6 flex flex-col space-y-6"
        >
          {/* Header Glow/Deco */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-500/20 rounded-full blur-[60px] pointer-events-none" />

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white/75 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Type tag */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-black text-[10px] font-black uppercase tracking-wider rounded-full shadow-md">
              <Megaphone size={12} className="animate-bounce" />
              {getTypeLabel()}
            </span>
          </div>

          {/* Media Presentation */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/5 bg-black/40 flex items-center justify-center">
            {itemDetails?.videoUrl ? (
              <OptimizedMedia
                type="video"
                src={itemDetails.videoUrl}
                poster={itemDetails.imageUrl || itemDetails.image || fallbackImage}
                className="w-full h-full object-contain"
              />
            ) : itemDetails?.victoryVideoUrl ? (
              <OptimizedMedia
                type="video"
                src={itemDetails.victoryVideoUrl}
                poster={itemDetails.imageUrl || itemDetails.image || fallbackImage}
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={getImageUrl(itemDetails?.imageUrl || itemDetails?.image || fallbackImage)}
                alt={itemDetails?.name || activeAlert.title}
                className="w-full h-full object-contain p-4 max-h-[160px] filter drop-shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-transform duration-500 hover:scale-105"
                referrerPolicy="no-referrer"
              />
            )}

            <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-bold border border-white/10 text-orange-400">
              <Sparkles size={10} />
              Nouveauté
            </div>
          </div>

          {/* Text Info */}
          <div className="space-y-2 text-center">
            <h3 className="text-2xl font-black italic uppercase tracking-tight bg-gradient-to-r from-white via-orange-100 to-orange-400 bg-clip-text text-transparent">
              {activeAlert.title}
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed px-2">
              {activeAlert.message}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleCta}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-black italic uppercase tracking-wider rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <ShoppingBag size={18} />
              Découvrir Maintenant
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider rounded-2xl transition-colors cursor-pointer"
            >
              Fermer l'Annonce
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
