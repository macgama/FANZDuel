import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Auth } from "./Auth";
import { Button } from "./Layout";
import { SharedMatchCard } from "./SharedMatchCard";
import { getImageUrl, getOptimizedVideoUrl } from "../lib/utils";
import { footballApi } from "../services/footballApi";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  translateCountryName,
  translateLeagueName,
} from "../utils/countryTranslations";
import { format, isSameDay } from "date-fns";
import { BuyMeACoffee } from "./BuyMeACoffee";
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
  Tv,
  Sparkles,
  RefreshCw,
  TrophyIcon,
} from "lucide-react";

interface LandingPageProps {
  onShowLiveScores?: () => void;
  onMatchSelect?: (id: number) => void;
}

const FALLBACK_FANZ = [
  {
    id: "001",
    name: "Baby Fanzzy",
    description:
      "Le chérubin tout premier supporter de l'arène, muni de sa tétine d'attaque exclusive et de sa poussette supersonique pour dompter les tribunes en chantant.",
  },
  {
    id: "002",
    name: "Fanzzy Lion",
    description:
      "Le roi de l'ambiance par excellence ! Équipé de sa crinière flamboyante et de son mégaphone tonitruant pour rugir de ferveur à chaque but marqué.",
  },
  {
    id: "003",
    name: "Fanzzy Glove",
    description:
      "Le virtuose tactique ! Toujours équipé de gants géants pour amortir les provocations de l'adversaire et lever fièrement les bras en signe de triomphe.",
  },
  {
    id: "004",
    name: "Fanzzy Pyro",
    description:
      "L'artificier pyrotechnique de l'arène ! Ses fumigènes colorés et ses tifos XXL colorent le ciel des tribunes pour créer un enfer de ferveur positive.",
  },
  {
    id: "005",
    name: "Fanzzy Megaphone",
    description:
      "La voix puissante du virage ! Rien ne l'arrête lorsqu'il lance les chants et coordonne les kops de supporters d'un bout à l'autre de la rencontre.",
  },
  {
    id: "011",
    name: "Fanzzy Festival",
    description:
      "L'ambassadrice festive suprême ! Équipée d'un chapeau carnavalesque et de confettis magiques, elle transforme chaque match en fête légendaire inextinguible.",
  },
];

