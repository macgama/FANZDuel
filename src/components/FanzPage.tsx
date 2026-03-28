import React, { useState, useEffect } from 'react';
import { getImageUrl, cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { FanzTemplate, Fanz } from '../types';
import { Trophy, Lock, Star, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FanzPageProps {
  userUid: string;
  onFanzClick?: (fanzId: string) => void;
}

export function FanzPage({ userUid, onFanzClick }: FanzPageProps) {
  const [ownedFanz, setOwnedFanz] = useState<Map<string, Fanz>>(new Map()); // templateId -> Fanz object
  const [fanzTemplates, setFanzTemplates] = useState<FanzTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'fanz_templates'));
        const templates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FanzTemplate));
        setFanzTemplates(templates);
      } catch (err) {
        console.error("Error fetching fanz templates", err);
      }
    };
    fetchTemplates();

    const q = query(collection(db, 'fanz'), where('ownerUid', '==', userUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fanzMap = new Map<string, Fanz>();
      snapshot.forEach((doc) => {
        const data = doc.data() as Fanz;
        if (data.templateId) {
          fanzMap.set(data.templateId, data);
        }
      });
      setOwnedFanz(fanzMap);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userUid]);

  const filteredFanz = fanzTemplates.filter((f) => {
    if (filter === 'owned') return ownedFanz.has(f.id);
    if (filter === 'missing') return !ownedFanz.has(f.id);
    return true;
  });

  const ownedCount = ownedFanz.size;
  const totalCount = fanzTemplates.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">Chargement de votre collection...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Stats */}
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={() => setFilter('all')}
          className="text-xl font-black italic uppercase tracking-tighter hover:text-orange-500 transition-colors"
        >
          Collection FANZ
        </button>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 flex items-center justify-center gap-3">
            <button 
              onClick={() => setFilter(filter === 'owned' ? 'all' : 'owned')}
              className={cn(
                "text-center transition-all",
                filter === 'owned' ? "opacity-100 scale-110" : "opacity-50 hover:opacity-100"
              )}
            >
              <div className="text-sm font-black text-orange-500 leading-none">{ownedCount}</div>
              <div className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Gagnés</div>
            </button>
            <div className="h-4 w-px bg-white/10"></div>
            <button 
              onClick={() => setFilter(filter === 'missing' ? 'all' : 'missing')}
              className={cn(
                "text-center transition-all",
                filter === 'missing' ? "opacity-100 scale-110" : "opacity-50 hover:opacity-100"
              )}
            >
              <div className="text-sm font-black text-gray-400 leading-none">{totalCount - ownedCount}</div>
              <div className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">À Gagner</div>
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div 
              className="absolute inset-y-0 left-0 bg-orange-500 transition-all duration-1000 flex items-center justify-center"
              style={{ width: `${Math.max(8, (ownedCount / totalCount) * 100)}%` }}
            >
              <span className="text-[7px] font-black text-white px-1">
                {Math.round((ownedCount / totalCount) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="space-y-12">
        {/* Owned Section */}
        {(filter === 'all' || filter === 'owned') && ownedCount > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-2">
              <h2 className="text-xl font-black italic uppercase tracking-wider">FANZ Gagnés</h2>
              <span className="text-xs font-bold px-2 py-0.5 bg-orange-500/20 text-orange-500 rounded-full">
                {ownedCount}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fanzTemplates.filter(f => ownedFanz.has(f.id)).map((template) => (
                <FanzCard 
                  key={template.id} 
                  template={template} 
                  fanz={ownedFanz.get(template.id)}
                  isOwned={true} 
                  onClick={() => onFanzClick && onFanzClick(ownedFanz.get(template.id)!.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Missing Section */}
        {(filter === 'all' || filter === 'missing') && (totalCount - ownedCount) > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-2">
              <Lock className="w-5 h-5 text-gray-500" />
              <h2 className="text-xl font-black italic uppercase tracking-wider text-gray-500">FANZ à Gagner</h2>
              <span className="text-xs font-bold px-2 py-0.5 bg-white/10 text-gray-500 rounded-full">
                {totalCount - ownedCount}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fanzTemplates.filter(f => !ownedFanz.has(f.id)).map((template) => (
                <FanzCard 
                  key={template.id} 
                  template={template} 
                  isOwned={false} 
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FanzCard({ template, fanz, isOwned, onClick, onUnlock }: { template: FanzTemplate; fanz?: Fanz; isOwned: boolean; onClick?: () => void; onUnlock?: () => void }) {
  const [isHovered, setIsHovered] = useState(false);

  const equippedSkinData = template.skins?.find(s => s.id === fanz?.equippedSkin);
  const currentImageUrl = equippedSkinData?.imageUrl || fanz?.imageUrl || template.image;
  const currentVideoUrl = equippedSkinData?.videoUrl || fanz?.videoUrl || template.video;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group ${!isOwned ? '' : 'cursor-pointer'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={isOwned ? onClick : undefined}
    >
      <Card className={`overflow-hidden p-0 border transition-all duration-500 ${
        isOwned 
          ? 'border-orange-500/30 hover:border-orange-500 shadow-lg hover:shadow-orange-500/20' 
          : 'border-white/5 grayscale hover:grayscale-0 hover:border-orange-500/50'
      }`}>
        <div className="aspect-[3/4] relative">
          {currentVideoUrl && isHovered ? (
            <video
              src={getImageUrl(currentVideoUrl)}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img 
              src={getImageUrl(currentImageUrl || '')} 
              alt={equippedSkinData?.name || template.name} 
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Rarity Badge */}
          <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter z-10 ${
            template.rarity === 'legendary' ? 'bg-yellow-500 text-black' :
            template.rarity === 'epic' ? 'bg-purple-500 text-white' :
            template.rarity === 'rare' ? 'bg-blue-500 text-white' :
            'bg-gray-500 text-white'
          }`}>
            {template.rarity}
          </div>

          {/* Rank Badge (Owned only) */}
          {isOwned && fanz && (
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[7px] font-black uppercase z-10 shadow-lg">
              Rang {fanz.rank}
            </div>
          )}

          {!isOwned && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <Lock className="w-6 h-6 text-white/50" />
              <span className="text-[8px] font-black uppercase italic text-white/50 mt-1">À Gagner</span>
            </div>
          )}

          {/* Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1 z-10">
            {isOwned && fanz && (
              <div className="space-y-1 mb-1">
                <div className="flex items-center justify-between text-[6px] font-black uppercase text-orange-400">
                  <span>Ferveur</span>
                  <span>{fanz.ferveurPoints} pts</span>
                </div>
                <div className="h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                    style={{ width: `${Math.min(100, (fanz.ferveurPoints / (template.ferveurPath?.find(l => l.level === fanz.ferveurLevel + 1)?.pointsRequired || 100)) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <h3 className="font-black italic uppercase text-[10px] leading-tight truncate text-white">
              {equippedSkinData?.name || template.name}
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-bold text-gray-300 uppercase tracking-widest">
                {isOwned ? 'Collectionné' : 'Verrouillé'}
              </span>
              <Info className="w-2.5 h-2.5 text-gray-400 cursor-help" />
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
