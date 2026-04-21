import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { getImageUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, Loader2 } from 'lucide-react';

interface PreloaderProps {
  onComplete: () => void;
  uid: string;
}

export function Preloader({ onComplete, uid }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Chargement des données...');

  useEffect(() => {
    let isMounted = true;
    
    const preloadAssets = async () => {
      try {
        const urlsToPreload = new Set<string>();
        
        // 1. Fetch Cards
        setStatusText('Mise en cache des cartes DUEL...');
        const cardsSnap = await getDocs(collection(db, 'cards'));
        cardsSnap.forEach(doc => {
          const data = doc.data();
          if (data.imageUrl) urlsToPreload.add(getImageUrl(data.imageUrl, 400));
        });
        
        // 2. Fetch Life Actions
        setStatusText('Mise en cache des actions LIFE...');
        const lifeActionsSnap = await getDocs(collection(db, 'life_actions'));
        lifeActionsSnap.forEach(doc => {
          const data = doc.data();
          if (data.imageUrl) urlsToPreload.add(getImageUrl(data.imageUrl, 400));
        });

        // 3. User's Fanz
        setStatusText('Synchronisation de vos FANZ...');
        const qFanz = query(collection(db, 'fanz'), where('ownerUid', '==', uid));
        const fanzSnap = await getDocs(qFanz);
        fanzSnap.forEach(doc => {
          const data = doc.data();
          if (data.imageUrl) urlsToPreload.add(getImageUrl(data.imageUrl, 400));
        });

        const urls = Array.from(urlsToPreload);
        
        if (urls.length === 0) {
          if (isMounted) onComplete();
          return;
        }

        setStatusText('Optimisation des médias...');
        let loadedCount = 0;
        
        const loadImage = (url: string) => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              if (isMounted) {
                loadedCount++;
                setProgress(Math.round((loadedCount / urls.length) * 100));
              }
              resolve(true);
            };
            img.onerror = () => {
              if (isMounted) {
                loadedCount++;
                setProgress(Math.round((loadedCount / urls.length) * 100));
              }
              resolve(false);
            };
            // 6-second timeout for individual images to prevent hanging
            setTimeout(() => resolve(false), 6000);
            img.src = url;
          });
        };

        const BATCH_SIZE = 5;
        for (let i = 0; i < urls.length; i += BATCH_SIZE) {
          if (!isMounted) break;
          const batch = urls.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(loadImage));
        }
        
        if (isMounted) {
          setProgress(100);
          setStatusText("Prêt à jouer !");
          setTimeout(() => {
             if (isMounted) onComplete();
          }, 300);
        }
        
      } catch (e) {
        console.error("Preloader error:", e);
        if (isMounted) onComplete();
      }
    };

    preloadAssets();
    
    return () => { isMounted = false; };
  }, [onComplete, uid]);

  return (
    <motion.div 
      key="preloader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-8 bg-[#0a0a0a] overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-500/30 blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[100px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-10">
        
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ 
              rotate: [0, 360],
            }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(249,115,22,0.15)]"
          >
            <LayoutGrid className="w-10 h-10 text-orange-500" />
          </motion.div>
          
          <div className="text-center">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">THE BEST <span className="text-orange-500">FAN</span></h1>
            <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase mt-1">L'expérience ultime commence</p>
          </div>
        </div>

        <div className="w-full space-y-3">
          <div className="flex justify-between items-end px-1">
            <span className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-2">
              {progress < 100 && <Loader2 className="w-3 h-3 animate-spin text-orange-500" />}
              {statusText}
            </span>
            <span className="text-orange-500 font-black text-sm">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden outline outline-1 outline-white/5 outline-offset-2">
            <motion.div 
              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 relative"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
