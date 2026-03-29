import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ResourceTransaction, UserProfile, Fanz } from '../types';
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LOGOS } from '../constants';

interface TransactionsPageProps {
  profile: UserProfile;
  onBack: () => void;
}

type FilterType = 'all' | 'money' | 'gems' | 'boost' | 'energy' | 'ferveur_general' | 'ferveur_fanz';

export function TransactionsPage({ profile, onBack }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<ResourceTransaction[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [fanzList, setFanzList] = useState<Record<string, Fanz>>({});

  useEffect(() => {
    // Fetch Fanz to display names for ferveur_fanz transactions
    const qFanz = query(collection(db, 'fanz'), where('userId', '==', profile.uid));
    const unsubscribeFanz = onSnapshot(qFanz, (snapshot) => {
      const fanzMap: Record<string, Fanz> = {};
      snapshot.docs.forEach(doc => {
        fanzMap[doc.id] = { id: doc.id, ...doc.data() } as Fanz;
      });
      setFanzList(fanzMap);
    });

    // Fetch transactions
    const qTransactions = query(
      collection(db, 'transactions'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResourceTransaction));
      setTransactions(txs);
    });

    return () => {
      unsubscribeFanz();
      unsubscribeTransactions();
    };
  }, [profile.uid]);

  const filteredTransactions = transactions.filter(tx => filter === 'all' || tx.type === filter);

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'money': return <img src={LOGOS.money} alt="Money" className="w-4 h-4 object-contain" />;
      case 'gems': return <img src={LOGOS.gems} alt="Gems" className="w-4 h-4 object-contain" />;
      case 'boost': return <img src={LOGOS.boost} alt="Boost" className="w-4 h-4 object-contain" />;
      case 'energy': return <img src={LOGOS.energy} alt="Energy" className="w-4 h-4 object-contain" />;
      case 'ferveur_general': return <img src={LOGOS.ferveur} alt="Ferveur" className="w-4 h-4 object-contain" />;
      case 'ferveur_fanz': return <img src={LOGOS.ferveur} alt="Ferveur FANZ" className="w-4 h-4 object-contain" />;
      default: return null;
    }
  };

  const getResourceName = (type: string) => {
    switch (type) {
      case 'money': return 'Argent';
      case 'gems': return 'Gemmes';
      case 'boost': return 'Boosts';
      case 'energy': return 'Énergie';
      case 'ferveur_general': return 'XP Ferveur Général';
      case 'ferveur_fanz': return 'XP Ferveur FANZ';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black uppercase italic tracking-wider">Historique</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            <Filter className="w-4 h-4 text-gray-400 ml-2" />
            {(['all', 'money', 'gems', 'boost', 'energy', 'ferveur_general', 'ferveur_fanz'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  filter === f 
                    ? 'bg-orange-500 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {f === 'all' ? 'Tout' : getResourceName(f)}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3 mt-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-bold">
              Aucune transaction trouvée.
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div 
                key={tx.id} 
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.amount > 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                  }`}>
                    {tx.amount > 0 ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  
                  <div>
                    <div className="font-bold text-sm">{tx.description}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                      <span>{format(new Date(tx.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {getResourceIcon(tx.type)}
                        {getResourceName(tx.type)}
                      </span>
                      {tx.type === 'ferveur_fanz' && tx.fanzId && fanzList[tx.fanzId] && (
                        <>
                          <span>•</span>
                          <span className="text-orange-400">{fanzList[tx.fanzId].name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`font-black text-lg flex items-center gap-1 ${
                  tx.amount > 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                  {getResourceIcon(tx.type)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
