import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Card } from './Layout';
import { ALL_FANZ, FanzTemplate } from '../constants/fanz';
import { Trophy, Lock, Star, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FanzPageProps {
  userUid: string;
}

export function FanzPage({ userUid }: FanzPageProps) {
  const [ownedFanzIds, setOwnedFanzIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all');

  useEffect(() => {
    const q = query(collection(db, 'fanz'), where('ownerUid', '==', userUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Assuming the Fanz template ID is stored in a field or we use the document ID
        // Let's assume there's a 'templateId' field in the Fanz document
        if (data.templateId) {
          ids.add(data.templateId);
        }
      });
      setOwnedFanzIds(ids);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userUid]);

  const filteredFanz = ALL_FANZ.filter((f) => {
    if (filter === 'owned') return ownedFanzIds.has(f.id);
    if (filter === 'missing') return !ownedFanzIds.has(f.id);
    return true;
  });

  const ownedCount = ownedFanzIds.size;
  const totalCount = ALL_FANZ.length;

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-3">
            <Trophy className="text-orange-500 w-10 h-10" />
            Collection FANZ
          </h1>
          <p className="text-gray-500 font-medium">
            Collectionnez les 100 supporters légendaires du soccer.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-black text-orange-500">{ownedCount}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gagnés</div>
          </div>
          <div className="h-10 w-px bg-white/10"></div>
          <div className="text-center">
            <div className="text-2xl font-black text-gray-400">{totalCount - ownedCount}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">À Gagner</div>
          </div>
          <div className="h-10 w-px bg-white/10"></div>
          <div className="text-center">
            <div className="text-2xl font-black text-white">{Math.round((ownedCount / totalCount) * 100)}%</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Progression</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        <FilterButton 
          active={filter === 'all'} 
          onClick={() => setFilter('all')} 
          label="Tous" 
          count={totalCount}
        />
        <FilterButton 
          active={filter === 'owned'} 
          onClick={() => setFilter('owned')} 
          label="Gagnés" 
          count={ownedCount}
        />
        <FilterButton 
          active={filter === 'missing'} 
          onClick={() => setFilter('missing')} 
          label="À Gagner" 
          count={totalCount - ownedCount}
        />
      </div>

      {/* Grid */}
      <div className="space-y-12">
        {/* Owned Section */}
        {(filter === 'all' || filter === 'owned') && ownedCount > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-2">
              <Trophy className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-black italic uppercase tracking-wider">FANZ Gagnés</h2>
              <span className="text-xs font-bold px-2 py-0.5 bg-orange-500/20 text-orange-500 rounded-full">
                {ownedCount}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {ALL_FANZ.filter(f => ownedFanzIds.has(f.id)).map((fanz) => (
                <FanzCard 
                  key={fanz.id} 
                  fanz={fanz} 
                  isOwned={true} 
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {ALL_FANZ.filter(f => !ownedFanzIds.has(f.id)).map((fanz) => (
                <FanzCard 
                  key={fanz.id} 
                  fanz={fanz} 
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

function FilterButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase italic flex items-center gap-2 ${
        active 
          ? 'bg-orange-600 text-white shadow-lg' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/10'}`}>
        {count}
      </span>
    </button>
  );
}

function FanzCard({ fanz, isOwned }: { fanz: FanzTemplate; isOwned: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group ${!isOwned ? 'grayscale opacity-50' : ''}`}
    >
      <Card className={`overflow-hidden border-2 transition-all duration-500 ${
        isOwned 
          ? 'border-orange-500/30 hover:border-orange-500 shadow-lg hover:shadow-orange-500/20' 
          : 'border-white/5 grayscale'
      }`}>
        <div className="aspect-[3/4] relative">
          <img 
            src={fanz.image} 
            alt={fanz.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          
          {/* Rarity Badge */}
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
            fanz.rarity === 'legendary' ? 'bg-yellow-500 text-black' :
            fanz.rarity === 'epic' ? 'bg-purple-500 text-white' :
            fanz.rarity === 'rare' ? 'bg-blue-500 text-white' :
            'bg-gray-500 text-white'
          }`}>
            {fanz.rarity}
          </div>

          {!isOwned && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <Lock className="w-8 h-8 text-white/50" />
            </div>
          )}

          {isOwned && (
            <div className="absolute top-2 right-2">
              <div className="bg-orange-500 p-1 rounded-full shadow-lg">
                <Star className="w-3 h-3 text-white fill-white" />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 space-y-1">
          <h3 className="font-black italic uppercase text-xs truncate">
            {fanz.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
              {isOwned ? 'Collectionné' : 'Verrouillé'}
            </span>
            <Info className="w-3 h-3 text-gray-600 cursor-help" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
