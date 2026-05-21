import React, { useState } from "react";
import { motion } from "motion/react";
import { Auth } from "./Auth";
import { Button } from "./Layout";
import { getImageUrl, getOptimizedVideoUrl } from "../lib/utils";
import {
  Trophy,
  Swords,
  Users,
  Play,
  ChevronRight,
  Zap,
  Globe,
  Gamepad2,
  Layers,
  User,
  LineChart,
  Activity,
  AlertCircle,
  Coffee,
  ChevronDown,
  LogIn,
} from "lucide-react";

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col pt-4">
        <div className="px-4 max-w-md mx-auto w-full">
          <Button
            variant="outline"
            onClick={() => setShowAuth(false)}
            className="text-gray-400 hover:text-white mb-4 w-fit"
          >
            <ChevronRight className="w-5 h-5 rotate-180 mr-1" />
            Retour
          </Button>
        </div>
        <Auth onAuthSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white font-sans selection:bg-orange-500/30 overflow-x-hidden">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#111]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="text-2xl font-black italic tracking-tighter text-orange-500">
              TBFO
            </div>
            <div className="hidden md:flex items-center gap-2 text-gray-400 font-bold text-xs cursor-not-allowed group">
              <Globe className="w-4 h-4" />
              <span className="uppercase tracking-widest group-hover:text-white transition-colors">
                FR
              </span>
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>

          <button
            onClick={() => setShowAuth(true)}
            className="bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-xs px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-orange-600/20 active:scale-95"
          >
            Connexion
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden min-h-screen flex flex-col items-center justify-center">
        {/* Background Decorative Elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none" />
        <img
          src="https://images.unsplash.com/photo-1518605368461-1e1296cb3b13?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-overlay pointer-events-none"
        />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl backdrop-blur-md"
          >
            <Gamepad2 className="w-10 h-10 text-orange-500" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9] mb-6"
          >
            Devenez le <br />
            <span className="text-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.3)]">
              Meilleur Fan
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-blue-400 font-bold max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Suivez les scores en direct, soutenez votre club et affrontez
            d'autres fans dans des duels stratégiques épiques.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4"
          >
            <button
              onClick={() => setShowAuth(true)}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-sm px-10 py-4 rounded-xl transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center gap-3"
            >
              <Activity className="w-5 h-5" />
              Scores en direct
            </button>
            <button
              onClick={() => setShowAuth(true)}
              className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-sm px-10 py-4 rounded-xl transition-all flex items-center justify-center gap-3"
            >
              <LogIn className="w-5 h-5" />
              Se connecter
            </button>
          </motion.div>
        </div>

        {/* Floating Assets */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden hidden xl:block z-0">
          <motion.img
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            src={getImageUrl("/fanz/001/imageFanz001Skin000.png")}
            className="absolute top-[15%] left-[5%] w-64 h-64 object-contain opacity-40 blur-[1px] drop-shadow-2xl"
          />
          <motion.video
            autoPlay
            loop
            muted
            playsInline
            animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            src={getOptimizedVideoUrl("/fanz/001/videoFanz001Skin000.mp4")}
            className="absolute bottom-[20%] right-[5%] w-56 h-56 object-contain opacity-50 blur-[1px] -rotate-12 drop-shadow-2xl"
          />
          <motion.video
            autoPlay
            loop
            muted
            playsInline
            animate={{ scale: [1, 1.1, 1], rotate: [12, 15, 12] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            src={getOptimizedVideoUrl("/fanz/001/videoFanz001Skin000Win.mp4")}
            className="absolute top-[15%] right-[10%] w-48 h-48 object-contain opacity-40 drop-shadow-2xl"
          />
        </div>
      </section>

      {/* L'EXPÉRIENCE ULTIME */}
      <section className="py-32 px-6 bg-[#0c0c0c] relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black uppercase italic mb-2 tracking-tighter">
              L'expérience Ultime
            </h2>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs md:text-sm">
              Vivez votre passion comme jamais
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <LandingCard
              icon={<Swords className="w-6 h-6 text-orange-500" />}
              title="Duels en direct"
              description="Affrontez d'autres supporters pendant les matchs."
            />
            <LandingCard
              icon={<Layers className="w-6 h-6 text-orange-500" />}
              title="Arsenal Tactique"
              description="Jouez des cartes pour influencer le score."
            />
            <LandingCard
              icon={<User className="w-6 h-6 text-orange-500" />}
              title="Votre Fan"
              description="Faites évoluer votre personnage et son look."
            />
            <LandingCard
              icon={<LineChart className="w-6 h-6 text-orange-500" />}
              title="Classements"
              description="Portez votre club au sommet du monde."
            />
          </div>
        </div>
      </section>

      {/* L'ARÈNE EN CHIFFRES */}
      <section className="py-32 px-6 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black uppercase italic mb-2 tracking-tighter">
              L'arène en chiffres
            </h2>
            <p className="text-gray-500 font-bold tracking-widest text-xs md:text-sm">
              Une communauté passionnée à travers le monde.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            <StatItem
              icon={<Users className="w-6 h-6" />}
              value="..."
              label="Supporters"
            />
            <StatItem
              icon={<Globe className="w-6 h-6" />}
              value="..."
              label="En ligne"
            />
            <StatItem
              icon={<Activity className="w-6 h-6" />}
              value="0"
              label="Matchs Live"
            />
            <StatItem
              icon={<Swords className="w-6 h-6" />}
              value="..."
              label="Duels Actifs"
            />
          </div>
        </div>
      </section>

      {/* BETA VERSION & COFFEE */}
      <section className="py-20 px-6 max-w-4xl mx-auto text-center">
        <div className="bg-orange-950/20 border border-orange-500/20 rounded-3xl overflow-hidden mb-12 shadow-2xl">
          <div className="bg-orange-500/10 px-4 py-3 flex items-center justify-center gap-2 border-b border-orange-500/20 font-black uppercase text-[10px] tracking-widest text-orange-500">
            <AlertCircle className="w-4 h-4" />
            Version Bêta
          </div>
          <div className="p-8 italic font-bold text-gray-400 leading-relaxed md:text-lg">
            "L'application est actuellement en phase de test. Des mises à jour
            et des ajustements techniques peuvent avoir lieu avant la version
            1.0."
          </div>
        </div>

        <div className="space-y-4">
          <p className="uppercase font-black tracking-[0.3em] text-[10px] text-gray-500">
            Soutenir le développement
          </p>
          <a
            href="https://buymeacoffee.com/thebestfanonline"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-4 bg-[#FFDD00] hover:bg-[#FFEA00] text-black font-black uppercase text-sm px-10 py-5 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-yellow-500/10"
          >
            <Coffee className="w-6 h-6" />
            Buy me a coffee
          </a>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-32 px-6 bg-gradient-to-t from-orange-900/20 to-transparent border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase italic mb-4 tracking-tighter leading-none">
            Prêt pour le <br className="md:hidden" /> coup d'envoi ?
          </h2>
          <p className="text-blue-400 font-bold mb-12 px-8 uppercase italic tracking-wider text-sm md:text-base">
            "Rejoignez des milliers de fans et montrez que votre ferveur n'a pas
            de limite."
          </p>

          <button
            onClick={() => setShowAuth(true)}
            className="bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-sm px-12 py-5 rounded-2xl transition-all shadow-2xl shadow-orange-600/30 hover:scale-105 active:scale-95 w-full md:w-auto"
          >
            Créer mon compte
          </button>
        </div>
      </section>

      <footer className="py-12 border-t border-white/5 text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest bg-black/20">
        © 2026 THEBESTFAN.ONLINE - Tous droits réservés
      </footer>
    </div>
  );
}

function LandingCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 bg-[#151515] border border-white/5 rounded-3xl hover:border-orange-500/30 transition-all group">
      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/5 group-hover:bg-orange-500/10 group-hover:scale-110 transition-all">
        {icon}
      </div>
      <h3 className="text-xl font-black uppercase italic mb-4 text-white group-hover:text-orange-500 transition-colors">
        {title}
      </h3>
      <p className="text-gray-500 font-medium text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function StatItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="text-center group">
      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 text-orange-500 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="text-3xl md:text-4xl font-black text-white mb-1">
        {value}
      </div>
      <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] md:text-[10px]">
        {label}
      </p>
    </div>
  );
}
