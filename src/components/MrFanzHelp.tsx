import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, X, Info, ChevronRight, Play } from "lucide-react";
import { Card, Button } from "./Layout";

interface HelpContext {
  title: string;
  description: string;
  features: { name: string; desc: string }[];
}

const HELP_CONTENT: Record<string, HelpContext> = {
  home: {
    title: "Tableau de Bord & Actions LIFE",
    description:
      "C'est ici que tu gères ton empire de Fan. Les actions LIFE sont essentielles !",
    features: [
      {
        name: "Actions LIFE",
        desc: "Envoie tes FANZ travailler pour gagner du cash et de l'XP.",
      },
      {
        name: "Ferveur",
        desc: "Ta barre de progression globale. Plus elle est remplie, plus tu es respecté.",
      },
      {
        name: "Coupe du Monde",
        desc: "La compétition suprême avec des classements par groupes.",
      },
    ],
  },
  fanz: {
    title: "Tes FANZ & Compétences",
    description:
      "Chaque FANZ est unique. Gère leurs équipements et leurs niveaux.",
    features: [
      {
        name: "Stats",
        desc: "Force (clics), Endurance (énergie), Mental (résistance).",
      },
      {
        name: "Le Deck",
        desc: "Équipe 8 cartes par FANZ pour pouvoir les utiliser en duel.",
      },
      {
        name: "Rareté",
        desc: "Plus un FANZ est rare, plus ses stats de base sont élevées.",
      },
    ],
  },
  waiting_room: {
    title: "Salle d'Attente & Duels",
    description: "Trouve ou crée des duels pour affronter la communauté.",
    features: [
      {
        name: "Rejoindre",
        desc: "Entre dans un salon 1v1, 2v2 ou 5v5 pour jouer.",
      },
      { name: "Code Privé", desc: "Organise des duels secrets avec tes amis." },
      {
        name: "Bots",
        desc: "Si tu es seul, des IA miroirs se joindront à toi après 15s.",
      },
    ],
  },
  social: {
    title: "Social & Communauté",
    description: "Fais-toi des amis et discute avec les autres KOPs.",
    features: [
      {
        name: "Demandes",
        desc: "Réponds aux fans qui veulent rejoindre ton cercle.",
      },
      {
        name: "Inviter",
        desc: "Partage ton lien pour ramener tes vrais amis sur le jeu.",
      },
      { name: "Chat", desc: "Discute en privé ou dans les salons de KOP." },
    ],
  },
  shop: {
    title: "Boutique & Boosts",
    description: "Optimise ton arsenal de Fan.",
    features: [
      {
        name: "Boosts",
        desc: "Achete de l'énergie pour ne jamais t'arrêter de cliquer.",
      },
      {
        name: "Packs",
        desc: "Tente ta chance pour débloquer des FANZ exclusifs.",
      },
      {
        name: "Emotes",
        desc: "Achète des emotes pour chambrer tes adversaires en duel.",
      },
    ],
  },
};

export function MrFanzHelp({ contextId }: { contextId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const help = HELP_CONTENT[contextId] || HELP_CONTENT.home;

  return (
    <div className="inline-flex items-center ml-1">
      {/* Discreet small help button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-orange-500 hover:border-orange-500/30 transition-all cursor-help"
        title="Aide de MrFanz"
      >
        <HelpCircle size={10} />
      </button>

      {/* Help Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#111111] border-2 border-orange-500/50 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              {/* Header */}
              <div className="bg-gradient-to-b from-orange-600/20 to-transparent p-6 pb-2 text-center">
                <div className="w-24 h-24 mx-auto mb-4">
                  <img
                    src="https://thebestfan.online/img/public/mrfan/mrfan.png"
                    alt="MrFanz"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://api.dicebear.com/7.x/bottts/svg?seed=MrFanz";
                    }}
                  />
                </div>
                <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">
                  Les conseils de{" "}
                  <span className="text-orange-500">MrFanz</span>
                </h3>
              </div>

              {/* Content */}
              <div className="p-6 pt-0 space-y-4">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <h4 className="text-orange-500 font-black italic text-sm uppercase mb-2 flex items-center gap-2">
                    <Info size={14} /> {help.title}
                  </h4>
                  <p className="text-gray-400 text-xs font-bold leading-relaxed">
                    {help.description}
                  </p>
                </div>

                <div className="space-y-2">
                  {help.features.map((f, i) => (
                    <div
                      key={i}
                      className="flex gap-3 items-start p-3 bg-black/40 rounded-xl border border-white/5"
                    >
                      <div className="w-6 h-6 shrink-0 bg-orange-500/20 text-orange-500 rounded-lg flex items-center justify-center font-black italic text-[10px]">
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase text-white tracking-widest">
                          {f.name}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 italic mt-0.5 leading-snug">
                          {f.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <h4 className="text-orange-500 font-black italic text-xs uppercase mb-3 flex items-center gap-2">
                    <Play size={14} /> Tutoriels Vidéos
                  </h4>
                  <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2 snap-x">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <div
                        key={num}
                        className="min-w-[140px] shrink-0 aspect-[9/16] bg-black/50 border border-white/5 rounded-xl overflow-hidden snap-center relative flex items-center justify-center group"
                      >
                        <video
                          src={`https://thebestfan.online/img/public/tuto/video${num}.mp4`}
                          className="absolute inset-0 w-full h-full object-cover"
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => setIsOpen(false)}
                  className="w-full py-4 text-xs font-black uppercase italic tracking-widest bg-orange-600 mt-4 shadow-lg active:scale-95"
                >
                  C'est clair, MrFanz !
                </Button>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