export function LandingPage({
  onShowLiveScores,
  onMatchSelect,
}: LandingPageProps) {
  const [showAuth, setShowAuth] = useState(false);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Real database stats state
  const [supportersCount, setSupportersCount] = useState(0);
  const [duelsTotalCount, setDuelsTotalCount] = useState(0);
  const [duelsActiveCount, setDuelsActiveCount] = useState(0);

  // Random Fanz showcase state
  const [displayedFanz, setDisplayedFanz] = useState<any[]>([]);

  // Load live matches & stats
  const fetchHomepageFixtures = async () => {
    try {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      // Pick up today's fixtures
      const allFixtures = await footballApi.getFixturesByDate(todayStr);
      setFixtures(allFixtures || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching homepage fixtures:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchHomepageFixtures();

    const fetchLandingStats = async () => {
      try {
        const res = await fetch("/api/landing/stats");
        if (res.ok) {
          const data = await res.json();
          setSupportersCount(data.supporters ?? 0);
          setDuelsTotalCount(data.duelsTotal ?? 0);
          setDuelsActiveCount(data.duelsActive ?? 0);
        }
      } catch (err) {
        console.error("Error fetching landing stats:", err);
      }
    };

    const fetchFanzTemplatesShowcase = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "fanz_templates"));
        if (!querySnapshot.empty) {
          const fetched = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as any[];
          const activeTemplates = fetched.filter((t) => t.isActive !== false);
          if (activeTemplates.length > 0) {
            const shuffled = [...activeTemplates].sort(
              () => 0.5 - Math.random(),
            );
            setDisplayedFanz(shuffled.slice(0, 3));
            return;
          }
        }
      } catch (err: any) {
        console.warn(
          "Fanz templates showcase search is pending DB connection (using local high-quality templates instead):",
          err.message || err,
        );
      }

      // Fallback
      const shuffledFallback = [...FALLBACK_FANZ].sort(
        () => 0.5 - Math.random(),
      );
      setDisplayedFanz(shuffledFallback.slice(0, 3));
    };

    fetchLandingStats();
    fetchFanzTemplatesShowcase();

    // Refresh matches every minute
    const intervalMatches = setInterval(() => {
      fetchHomepageFixtures();
    }, 60000);

    // Refresh stats every 30 seconds
    const intervalStats = setInterval(() => {
      fetchLandingStats();
    }, 30000);

    return () => {
      clearInterval(intervalMatches);
      clearInterval(intervalStats);
    };
  }, []);

  // 1. Filter live matches
  const liveFixtures = fixtures.filter((f: any) =>
    ["1H", "2H", "HT", "ET", "P", "BT", "LIVE"].includes(
      f.fixture.status.short,
    ),
  );

  // 2. Filter upcoming matches (NS = Not Started, TBD = To Be Defined/Scheduled)
  const upcomingFixtures = fixtures.filter(
    (f: any) =>
      ["NS", "TBD"].includes(f.fixture.status.short) ||
      (![
        "FT",
        "AET",
        "PEN",
        "1H",
        "2H",
        "HT",
        "ET",
        "P",
        "BT",
        "LIVE",
        "PST",
        "CANC",
        "ABD",
      ].includes(f.fixture.status.short) &&
        new Date(f.fixture.date).getTime() > Date.now()),
  );
  // Sort upcoming fixtures chronologically from nearest to furthest
  upcomingFixtures.sort(
    (a, b) =>
      new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime(),
  );

  // 3. Decide which fixtures list and section header to show
  let displayedFixtures: any[] = [];
  let sectionTitle = "Matchs du Jour (LIVE)";
  let isDisplayingLive = true;

  if (liveFixtures.length > 0) {
    displayedFixtures = liveFixtures;
    sectionTitle = "Matchs en Direct (LIVE)";
    isDisplayingLive = true;
  } else if (upcomingFixtures.length > 0) {
    displayedFixtures = upcomingFixtures;
    sectionTitle = "Matchs à Venir (Bientôt en direct)";
    isDisplayingLive = false;
  } else {
    // Fallback: show any available match of the day if none are live or upcoming
    displayedFixtures = fixtures;
    sectionTitle = "Matchs du Jour (Résultats)";
    isDisplayingLive = false;
  }

  const formattedLiveCount = liveFixtures.length;

  if (showAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col pt-4">
        <div className="px-4 max-w-md mx-auto w-full">
          <Button
            variant="outline"
            onClick={() => setShowAuth(false)}
            className="text-gray-400 hover:text-white mb-4 w-fit"
            id="auth-back-button"
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#111]/80 backdrop-blur-xl border-b border-white/5 px-3 md:px-6 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-6">
            <div
              className="text-xl md:text-2xl font-black italic tracking-tighter text-orange-500 cursor-pointer select-none"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              TBFO
            </div>

            {/* GOOGLE TRANSLATE CONTAINER MOUNTED IN NAVBAR */}
            <div className="flex items-center border-l border-white/10 pl-2 md:pl-6">
              <div
                id="google-translate-landing-container"
                className="h-8 flex items-center min-w-[100px] sm:min-w-[120px] max-w-[160px] overflow-visible rounded-lg"
              />
            </div>
          </div>

          <button
            onClick={() => setShowAuth(true)}
            id="landing-connect-button"
            className="bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-[10px] md:text-xs px-3 py-2 md:px-6 md:py-2.5 rounded-lg transition-all shadow-lg shadow-orange-600/20 active:scale-95 whitespace-nowrap"
          >
            Connexion
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-36 pb-20 px-6 overflow-hidden min-h-screen flex flex-col items-center justify-center">
        {/* Background Decorative Elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none" />
        <img
          src="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-overlay pointer-events-none"
        />

        <div className="max-w-4xl mx-auto text-center relative z-10 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl backdrop-blur-md"
          >
            <Gamepad2 className="w-10 h-10 text-orange-500 animate-pulse" />
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
            className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto"
          >
            <button
              onClick={onShowLiveScores}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-sm px-10 py-4 rounded-xl transition-all shadow-xl shadow-orange-600/25 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 duration-150"
            >
              <Activity className="w-5 h-5 text-white animate-pulse" />
              Scores en direct
            </button>
            <button
              onClick={() => setShowAuth(true)}
              className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-sm px-10 py-4 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95 duration-150"
            >
              <LogIn className="w-5 h-5" />
              Se connecter
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex justify-center"
          >
            <BuyMeACoffee />
          </motion.div>
        </div>

        {/* Floating Assets */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden hidden xl:block z-0">
          <motion.img
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            src={getImageUrl("/fanz/001/imageFanz001Skin000.png")}
            className="absolute top-[20%] left-[5%] w-60 h-60 object-contain opacity-30 drop-shadow-2xl"
          />
          <motion.img
            animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            src={getImageUrl("/fanz/002/imageFanz002Skin000.png")}
            className="absolute top-[25%] right-[5%] w-60 h-60 object-contain opacity-30 drop-shadow-2xl"
          />
        </div>
      </section>

      {/* MATCHS DU JOUR & DIRECT (LIVE) */}
      <section className="py-24 bg-[#161616] relative border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4 px-4 sm:px-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${isDisplayingLive ? "bg-red-500 animate-ping" : "bg-orange-500"}`}
                />
                <span
                  className={`font-bold uppercase tracking-wider text-xs ${isDisplayingLive ? "text-red-500" : "text-orange-500"}`}
                >
                  {isDisplayingLive
                    ? "Mises à jour toutes les minutes"
                    : "Prochainement en direct"}
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">
                {sectionTitle}
              </h2>
            </div>
            <button
              onClick={onShowLiveScores}
              className="w-full md:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase px-6 py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <Tv className="w-4 h-4 text-orange-500" />
              Tous les Scores en direct
            </button>
          </div>

          {loadingMatches ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-44 bg-white/5 rounded-2xl border border-white/5 animate-pulse flex items-center justify-center"
                >
                  <RefreshCw className="w-6 h-6 text-orange-500/40 animate-spin" />
                </div>
              ))}
            </div>
          ) : displayedFixtures.length === 0 ? (
            <div className="p-12 text-center bg-[#0d0d0d] border border-white/5 rounded-2xl mx-4 sm:mx-6">
              <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-bold mb-2 uppercase tracking-wide text-sm">
                Aucun match disponible pour aujourd'hui
              </p>
              <p className="text-xs text-gray-600">
                Revenez plus tard pour voir les résultats des tournois ou
                explorez d'autres zones.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-4">
              <div className="flex flex-nowrap gap-4 px-4 py-2 w-fit items-stretch">
                {displayedFixtures.slice(0, 6).map((match: any) => (
                  <div
                    key={match.fixture.id}
                    className={`snap-center shrink-0 flex items-stretch ${displayedFixtures.length > 1 ? "w-[85vw] sm:w-[360px]" : "w-[calc(100vw-32px)] max-w-[388px]"}`}
                  >
                    <SharedMatchCard
                      match={match}
                      hasActiveDuel={false}
                      onClick={() => onMatchSelect?.(match.fixture.id)}
                      onJoinDuel={() => onMatchSelect?.(match.fixture.id)}
                      onTeamClick={() => {}}
                      profile={null}
                      showLeagueHeader={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* RETROUVEZ LES FANZ - GALERIE MASCOTTES (AFFICHAGE DE 3 FANZ ALÉATOIRES ACTIFS) */}
      <section className="py-24 px-6 relative bg-[#0b0b0b]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase italic mb-2 tracking-tighter">
              Rencontrez les Fanz
            </h2>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs">
              Mascottes officielles de supporters
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {displayedFanz.map((f: any) => (
              <FanzShowcaseCard
                key={f.id}
                id={f.id}
                name={f.name}
                description={f.description || f.shortDescription || ""}
              />
            ))}
          </div>
        </div>
      </section>

      {/* L'EXPÉRIENCE ULTIME */}
      <section className="py-24 px-6 bg-[#0c0c0c] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase italic mb-2 tracking-tighter">
              L'expérience Ultime
            </h2>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs md:text-sm">
              Vivez votre passion comme jamais
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <LandingCard
              icon={
                <Swords className="w-6 h-6 text-orange-500 animate-pulse" />
              }
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

      {/* TUTORIELS */}
      <section className="py-24 px-6 bg-[#0a0a0a] relative border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase italic mb-2 tracking-tighter">
              Le Guide MrFanz
            </h2>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs md:text-sm">
              Apprenez les bases pour devenir le Meilleur Fan
            </p>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-4 pb-8 snap-x snap-mandatory">
            {[1, 2, 3, 4, 5].map((num) => (
              <div
                key={num}
                className="w-[240px] md:w-[280px] shrink-0 aspect-[9/16] bg-black border border-white/10 rounded-2xl overflow-hidden snap-center relative shadow-2xl"
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
      </section>

      {/* L'ARÈNE EN CHIFFRES */}
      <section className="py-24 px-6 border-y border-white/5 bg-[#101010]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black uppercase italic mb-2 tracking-tighter">
              L'arène en chiffres
            </h2>
            <p className="text-gray-500 font-bold tracking-widest text-xs">
              Une communauté active et engagée à chaque seconde.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            <StatItem
              icon={<Users className="w-6 h-6 text-blue-500" />}
              value={supportersCount.toLocaleString("fr-FR")}
              label="Supporters"
            />
            <StatItem
              icon={<Trophy className="w-6 h-6 text-yellow-500" />}
              value={duelsTotalCount.toLocaleString("fr-FR")}
              label="Duels Joués"
            />
            <StatItem
              icon={<Activity className="w-6 h-6 animate-pulse text-red-500" />}
              value={formattedLiveCount.toString()}
              label="Matchs Live"
            />
            <StatItem
              icon={<Swords className="w-6 h-6 text-orange-500" />}
              value={duelsActiveCount.toLocaleString("fr-FR")}
              label="Duels Actifs"
            />
          </div>
        </div>
      </section>

      {/* BETA VERSION & COFFEE */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center">
        <div className="bg-orange-950/20 border border-orange-500/20 rounded-3xl overflow-hidden mb-12 shadow-2xl">
          <div className="bg-orange-500/10 px-4 py-3 flex items-center justify-center gap-2 border-b border-orange-500/20 font-black uppercase text-[10px] tracking-widest text-orange-500">
            <AlertCircle className="w-4 h-4 animate-bounce" />
            Version Bêta
          </div>
          <div className="p-8 italic font-bold text-gray-400 leading-relaxed md:text-lg">
            "L'application est actuellement en phase de test. Des mises à jour
            et des ajustements techniques peuvent avoir lieu avant la version
            1.0."
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-24 px-6 bg-gradient-to-t from-orange-900/15 to-transparent border-t border-white/5">
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

function FanzShowcaseCard({
  id,
  name,
  description,
}: {
  id: string;
  name: string;
  description: string;
}) {
  const [hovered, setHovered] = useState(false);
  const cleanId = id.replace("fanz-", "");
  const videoPath = `/fanz/${cleanId}/videoFanz${cleanId}Skin000.mp4`;
  const imagePath = `/fanz/${cleanId}/imageFanz${cleanId}Skin000.png`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="p-5 bg-[#141414] border border-white/5 hover:border-orange-500/40 rounded-3xl transition-all duration-300 flex flex-col justify-between overflow-hidden relative group"
    >
      {/* Media Box */}
      <div className="w-full aspect-square bg-[#0c0c0c] rounded-2xl overflow-hidden mb-5 border border-white/5 relative flex items-center justify-center">
        {/* Loop playing muted optimized video */}
        <video
          src={getOptimizedVideoUrl(videoPath)}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${hovered ? "opacity-100" : "opacity-0"}`}
          autoPlay
          loop
          muted
          playsInline
        />

        {/* Standard high quality portrait image */}
        <img
          src={getImageUrl(imagePath)}
          alt={name}
          className={`w-[85%] h-[85%] object-contain transition-transform duration-500 group-hover:scale-105 ${hovered ? "opacity-0" : "opacity-100"}`}
          referrerPolicy="no-referrer"
        />

        {/* Interactive Play Loop indicator */}
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md text-[8px] font-black tracking-widest uppercase text-orange-500 px-2 py-1 rounded border border-white/5 flex items-center gap-1">
          <Play className="w-2.4 h-2.4 fill-orange-500 stroke-0 shrink-0" />
          <span>{hovered ? "Animation active" : "Survoler"}</span>
        </div>
      </div>

      {/* Info Block */}
      <div>
        <div className="flex items-center mb-2">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-white group-hover:text-orange-500 transition-colors">
            {name}
          </h3>
        </div>
        <p className="text-gray-500 font-medium text-xs leading-relaxed mb-4 min-h-[50px]">
          {description}
        </p>
      </div>
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
