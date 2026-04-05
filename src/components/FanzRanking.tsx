import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, where, documentId } from 'firebase/firestore';
import { Fanz, UserProfile, FanzTemplate } from '../types';
import { Trophy, User, Flame, Medal } from 'lucide-react';
import { getImageUrl, cn } from '../lib/utils';
import { Card } from './Layout';

export function FanzRanking() {
  const [topFanz, setTopFanz] = useState<(Fanz & { ownerPseudo?: string; template?: FanzTemplate })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        // 1. Fetch top 50 FANZ by ferveurPoints
        const fanzQuery = query(
          collection(db, 'fanz'),
          orderBy('ferveurPoints', 'desc'),
          limit(50)
        );
        const fanzSnapshot = await getDocs(fanzQuery);
        const fanzList = fanzSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fanz));

        if (fanzList.length === 0) {
          setTopFanz([]);
          setLoading(false);
          return;
        }

        // 2. Fetch unique owners
        const ownerUids = Array.from(new Set(fanzList.map(f => f.ownerUid)));
        const ownersMap = new Map<string, string>();
        
        // Firestore 'in' query supports max 10 elements, so we chunk it
        const chunks = [];
        for (let i = 0; i < ownerUids.length; i += 10) {
          chunks.push(ownerUids.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          const userQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
          const userSnapshot = await getDocs(userQuery);
          userSnapshot.forEach(doc => {
            const userData = doc.data() as UserProfile;
            ownersMap.set(userData.uid, userData.pseudo || userData.displayName || 'Anonyme');
          });
        }

        // 3. Fetch templates
        const templateIds = Array.from(new Set(fanzList.map(f => f.templateId)));
        const templatesMap = new Map<string, FanzTemplate>();
        
        const templateChunks = [];
        for (let i = 0; i < templateIds.length; i += 10) {
          templateChunks.push(templateIds.slice(i, i + 10));
        }

        for (const chunk of templateChunks) {
          const templateQuery = query(collection(db, 'fanz_templates'), where(documentId(), 'in', chunk));
          const templateSnapshot = await getDocs(templateQuery);
          templateSnapshot.forEach(doc => {
            templatesMap.set(doc.id, { id: doc.id, ...doc.data() } as FanzTemplate);
          });
        }

        // 4. Combine data
        const combined = fanzList.map(f => ({
          ...f,
          ownerPseudo: ownersMap.get(f.ownerUid),
          template: templatesMap.get(f.templateId)
        }));

        setTopFanz(combined);
      } catch (err) {
        console.error("Error fetching FANZ ranking:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">Calcul du classement mondial...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h2 className="text-2xl font-black italic uppercase tracking-wider">Top 50 FANZ Mondiaux</h2>
      </div>

      <div className="space-y-3">
        {topFanz.map((fanz, index) => {
          const rarityColor = fanz.template?.rarity === 'legendary' ? 'border-yellow-500/50 shadow-yellow-500/10' :
                             fanz.template?.rarity === 'epic' ? 'border-purple-500/50 shadow-purple-500/10' :
                             fanz.template?.rarity === 'rare' ? 'border-blue-500/50 shadow-blue-500/10' :
                             'border-white/10 shadow-none';

          return (
            <Card key={fanz.id} className={cn(
              "p-3 flex items-center gap-4 border transition-all hover:scale-[1.01] duration-300",
              index === 0 ? "bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/50 shadow-lg shadow-yellow-500/10" :
              index === 1 ? "bg-gradient-to-r from-gray-400/20 to-transparent border-gray-400/50 shadow-lg shadow-gray-400/10" :
              index === 2 ? "bg-gradient-to-r from-orange-900/30 to-transparent border-orange-900/50 shadow-lg shadow-orange-900/10" :
              cn("bg-white/5", rarityColor)
            )}>
              {/* Rank */}
              <div className="w-8 flex flex-col items-center justify-center">
                {index < 3 ? (
                  <Medal className={cn(
                    "w-7 h-7 drop-shadow-lg",
                    index === 0 ? "text-yellow-500" :
                    index === 1 ? "text-gray-400" :
                    "text-orange-900"
                  )} />
                ) : (
                  <span className="text-lg font-black italic text-gray-500">#{index + 1}</span>
                )}
              </div>

              {/* Fanz Image */}
              <div className={cn(
                "w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 shadow-inner",
                index === 0 ? "border-yellow-500" :
                index === 1 ? "border-gray-400" :
                index === 2 ? "border-orange-900" :
                "border-white/10"
              )}>
                <img 
                  src={getImageUrl(fanz.imageUrl || fanz.template?.image || '')} 
                  alt={fanz.name} 
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-black italic uppercase text-base truncate text-white">
                    {fanz.name}
                  </h3>
                  {fanz.template?.rarity && (
                    <span className={cn(
                      "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                      fanz.template.rarity === 'legendary' ? "bg-yellow-500 text-black" :
                      fanz.template.rarity === 'epic' ? "bg-purple-500 text-white" :
                      fanz.template.rarity === 'rare' ? "bg-blue-500 text-white" :
                      "bg-gray-500 text-white"
                    )}>
                      {fanz.template.rarity}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase mt-0.5">
                  <User className="w-3.5 h-3.5 text-orange-500/70" />
                  <span className="truncate">{fanz.ownerPseudo || 'Anonyme'}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="text-right flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-orange-500">
                  <Flame className="w-5 h-5 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                  <span className="text-lg font-black italic tracking-tighter">{fanz.ferveurPoints.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                    Niv. {fanz.ferveurLevel}
                  </span>
                  <span className="text-[10px] font-black uppercase text-orange-500/80 bg-orange-500/5 px-2 py-0.5 rounded-full border border-orange-500/10">
                    Rang {fanz.rank}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}

        {topFanz.length === 0 && (
          <div className="text-center py-10 text-gray-500 font-bold italic">
            Aucun FANZ n'a encore gagné de ferveur.
          </div>
        )}
      </div>
    </div>
  );
}
