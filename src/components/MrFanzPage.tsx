import React from "react";
import { Card, Button } from "./Layout";
import {
  HelpCircle,
  Swords,
  Zap,
  Star,
  TrendingUp,
  Users,
  Target,
  Store,
  ChevronRight,
  Info,
  Play,
} from "lucide-react";
import { motion } from "motion/react";

export function MrFanzPage({ onBack }: { onBack: () => void }) {
  const sections = [
    {
      id: "basics",
      title: "Les Bases du Fan",
      icon: <Star className="text-yellow-500" />,
      content:
        "Bienvenue dans TheBestFan! Ton but est de devenir l'Ultra suprême. Pour cela, tu dois accumuler de la Ferveur en participant à des actions LIFE et en gagnant des Duels.",
      tips: [
        "Les points de Ferveur font monter ton niveau de Fan.",
        "Plus ton niveau est haut, plus ton impact dans les duels est grand.",
        "Chaque FANZ a son propre rang et ses propres compétences.",
      ],
    },
    {
      id: "life",
      title: "Actions LIFE",
      icon: <Target className="text-green-500" />,
      content:
        "Les actions LIFE permettent à tes FANZ de s'entraîner même quand il n'y a pas de match. C'est le meilleur moyen de gagner de l'argent ($) et de l'expérience.",
      tips: [
        "Un FANZ actif ne peut faire qu'une action à la fois.",
        "Faire un café rapporte peu mais c'est rapide.",
        "Organiser un KOP rapporte gros mais prend du temps.",
      ],
    },
    {
      id: "progression",
      title: "Progression des FANZ",
      icon: <Zap className="text-yellow-400" />,
      content:
        "La montée en compétences de tes FANZ se fait grâce aux actions LIFE ! Chaque action réussie donne de l'XP à ton FANZ.",
      tips: [
        "L'XP permet de monter en niveau et d'améliorer les statistiques : Force, Endurance, Mental, etc.",
        "Des statistiques plus élevées te rendent beaucoup plus fort et résistant durant les Duels !",
        "Fais progresser plusieurs FANZ pour pouvoir t'adapter à tous les adversaires.",
      ],
    },
    {
      id: "duels",
      title: "L'Art du Duel",
      icon: <Swords className="text-orange-500" />,
      content:
        "Les duels sont le cœur du jeu. Tu affrontes d'autres fans en temps réel pendant un match. Le but est de tirer la barre de ferveur vers ton équipe en cliquant le plus vite possible.",
      tips: [
        "Utilise tes cartes au bon moment pour bloquer l'adversaire.",
        "Surveille ton énergie (Excitation), elle ne remonte pas instantanément.",
        "Si personne n'est là, des Bots (IA) viendront te défier !",
      ],
    },
    {
      id: "skills",
      title: "Compétences & Stats",
      icon: <TrendingUp className="text-blue-500" />,
      content:
        "Les statistiques de votre FANZ déterminent de nombreux paramètres cruciaux pendant le duel. Ne négligez aucune stat et adaptez votre composition !",
      tips: [
        "FORCE : Dégâts et puissance pure de vos clics par rapport à l'adversaire.",
        "ENDURANCE : Accélère la vitesse de régénération de votre jauge d'Excitation.",
        "MENTAL : Renforce votre résistance pour réduire la durée des malus agressifs que vous subissez.",
        "BLUFF : Vos malus visuels dureront plus longtemps chez l'adversaire (et moins longtemps sur vous).",
        "CRÉATIVITÉ : Vos cartes coûtent moins d'Excitation à jouer.",
        "SOCIAL : Augmente vos gains d'XP en fin de match.",
        "INTELLIGENCE : Augmente vos chances de piocher des cartes rares avec Lucky Draw.",
        "CHARISME : Multiplie les bonus et l'impact de toutes vos cartes.",
      ],
    },
    {
      id: "shop",
      title: "Boutique & Boosts",
      icon: <Store className="text-purple-500" />,
      content:
        "Utilise ton argent gagné pour acheter des nouveaux FANZ, des emotes ou des boosts d'énergie.",
      tips: [
        "Les Packs FANZ te permettent de débloquer des personnages rares.",
        "Les Boosts sont essentiels pour enchaîner les duels.",
        "Garde toujours un peu d'argent pour les frais d'inscription aux grands tournois.",
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-20">
      {/* Hero Section */}
      <div className="relative h-48 sm:h-64 shrink-0 flex items-center justify-center overflow-hidden px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-600/20 to-transparent z-0" />
        <div className="relative z-10 flex items-center gap-4 sm:gap-6 max-w-2xl w-full">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 sm:w-40 sm:h-40 shrink-0"
          >
            <img
              src="https://thebestfan.online/img/public/mrfan/mrfan.png"
              alt="MrFanz"
              className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]"
              onError={(e) => {
                e.currentTarget.src =
                  "https://api.dicebear.com/7.x/bottts/svg?seed=MrFanz";
              }}
            />
          </motion.div>
          <div>
            <h1 className="text-xl sm:text-4xl font-black italic uppercase tracking-tighter text-white leading-none mb-1 sm:mb-2">
              Guide de <span className="text-orange-500 uppercase">MrFanz</span>
            </h1>
            <p className="text-gray-400 font-bold italic text-xs sm:text-base leading-tight">
              "Salut Champion ! Besoin d'un coup de main ? Je t'explique tout
              pour devenir une légende."
            </p>
          </div>
        </div>
      </div>

      {/* Guide Content */}
      <div className="px-4 py-4 sm:py-6 space-y-4 sm:space-y-8 max-w-[600px] mx-auto w-full">
        <div className="mt-8 mb-6 overflow-hidden">
          <h2 className="text-xl font-black italic uppercase tracking-tight text-white px-4 sm:px-6 mb-4 flex items-center gap-2">
            <Play className="text-orange-500 w-5 h-5" /> Tutoriels Vidéos
          </h2>
          <div className="flex overflow-x-auto no-scrollbar gap-4 px-4 sm:px-6 pb-4 snap-x snap-mandatory">
            {[
              { id: 1, title: "Bienvenue dans The Best Fan" },
              { id: 2, title: "Adopte ton Fanz" },
              { id: 3, title: "Collectionne les Cartes" },
              { id: 4, title: "Gagne tes Duels" },
              { id: 5, title: "Progression & Stats" },
              { id: 6, title: "Ferveur et Récompenses" },
            ].map((video) => (
              <div
                key={`video-${video.id}`}
                className="w-[160px] sm:w-[240px] shrink-0 aspect-[9/16] bg-black border border-white/10 rounded-2xl overflow-hidden snap-center relative shadow-xl flex flex-col"
              >
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-3 z-10 pointer-events-none">
                  <h3 className="text-white font-black italic uppercase text-[10px] sm:text-xs leading-tight drop-shadow-md">
                    {video.title}
                  </h3>
                </div>
                <video
                  src={`https://thebestfan.online/img/public/tuto/video${video.id}.mp4`}
                  className="absolute inset-0 w-full h-full object-cover"
                  controls
                  preload="metadata"
                  playsInline
                />
              </div>
            ))}
          </div>
        </div>

        {sections.map((section, idx) => (
          <motion.div
            key={section.id}
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="p-4 sm:p-6 border-white/5 bg-white/5 hover:bg-white/10 transition-colors group">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                  {React.cloneElement(section.icon as React.ReactElement<any>, {
                    className:
                      "w-4 h-4 sm:w-5 sm:h-5 " +
                      (section.icon as React.ReactElement<any>).props.className,
                  })}
                </div>
                <h2 className="text-base sm:text-xl font-black italic uppercase tracking-tight text-white">
                  {section.title}
                </h2>
              </div>

              <div className="flex flex-col gap-4 sm:gap-6">
                <div className="flex-1">
                  <p className="text-[11px] sm:text-sm text-gray-300 font-medium leading-relaxed">
                    {section.content}
                  </p>
                </div>
                <div className="flex-1 bg-black/30 rounded-xl p-3 sm:p-4 border border-white/5">
                  <h4 className="text-[9px] sm:text-[10px] font-black uppercase text-orange-500 mb-2 sm:mb-3 tracking-widest flex items-center gap-2">
                    <Info size={10} className="sm:w-3 sm:h-3" /> Conseils de Pro
                  </h4>
                  <ul className="space-y-2 sm:space-y-3">
                    {section.tips.map((tip, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-[10px] sm:text-xs font-bold text-gray-400 leading-snug"
                      >
                        <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-500 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}

        <div className="pt-6 sm:pt-10 pb-20 text-center">
          <Button
            onClick={onBack}
            variant="outline"
            className="w-full sm:w-auto px-10 h-12 sm:h-14 text-xs sm:text-sm font-black uppercase italic tracking-widest"
          >
            C'est compris, let's go !
          </Button>
        </div>
      </div>
    </div>
  );
}
