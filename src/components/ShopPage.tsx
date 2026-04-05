import React from 'react';
import { Store, Gem, Zap, Star, ArrowLeft } from 'lucide-react';
import { Card, Button } from './Layout';
import { UserProfile } from '../types';
import { motion } from 'motion/react';

interface ShopPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function ShopPage({ profile, onBack }: ShopPageProps) {
  const categories = [
    { id: 'featured', title: 'À la une', icon: <Star className="w-4 h-4" /> },
    { id: 'skins', title: 'Skins', icon: <Store className="w-4 h-4" /> },
    { id: 'emotes', title: 'Emotes', icon: <Store className="w-4 h-4" /> },
    { id: 'currency', title: 'Ressources', icon: <Gem className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-900/90 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-yellow-500" />
            Boutique
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
            <span className="text-green-500 font-black text-xs">$</span>
            <span className="text-white font-bold text-xs">{profile.money || 0}</span>
          </div>
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
            <span className="text-blue-500 font-black text-xs">💎</span>
            <span className="text-white font-bold text-xs">{profile.gems || 0}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-20">
        {/* Categories */}
        <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
          {categories.map(cat => (
            <button key={cat.id} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full whitespace-nowrap hover:bg-white/10 transition-colors">
              {cat.icon}
              <span className="text-xs font-bold uppercase tracking-widest text-white">{cat.title}</span>
            </button>
          ))}
        </div>

        {/* Featured Offer */}
        <section>
          <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-4">Offre du jour</h2>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card className="relative overflow-hidden border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-orange-500/20" />
              <div className="relative p-6 flex flex-col items-center text-center">
                <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full">
                  -50%
                </div>
                <Zap className="w-16 h-16 text-yellow-500 mb-4 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                <h3 className="text-xl font-black italic uppercase text-white mb-1">Pack Ferveur</h3>
                <p className="text-xs text-gray-400 mb-4">1000 Gemmes + 5000$ + Boost XP</p>
                <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black uppercase">
                  Acheter 4.99€
                </Button>
              </div>
            </Card>
          </motion.div>
        </section>

        {/* Resources */}
        <section>
          <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-4">Ressources</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 flex flex-col items-center text-center border-white/5 hover:border-blue-500/50 transition-colors cursor-pointer">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">💎</span>
              </div>
              <h4 className="text-sm font-black uppercase text-white mb-1">Poignée de Gemmes</h4>
              <p className="text-[10px] text-blue-400 font-bold mb-3">80 Gemmes</p>
              <Button size="sm" variant="outline" className="w-full text-xs">1.19€</Button>
            </Card>
            <Card className="p-4 flex flex-col items-center text-center border-white/5 hover:border-green-500/50 transition-colors cursor-pointer">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl text-green-500 font-black">$</span>
              </div>
              <h4 className="text-sm font-black uppercase text-white mb-1">Bourse de Billets</h4>
              <p className="text-[10px] text-green-400 font-bold mb-3">1000 $</p>
              <Button size="sm" variant="outline" className="w-full text-xs">10 Gemmes</Button>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
