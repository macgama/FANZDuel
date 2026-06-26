import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  collection,
  where,
  writeBatch,
  getDocs,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { Layout, Card, Button } from "./components/Layout";
import { cn, safeLocalStorage, safeSessionStorage } from "./lib/utils";
import { Auth } from "./components/Auth";
import { ResetPassword } from "./components/ResetPassword";
import { AdminZone } from "./components/AdminZone";
import { MatchesPage } from "./components/MatchesPage";
import { CompetitionsPage } from "./components/CompetitionsPage";
import { TeamsPage } from "./components/TeamsPage";
import { Header } from "./components/Header";
import { MatchDetails } from "./components/MatchDetails";
import { LeagueDetails } from "./components/LeagueDetails";
import { TeamDetails } from "./components/TeamDetails";
import { UserProfile, GlobalFervorConfig, FanzStats } from "./types";
import { FanzPage } from "./components/FanzPage";
import { FanzDetails } from "./components/FanzDetails";
import { LifeActionCard } from "./components/LifeActionCard";
import { WeeklyStreakModal } from "./components/WeeklyStreakModal";
import { WaitingRoom } from "./components/WaitingRoom";
import { SocialPage } from "./components/SocialPage";
import { FervorPathPage } from "./components/FervorPathPage";
import { FavoriteTeamsPage } from "./components/FavoriteTeamsPage";
import { LeaderboardPage } from "./components/LeaderboardPage";
import { Rankings } from "./components/Rankings";
import { PassPage } from "./components/PassPage";
import { MissionsPage } from "./components/MissionsPage";
import { format } from "date-fns";
import { logTransaction } from "./services/transactionService";
import { progressMission } from "./services/missionService";
import { useAlert, Reward } from "./context/AlertContext";
import { useLanguage } from "./context/LanguageContext";
import { LanguageSelector } from "./components/LanguageSelector";
import { footballApi } from "./services/footballApi";
import {
  Trophy,
  Activity,
  Database,
  Globe,
  ChevronRight,
  Users,
  Star,
  X,
  LogOut,
  Settings,
  Menu,
  Swords,
  Store,
  Target,
  Ticket,
  Medal,
  Home as HomeIcon,
  AlertCircle,
  LayoutGrid,
  Layers,
  Briefcase,
  Search,
  Calendar,
  Sparkles,
  Wallet,
  BarChart2,
  PieChart,
  Flame,
  Gift,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { signOut } from "firebase/auth";

import { AlertProvider } from "./context/AlertContext";
import { RewardProvider } from "./context/RewardContext";
import { SocketProvider, useSocket } from "./context/SocketContext";
import { MediaViewerProvider } from "./context/MediaViewerContext";
import { GlobalSocketListener } from "./components/GlobalSocketListener";

import { Home } from "./components/Home";
import { ShopPage } from "./components/ShopPage";

import { TransactionsPage } from "./components/TransactionsPage";
import { generateFervorPath } from "./utils/fervorPath";
import { StatsPage } from "./components/StatsPage";
import { PlayerDetails } from "./components/PlayerDetails";
import { Preloader } from "./components/Preloader";
import { LandingPage } from "./components/LandingPage";
import { MrFanzPage } from "./components/MrFanzPage";
import { MrFanzHelp } from "./components/MrFanzHelp";
import { CollectionPage } from "./components/CollectionPage";
import { CommercialAlertOverlay } from "./components/CommercialAlertOverlay";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import { DidacticielBanner } from "./components/DidacticielBanner";

export default function App() {
  return (
    <MediaViewerProvider>
      <AppContent />
    </MediaViewerProvider>
  );
}

import { audioManager } from "./lib/audio";

type ViewType =
  | "home"
  | "admin"
  | "matches"
  | "competitions"
  | "teams"
  | "fanz"
  | "collection"
  | "transactions"
  | "waiting-room"
  | "social"
  | "fervor-path"
  | "shop"
  | "missions"
  | "pass"
  | "duel"
  | "favorite-teams"
  | "leaderboard"
  | "rankings"
  | "stats"
  | "mrfanz";

function AppContent() {
  const { t, language: appLanguage, setLanguage: setAppLanguage } = useLanguage();
  const { socket } = useSocket();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = React.useRef(true);
  const currentUserRef = React.useRef<string | null>(null);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [currentDuel, setCurrentDuel] = useState<any>(null);
  const [guestView, setGuestView] = useState<"landing" | "matches">("landing");
  const [resetCode, setResetCode] = useState<string | null>(null);
  const [onlineUsersCount, setOnlineUsersCount] = useState<number>(1);
  const [initialInvitedFriend, setInitialInvitedFriend] = useState<UserProfile | null>(null);
  const [initialPrivateDuel, setInitialPrivateDuel] = useState<boolean>(false);

  // Register user socket connection when profile / socket is ready
  useEffect(() => {
    if (socket && profile?.uid) {
      const safeProfile = {
        uid: profile.uid,
        pseudo: profile.pseudo,
        displayName: profile.displayName,
        level: profile.level,
        favoriteTeams: profile.favoriteTeams,
        photoURL: profile.photoURL,
        friends: profile.friends,
        friendRequests: profile.friendRequests
      };
      socket.emit("register-user", { uid: profile.uid, profile: safeProfile });
      console.log(`[Client] Registered socket for user: ${profile.uid}`);
    }
  }, [socket, profile?.uid, profile?.pseudo, profile?.displayName, profile?.level, profile?.photoURL]);

  // Listen to live online users count updates
  useEffect(() => {
    if (!socket) return;
    const handleOnlineCount = (data: { count: number }) => {
      if (data && typeof data.count === 'number') {
        setOnlineUsersCount(data.count);
      }
    };
    socket.on("online-users-count", handleOnlineCount);
    return () => {
      socket.off("online-users-count", handleOnlineCount);
    };
  }, [socket]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");
    if (mode === "resetPassword" && oobCode) {
      setResetCode(oobCode);
    }
  }, []);

  useEffect(() => {
    // Prevent the mobile back button from exiting the app
    window.history.pushState(null, "", window.location.href);
    const handlePopState = (event: PopStateEvent) => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (profile !== null) {
      audioManager.setMuted(profile.isMuted || false);
    }
  }, [profile?.isMuted]);

  useEffect(() => {
    const handleInteraction = () => {
      audioManager.playBGM();
    };
    window.addEventListener("click", handleInteraction, { once: true });
    window.addEventListener("touchstart", handleInteraction, { once: true });
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  const [view, _setView] = useState<ViewType>("home");
  const viewHistory = React.useRef<ViewType[]>(["home"]);

  const restorationAttempted = React.useRef(false);

  const setView = (newView: ViewType) => {
    if (newView !== view) {
      viewHistory.current.push(newView);
      _setView(newView);
      // Reset some states when navigating away from specific views
      if (newView === "home") {
        setSelectedMatchId(null);
        setSelectedLeague(null);
        setSelectedTeam(null);
        setSelectedFanzId(null);
        setSelectedPlayer(null);
        setJoiningDuel(null);
        setIsDuelActive(false);
        safeLocalStorage.removeItem("tbfo_current_duel");
      }
    }
  };



  const [selectedLeague, setSelectedLeague] = useState<{
    id: number;
    season: number;
  } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{
    id: number;
    season?: number;
  } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    id: number;
    season: number;
  } | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedMatchTab, setSelectedMatchTab] = useState<
    "summary" | "lineups" | "stats" | "duels"
  >("summary");
  const [selectedFanzId, setSelectedFanzId] = useState<string | null>(null);
  const [selectedFanzTab, setSelectedFanzTab] = useState<
    | "infos"
    | "stats"
    | "cards"
    | "skins"
    | "emotes"
    | "rank"
    | "ferveur"
    | undefined
  >();
  const [isDuelActive, setIsDuelActive] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [joiningDuel, setJoiningDuel] = useState<{
    id: string;
    type: string;
    matchId: number;
  } | null>(null);
  const [waitingDuelsCount, setWaitingDuelsCount] = useState(0);
  const [unreadSocialCount, setUnreadSocialCount] = useState(0);
  const [hasLiveFavoriteMatch, setHasLiveFavoriteMatch] = useState(false);
  const [unseenMuseumCount, setUnseenMuseumCount] = useState<number>(0);
  const [hasNewMuseumHeuristic, setHasNewMuseumHeuristic] = useState(false);
  const hasNewMuseumItems = unseenMuseumCount > 0 || hasNewMuseumHeuristic;

  useEffect(() => {
    if (user?.uid) {
      try {
        const stored = localStorage.getItem(`museum_unseen_count_${user.uid}`);
        setUnseenMuseumCount(stored ? parseInt(stored, 10) : 0);
      } catch (e) {
        console.error(e);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    const handleUnseenChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setUnseenMuseumCount(customEvent.detail || 0);
    };
    window.addEventListener("museum-unseen-changed", handleUnseenChange);
    return () => window.removeEventListener("museum-unseen-changed", handleUnseenChange);
  }, []);

  const [userFanzCount, setUserFanzCount] = useState(0);
  const [activeMissionIds, setActiveMissionIds] = useState<string[]>([]);
  const [claimableAlerts, setClaimableAlerts] = useState({
    missions: false,
    globalFervor: false,
    fanzFervor: false,
  });

  const [dismissedFervorAlert, setDismissedFervorAlert] = useState(false);
  const prevGlobalFervorRef = useRef(false);
  const prevFanzFervorRef = useRef(false);

  useEffect(() => {
    if (
      (claimableAlerts.globalFervor && !prevGlobalFervorRef.current) ||
      (claimableAlerts.fanzFervor && !prevFanzFervorRef.current)
    ) {
      setDismissedFervorAlert(false);
    }
    prevGlobalFervorRef.current = claimableAlerts.globalFervor;
    prevFanzFervorRef.current = claimableAlerts.fanzFervor;
  }, [claimableAlerts.globalFervor, claimableAlerts.fanzFervor]);

  // We need to store profile in a ref for use inside listeners without triggering re-runs
  const profileRef = React.useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Recalculer les alertes de missions en cas de changement de profil ou de liste de missions actives
  useEffect(() => {
    if (!profile) {
      setClaimableAlerts((prev) => ({ ...prev, missions: false }));
      return;
    }
    const hasMissionsAlert = activeMissionIds.some((mId) => {
      const p = profile?.missionsProgress?.[mId];
      return p?.isCompleted && !p?.isClaimed;
    });
    setClaimableAlerts((prev) => ({ ...prev, missions: hasMissionsAlert }));
  }, [profile, activeMissionIds]);

  // Empêcher le rechargement de page et la navigation accidentelle uniquement pendant un duel
  useEffect(() => {
    // Only block reload/leave if the user is actively in a duel match
    const inActiveMatch = isDuelActive || view === "duel";

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (inActiveMatch) {
        e.preventDefault();
        e.returnValue = ""; // Modern browsers ignore custom messages
        return e.returnValue;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (inActiveMatch) {
        // Bloquer F5 ou Ctrl+R / Cmd+R raccourcis de rafraîchissement
        if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key === "r")) {
          e.preventDefault();
          console.warn("Rafraîchissement bloqué : session de jeu active !");
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDuelActive, view]);

  // Compute claimable states for sidebar dots
  useEffect(() => {
    if (!profile?.uid) return;

    let isMounted = true;

    const unMissions = onSnapshot(
      query(collection(db, "missions"), where("isActive", "==", true)),
      (snap) => {
        if (!isMounted) return;
        const activeIds = snap.docs.map((d) => d.id);
        setActiveMissionIds(activeIds);
      },
      () => {},
    );

    let lastGlobalConfig: any = null;

    const unGlobalFervor = onSnapshot(
      doc(db, "global_configs", "fanz_fervor"),
      (snap) => {
        if (!isMounted || !snap.exists()) return;
        const config = snap.data();
        lastGlobalConfig = config;
        const currentPoints = profileRef.current?.ferveurPoints || 0;
        const path = generateFervorPath(
          currentPoints + 5000,
          config as GlobalFervorConfig,
        );
        const hasGlobalFervorAlert = path.some((level) => {
          const slotId = `ferveur-level-${level.level}`;
          return (
            currentPoints >= level.pointsRequired &&
            !profileRef.current?.claimedFervorRewards?.includes(slotId)
          );
        });
        setClaimableAlerts((prev) => ({
          ...prev,
          globalFervor: hasGlobalFervorAlert,
        }));
      },
      () => {},
    );

    const unFanz = onSnapshot(
      query(collection(db, "fanz"), where("ownerUid", "==", profile.uid)),
      async (snap) => {
        if (!isMounted) return;
        const fanzList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Load templates to get specific mappings if needed, but we can just use generateFervorPath with either fanz config or global config
        try {
          const templatesSnap = await getDocs(collection(db, "fanz_templates"));
          const templatesList = templatesSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          // Compute total energy bonus from equipped skins
          let totalSkinEnergyBonus = 0;
          fanzList.forEach((fanz: any) => {
            if (fanz.equippedSkin) {
              const tpl: any = templatesList.find(
                (t) => t.id === fanz.templateId,
              );
              if (tpl && tpl.skins) {
                const skin = tpl.skins.find(
                  (s: any) => s.id === fanz.equippedSkin,
                );
                if (skin && skin.energyBonus) {
                  totalSkinEnergyBonus += skin.energyBonus;
                }
              }
            }
          });
          // Always update db so profile is in sync, App logic will pick it up
          if (
            (profileRef.current?.skinEnergyBonus || 0) !== totalSkinEnergyBonus
          ) {
            updateDoc(doc(db, "users", profileRef.current!.uid), {
              skinEnergyBonus: totalSkinEnergyBonus,
            }).catch(console.error);
          }

          const hasFanzFervorAlert = fanzList.some((fanz: any) => {
            const currentPts = fanz.ferveurPoints || 0;
            const template: any = templatesList.find(
              (t) => t.id === fanz.templateId,
            );
            let path: any[] = [];
            if (template?.ferveurPath && template.ferveurPath.length > 0)
              path = template.ferveurPath;
            else if (
              (fanz as any)?.ferveurPath &&
              (fanz as any).ferveurPath.length > 0
            )
              path = (fanz as any).ferveurPath;
            else if (lastGlobalConfig)
              path = generateFervorPath(
                Math.max(150000, currentPts + 5000),
                lastGlobalConfig,
              );

            return path.some((step: any) => {
              const slotId = step.isIntermediate
                ? `ferveur-inter-${step.id || step.pointsRequired}`
                : `ferveur-level-${step.level}`;
              return (
                currentPts >= step.pointsRequired &&
                !fanz.claimedRewards?.includes(slotId)
              );
            });
          });

          if (isMounted) {
            setClaimableAlerts((prev) => ({
              ...prev,
              fanzFervor: hasFanzFervorAlert,
            }));
          }
        } catch (err) {
          // Handle error silently
        }
      },
      () => {},
    );

    return () => {
      isMounted = false;
      unMissions();
      unGlobalFervor();
      unFanz();
    };
  }, [profile?.uid]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [hasFavoriteMatchToday, setHasFavoriteMatchToday] = useState(false);

  // Check for favorite team matches today
  useEffect(() => {
    if (!profile?.favoriteTeams?.length) {
      setHasFavoriteMatchToday(false);
      return;
    }

    const checkFavoriteMatches = async () => {
      try {
        const today = format(new Date(), "yyyy-MM-dd");
        const fixtures = await footballApi.getFixturesByDate(today);
        const favoriteIds = profile.favoriteTeams.map((id) => id.toString());

        const hasMatch = fixtures.some(
          (f: any) =>
            favoriteIds.includes(f.teams.home.id.toString()) ||
            favoriteIds.includes(f.teams.away.id.toString()),
        );

        setHasFavoriteMatchToday(hasMatch);
      } catch (err) {
        console.error("Failed to check favorite matches:", err);
      }
    };

    checkFavoriteMatches();
    // Re-check every hour
    const interval = setInterval(checkFavoriteMatches, 3600000);
    return () => clearInterval(interval);
  }, [profile?.favoriteTeams]);

  const [showActiveActionModal, setShowActiveActionModal] = useState(false);
  const [activeActionDetails, setActiveActionDetails] = useState<any>(null);
  const [activeFanz, setActiveFanz] = useState<any>(null);
  const [activeFanzTemplate, setActiveFanzTemplate] = useState<any>(null);
  const { showAlert } = useAlert();
  const isCompletingGlobally = useRef(false);

  // Handle invite links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode && profile && !restorationAttempted.current) {
      // Clear the query param so it doesn't try to join again on refresh
      window.history.replaceState({}, document.title, window.location.pathname);

      const tryJoin = async () => {
        try {
          const cleanCode = joinCode.trim().toUpperCase();
          const response = await fetch(`/api/duels/code/${cleanCode}`);
          if (response.ok) {
            const duel = await response.json();
            if (duel && duel.id) {
              setJoiningDuel({
                id: duel.id,
                type: duel.type,
                matchId: duel.matchId,
              });
              setSelectedMatchId(duel.matchId);
              setView("matches");
              setIsDuelActive(true);
            }
          }
        } catch (err) {
          console.error("Failed to auto-join from URL", err);
        }
      };
      tryJoin();
    }
  }, [profile]);

  // Persistence: Restore duel on refresh
  useEffect(() => {
    if (profile && !isDuelActive && !restorationAttempted.current) {
      const savedDuel = safeLocalStorage.getItem("tbfo_current_duel");
      if (savedDuel) {
        try {
          const duelData = JSON.parse(savedDuel);
          console.log("[App] Restoring duel from persistence:", duelData);
          setJoiningDuel(duelData);
          setSelectedMatchId(duelData.matchId);
          setSelectedMatchTab("summary");
          setView("matches");
          setIsDuelActive(true);
        } catch (e) {
          console.error("Failed to restore duel:", e);
          safeLocalStorage.removeItem("tbfo_current_duel");
        }
      }
      restorationAttempted.current = true;
    }
  }, [profile, isDuelActive]);

  useEffect(() => {
    if (showActiveActionModal && !profile?.activeAction) {
      setShowActiveActionModal(false);
    }
  }, [profile?.activeAction, showActiveActionModal]);

  // 1. Fetch details of active action, fanz, and template whenever there is an active action
  useEffect(() => {
    if (profile?.activeAction) {
      const { actionId, fanzId } = profile.activeAction;
      let isSubscribed = true;

      const loadAllDetails = async () => {
        try {
          const actionDoc = await getDoc(doc(db, "life_actions", actionId));
          if (!isSubscribed) return;
          const actionData = actionDoc.exists()
            ? { id: actionDoc.id, ...actionDoc.data() }
            : null;

          const fanzDoc = await getDoc(doc(db, "fanz", fanzId));
          if (!isSubscribed) return;
          const fanzData = fanzDoc.exists()
            ? { id: fanzDoc.id, ...fanzDoc.data() }
            : null;

          let templateData = null;
          if (fanzData) {
            const templateDoc = await getDoc(
              doc(db, "fanz_templates", (fanzData as any).templateId),
            );
            if (!isSubscribed) return;
            templateData = templateDoc.exists()
              ? { id: templateDoc.id, ...templateDoc.data() }
              : null;
          }

          if (isSubscribed) {
            setActiveActionDetails(actionData);
            setActiveFanz(fanzData);
            setActiveFanzTemplate(templateData);
          }
        } catch (err) {
          console.error("Error auto-loading active action details:", err);
        }
      };

      loadAllDetails();
      return () => {
        isSubscribed = false;
      };
    } else {
      setActiveActionDetails(null);
      setActiveFanz(null);
      setActiveFanzTemplate(null);
    }
  }, [profile?.activeAction?.actionId, profile?.activeAction?.fanzId]);

  // 2. Global Timer & Action Autocompleter
  useEffect(() => {
    if (!profile?.activeAction || !activeActionDetails || !activeFanz) {
      return;
    }

    const { startTime, durationMinutes } = profile.activeAction;

    const checkAndComplete = async () => {
      const startMs = new Date(startTime).getTime();
      const endMs = startMs + durationMinutes * 1000;
      const nowMs = Date.now();

      if (nowMs >= endMs && !isCompletingGlobally.current) {
        isCompletingGlobally.current = true;
        try {
          const userRef = doc(db, "users", profile.uid);
          const fanzRef = doc(db, "fanz", activeFanz.id);

          const action = activeActionDetails;
          const fanz = activeFanz;
          const fanzTemplate = activeFanzTemplate;

          let resolvedImage = action.image;
          let resolvedVideoUrl = action.videoUrl;
          if (
            fanz.equippedSkin &&
            action.skinOverrides &&
            action.skinOverrides[fanz.equippedSkin]
          ) {
            const override = action.skinOverrides[fanz.equippedSkin];
            if (override.image) resolvedImage = override.image;
            if (override.videoUrl) resolvedVideoUrl = override.videoUrl;
          }

          let moneyBonusMod = 0;
          let gemsBonusMod = 0;
          let boostBonusMod = 0;
          let energyCostReduction = 0;
          let moneyCostReduction = 0;
          let gemsCostReduction = 0;
          let boostCostReduction = 0;
          if (fanzTemplate && fanz.equippedSkin) {
            const skin = (fanzTemplate.skins || []).find(
              (s: any) => s.id === fanz.equippedSkin,
            );
            if (skin) {
              moneyBonusMod = skin.moneyBonus || 0;
              gemsBonusMod = skin.gemsBonus || 0;
              boostBonusMod = skin.boostBonus || 0;
              energyCostReduction = skin.energyCostReduction || 0;
              moneyCostReduction = skin.moneyCostReduction || 0;
              gemsCostReduction = skin.gemsCostReduction || 0;
              boostCostReduction = skin.boostCostReduction || 0;
            }
          }

          const actionProgress = fanz.lifeActionProgress?.[action.id] || {
            level: 1,
            xp: 0,
          };
          const currentLevel = actionProgress.level;
          const scaleFactor = 1 + (currentLevel - 1) * 0.2;

          const now = new Date();
          const isXpBoostActive =
            profile.boostXpUntil && new Date(profile.boostXpUntil) > now;

          const gainEnergy = Math.floor((action.energyGain || 0) * scaleFactor);
          const gainMoney = Math.floor(
            (action.moneyGain || 0) * scaleFactor * (1 + moneyBonusMod / 100),
          );
          const gainGems = Math.floor(
            (action.gemsGain || 0) * scaleFactor * (1 + gemsBonusMod / 100),
          );
          const gainBoost = Math.floor(
            (action.boostGain || 0) * scaleFactor * (1 + boostBonusMod / 100),
          );
          const gainXp = Math.floor((action.xpGain || 0) * scaleFactor);

          const unlockedActions = profile.unlockedActions || [];
          const skinSpecificActionId =
            action.id + "-" + (fanz.equippedSkin || "000");
          let newUnlockedActions = [...unlockedActions];
          if (!newUnlockedActions.includes(skinSpecificActionId)) {
            newUnlockedActions.push(skinSpecificActionId);
          }
          if (!fanz.equippedSkin || fanz.equippedSkin === "000") {
            if (!newUnlockedActions.includes(action.id)) {
              newUnlockedActions.push(action.id);
            }
          }

          // 1. Update User DB
          await updateDoc(userRef, {
            energy: Math.min(100, (profile.energy || 0) + gainEnergy),
            money: (profile.money || 0) + gainMoney,
            gems: (profile.gems || 0) + gainGems,
            boostPoints: (profile.boostPoints || 0) + gainBoost,
            activeAction: deleteField(),
            unlockedActions: newUnlockedActions,
          });

          // 2. Log transactions
          if (gainEnergy > 0)
            await logTransaction(
              profile.uid,
              "energy",
              gainEnergy,
              `Fin action: ${action.name}`,
            );
          if (gainMoney > 0)
            await logTransaction(
              profile.uid,
              "money",
              gainMoney,
              `Fin action: ${action.name}`,
            );
          if (gainGems > 0)
            await logTransaction(
              profile.uid,
              "gems",
              gainGems,
              `Fin action: ${action.name}`,
            );
          if (gainBoost > 0)
            await logTransaction(
              profile.uid,
              "boost",
              gainBoost,
              `Fin action: ${action.name}`,
            );

          await progressMission(profile, "life_action", 1);

          // 3. Update Fanz DB
          const newActionXp = actionProgress.xp + 10;
          let newActionLevel = actionProgress.level;
          const hasLeveledUp = newActionXp >= newActionLevel * 50;
          if (hasLeveledUp) {
            newActionLevel += 1;
          }

          const newFanzStats: any = { ...fanz.stats };
          const xpMultiplier = isXpBoostActive ? 2 : 1;
          if (action.targetStat) {
            newFanzStats[action.targetStat] =
              (newFanzStats[action.targetStat] || 0) + gainXp * xpMultiplier;
          }
          if (action.xpGains) {
            Object.entries(action.xpGains).forEach(([stat, gain]) => {
              if (gain) {
                newFanzStats[stat] =
                  (newFanzStats[stat] || 0) +
                  Math.floor((gain as number) * scaleFactor * xpMultiplier);
              }
            });
          }

          await updateDoc(fanzRef, {
            stats: newFanzStats,
            [`lifeActionProgress.${action.id}`]: {
              level: newActionLevel,
              xp: newActionXp,
            },
          });

          // 4. Show success reward alert
          const rewards: Reward[] = [];
          if (gainEnergy > 0)
            rewards.push({
              type: "energy",
              amount: gainEnergy,
              label: "Énergie",
            });
          if (gainMoney > 0)
            rewards.push({ type: "money", amount: gainMoney, label: "Argent" });
          if (gainGems > 0)
            rewards.push({ type: "gems", amount: gainGems, label: "Gemmes" });
          if (gainBoost > 0)
            rewards.push({ type: "boost", amount: gainBoost, label: "Boost" });

          if (action.targetStat && gainXp > 0) {
            const xpAmount = gainXp * (isXpBoostActive ? 2 : 1);
            rewards.push({
              type: "xp",
              amount: xpAmount,
              label: `XP ${action.targetStat}${isXpBoostActive ? " (x2)" : ""}`,
              stat: action.targetStat,
            });
          }

          if (action.xpGains) {
            Object.entries(action.xpGains).forEach(([stat, gain]) => {
              if (gain) {
                const xpAmount = Math.floor(
                  (gain as number) * scaleFactor * (isXpBoostActive ? 2 : 1),
                );
                rewards.push({
                  type: "xp",
                  amount: xpAmount,
                  label: `XP ${stat}${isXpBoostActive ? " (x2)" : ""}`,
                  stat,
                });
              }
            });
          }

          showAlert({
            title: action.name,
            subtitle: hasLeveledUp
              ? `Niveau ${newActionLevel} débloqué !`
              : "Activité terminée !",
            videoUrl: resolvedVideoUrl,
            imageUrl: resolvedImage,
            rewards,
            type: hasLeveledUp ? "level-up" : "success",
          });
        } catch (error) {
          console.error("Error completing active action globally:", error);
        } finally {
          isCompletingGlobally.current = false;
        }
      }
    };

    const interval = setInterval(checkAndComplete, 1000);
    return () => clearInterval(interval);
  }, [
    profile?.activeAction?.startTime,
    profile?.activeAction?.durationMinutes,
    activeActionDetails,
    activeFanz,
    activeFanzTemplate,
  ]);

  useEffect(() => {
    if (!user) return;

    const fetchWaitingDuels = async (retries = 3) => {
      try {
        const res = await fetch("/api/duels", {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const duels = await res.json();
            // Filter out duels where the current user is already a participant
            const waitingCount = duels.filter(
              (d: any) => !d.participants.find((p: any) => p.uid === user.uid),
            ).length;
            setWaitingDuelsCount(waitingCount);
          } else {
            console.warn("Expected JSON from /api/duels, got", contentType);
          }
        } else if (retries > 0) {
          setTimeout(() => fetchWaitingDuels(retries - 1), 2000);
        }
      } catch (err: any) {
        if (err?.message !== "Failed to fetch") {
          console.error("Failed to fetch waiting duels", err);
        }
        if (retries > 0) {
          setTimeout(() => fetchWaitingDuels(retries - 1), 2000);
        }
      }
    };

    fetchWaitingDuels();
    const interval = setInterval(fetchWaitingDuels, 15000); // Reduce frequency to 15s
    return () => clearInterval(interval);
  }, [user]);

  // Social Notifications (Messages & Requests)
  useEffect(() => {
    if (!user?.uid) return;

    // Listen for chats with unread messages
    const chatsQ = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
    );
    const unsubscribeChats = onSnapshot(
      chatsQ,
      (snapshot) => {
        let totalUnread = 0;
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          totalUnread += data.unreadCount?.[user.uid] || 0;
        });

        // Also add friend requests count from profile
        const requestsCount = profile?.friendRequests?.length || 0;
        setUnreadSocialCount(totalUnread + requestsCount);
      },
      (error) => {
        console.error("Chats snapshot listener error:", error);
      },
    );

    return () => unsubscribeChats();
  }, [user?.uid, profile?.friendRequests?.length]);

  // Track live favorite teams
  useEffect(() => {
    if (!profile?.favoriteTeams || profile.favoriteTeams.length === 0) {
      setHasLiveFavoriteMatch(false);
      return;
    }

    const fetchLiveTeams = async () => {
      try {
        const liveFixtures = await footballApi.getLiveFixtures();
        const liveTeamIds = new Set<string>();
        liveFixtures.forEach((f: any) => {
          liveTeamIds.add(f.teams.home.id.toString());
          liveTeamIds.add(f.teams.away.id.toString());
        });

        const hasLive = profile.favoriteTeams.some((teamId) =>
          liveTeamIds.has(teamId.split("_")[0]),
        );
        setHasLiveFavoriteMatch(hasLive);
      } catch (err: any) {
        if (err?.message?.includes("Failed to fetch")) {
          // Ignore normal network disconnection errors during periodic fetching
          return;
        }
        console.error("Failed to check live favorite matches", err);
      }
    };

    fetchLiveTeams();
    const interval = setInterval(fetchLiveTeams, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [profile?.favoriteTeams]);

  // Track user fanz for new museum items
  useEffect(() => {
    if (!user?.uid) return;
    const unFanz = onSnapshot(
      query(collection(db, "fanz"), where("ownerUid", "==", user.uid)),
      (snap) => {
        setUserFanzCount(snap.docs.length);
      },
    );
    return () => unFanz();
  }, [user?.uid]);

  // Computed new museum items (comparing current loaded count + arrays with local storage)
  useEffect(() => {
    if (!profile || !user?.uid) return;

    // Total items in museum
    const totalItems =
      (profile.cards?.length || 0) +
      (profile.skins?.length || 0) +
      (profile.emotes?.length || 0) +
      (profile.unlockedActions?.length || 0) +
      userFanzCount;

    const lastSeenCount = parseInt(
      localStorage.getItem(`museum_last_count_${user.uid}`) || "0",
      10,
    );

    if (view === "collection") {
      localStorage.setItem(
        `museum_last_count_${user.uid}`,
        totalItems.toString(),
      );
      setHasNewMuseumHeuristic(false);
    } else if (totalItems > lastSeenCount) {
      setHasNewMuseumHeuristic(true);
    } else {
      setHasNewMuseumHeuristic(false);
    }
  }, [
    profile?.cards,
    profile?.skins,
    profile?.emotes,
    profile?.unlockedActions,
    userFanzCount,
    view,
    user?.uid,
  ]);

  const handleDuelIntent = async (callback: () => void) => {
    if (profile?.activeAction) {
      try {
        const actionDoc = await getDoc(
          doc(db, "life_actions", profile.activeAction.actionId),
        );
        const fanzDoc = await getDoc(
          doc(db, "fanz", profile.activeAction.fanzId),
        );
        if (actionDoc.exists() && fanzDoc.exists()) {
          setActiveActionDetails({ id: actionDoc.id, ...actionDoc.data() });
          setActiveFanz({ id: fanzDoc.id, ...fanzDoc.data() });
          setShowActiveActionModal(true);
        } else {
          callback();
        }
      } catch (err) {
        console.error("Failed to fetch active action details:", err);
        callback();
      }
    } else {
      callback();
    }
  };

  const handleBack = () => {
    if (selectedMatchId) {
      setSelectedMatchId(null);
      setSelectedMatchTab("summary");
      setJoiningDuel(null);
    } else if (selectedTeam) {
      setSelectedTeam(null);
    } else if (selectedLeague) {
      setSelectedLeague(null);
    } else if (selectedFanzId) {
      setSelectedFanzId(null);
      setSelectedPlayer(null);
    } else if (viewHistory.current.length > 1) {
      viewHistory.current.pop();
      const previousView = viewHistory.current[viewHistory.current.length - 1];
      _setView(previousView);
    } else if (view !== "home") {
      _setView("home");
    }
  };

  const renderFooter = () => {
    if (view === "duel" || isDuelActive || view === "admin") return null;
    return (
      <footer className="md:hidden shrink-0 h-16 sm:h-20 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-1 sm:px-8 z-50 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => {
            setView("fanz");
            setSelectedMatchId(null);
            setSelectedTeam(null);
            setSelectedLeague(null);
            setSelectedFanzId(null);
            setSelectedPlayer(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === "fanz" ? "text-white scale-110" : "text-gray-500 hover:text-white"}`}
        >
          <Star className="w-5 h-5 sm:w-7 sm:h-7" />
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
            Fanz
          </span>
        </button>
        <button
          onClick={() => {
            setView("favorite-teams");
            setSelectedMatchId(null);
            setSelectedTeam(null);
            setSelectedLeague(null);
            setSelectedFanzId(null);
            setSelectedPlayer(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === "favorite-teams" ? "text-white scale-110" : "text-gray-500 hover:text-white"}`}
        >
          <div className="relative">
            <Layers className="w-5 h-5 sm:w-7 sm:h-7" />
            {hasFavoriteMatchToday && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
            )}
          </div>
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
            Équipes
          </span>
        </button>
        <button
          onClick={() => {
            setView("collection");
            setSelectedMatchId(null);
            setSelectedTeam(null);
            setSelectedLeague(null);
            setSelectedFanzId(null);
            setSelectedPlayer(null);
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${view === "collection" ? "text-white scale-110" : "text-gray-500 hover:text-white"}`}
        >
          <div className="relative">
            <Database className="w-5 h-5 sm:w-7 sm:h-7" />
            {hasNewMuseumItems && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full border border-[#0a0a0a]" />
            )}
          </div>
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
            Musée
          </span>
        </button>
        <button
          onClick={() => {
            setView("waiting-room");
            setSelectedMatchId(null);
            setSelectedTeam(null);
            setSelectedLeague(null);
            setSelectedFanzId(null);
            setSelectedPlayer(null);
          }}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-all duration-300 relative -top-4 sm:-top-7 group"
        >
          <div
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-4 border-[#0a0a0a] shadow-xl transition-all duration-300 relative ${view === "waiting-room" ? "bg-orange-500 shadow-orange-500/50 scale-110" : "bg-orange-600 shadow-orange-600/20 group-hover:scale-105"} ${waitingDuelsCount > 0 && view !== "waiting-room" ? "animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_20px_rgba(249,115,22,0.6)]" : ""}`}
          >
            <Swords className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            {waitingDuelsCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white shadow-lg">
                {waitingDuelsCount}
              </div>
            )}
          </div>
          <span
            className={`text-[9px] sm:text-xs font-black uppercase tracking-widest mt-0.5 sm:mt-1 ${view === "waiting-room" ? "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : "text-orange-600"}`}
          >
            Duel
          </span>
        </button>
        <button
          onClick={() => {
            setView("rankings");
            setSelectedMatchId(null);
            setSelectedTeam(null);
            setSelectedLeague(null);
            setSelectedFanzId(null);
            setSelectedPlayer(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === "rankings" ? "text-white scale-110" : "text-gray-500 hover:text-white"}`}
        >
          <Trophy className="w-5 h-5 sm:w-7 sm:h-7" />
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
            Rank
          </span>
        </button>
        <button
          onClick={() => {
            setView("social");
            setSelectedMatchId(null);
            setSelectedTeam(null);
            setSelectedLeague(null);
            setSelectedFanzId(null);
            setSelectedPlayer(null);
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${view === "social" ? "text-white scale-110" : "text-gray-500 hover:text-white"}`}
        >
          <div className="relative">
            <Users className="w-5 h-5 sm:w-7 sm:h-7" />
            {unreadSocialCount > 0 && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full border border-[#0a0a0a]" />
            )}
          </div>
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
            Social
          </span>
        </button>
        <button
          onClick={() => {
            setView("matches");
            setSelectedMatchId(null);
            setSelectedTeam(null);
            setSelectedLeague(null);
            setSelectedFanzId(null);
            setSelectedPlayer(null);
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${view === "matches" ? "text-white scale-110" : "text-gray-500 hover:text-white"}`}
        >
          <div className="relative">
            <Activity className="w-5 h-5 sm:w-7 sm:h-7" />
            {hasLiveFavoriteMatch && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full border border-[#0a0a0a]" />
            )}
          </div>
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
            Live
          </span>
        </button>
      </footer>
    );
  };

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (currentUserRef.current !== currentUser.uid) {
          if (!safeSessionStorage.getItem("isCreatingAccount")) {
            setLoading(true);
            loadingRef.current = true;
          }
          currentUserRef.current = currentUser.uid;
        }
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        const docRef = doc(db, "users", currentUser.uid);

        unsubscribeSnapshot = onSnapshot(
          docRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              safeSessionStorage.removeItem("isCreatingAccount");
              const data = docSnap.data() as UserProfile;
              let needsUpdate = false;
              let updatedData = { ...data };

              // Check for energy refill (+5 per hour, max 100)
              const lastRefillTime = new Date(
                data.lastEnergyRefill || new Date().toISOString(),
              ).getTime();
              const nowTime = new Date().getTime();
              const msPassed = nowTime - lastRefillTime;
              const hoursPassed = Math.floor(msPassed / (1000 * 60 * 60));

              const maxEner =
                (data.maxEnergy || 100) + (data.skinEnergyBonus || 0);
              if (hoursPassed >= 1 && data.energy < maxEner) {
                const energyToAdd = hoursPassed * 5;
                updatedData.energy = Math.min(
                  maxEner,
                  (data.energy || 0) + energyToAdd,
                );
                updatedData.lastEnergyRefill = new Date(
                  lastRefillTime + hoursPassed * 3600000,
                ).toISOString();
                needsUpdate = true;
              }

              // Check for admin role (case-insensitive for all listed admins)
              const adminEmails = [
                "gael.manigley@gmail.com",
                "michel@gmail.com",
                "elisa@gmail.com",
                "caro@gmail.com",
              ];
              const isCurrentUserAdmin =
                currentUser.email &&
                adminEmails.includes(currentUser.email.toLowerCase().trim());
              if (isCurrentUserAdmin && data.role !== "admin") {
                updatedData.role = "admin";
                needsUpdate = true;
              }

              // Auto-heal duplicate favorite teams
              if (data.favoriteTeams && Array.isArray(data.favoriteTeams)) {
                const uniqueFavTeams = Array.from(new Set(
                  data.favoriteTeams
                    .map(id => id?.toString()?.trim() || "")
                    .filter(id => id !== "" && id !== "undefined" && id !== "null")
                ));
                if (uniqueFavTeams.length !== data.favoriteTeams.length) {
                  updatedData.favoriteTeams = uniqueFavTeams;
                  needsUpdate = true;
                }
              }

              // Date Strings
              const today = new Date().toISOString().split("T")[0];
              const lastLogin = data.lastLoginDate;

              // Mission Reset Logic
              const lastDailyReset = data.lastDailyMissionReset; // YYYY-MM-DD
              const lastWeeklyReset = data.lastWeeklyMissionReset; // YYYY-MM-DD (Date of the Monday of that week)

              // Calculate current week's Monday (ISO string YYYY-MM-DD)
              const currentMonday = new Date();
              const dayOfMonday = currentMonday.getDay();
              const diffOfMonday =
                currentMonday.getDate() -
                dayOfMonday +
                (dayOfMonday === 0 ? -6 : 1); // adjust when day is sunday
              const mondayDate = new Date(new Date().setDate(diffOfMonday))
                .toISOString()
                .split("T")[0];

              let missionsToReset: string[] = [];

              if (lastDailyReset !== today) {
                // Reset daily missions
                const missionsSnap = await getDocs(
                  query(
                    collection(db, "missions"),
                    where("period", "==", "daily"),
                  ),
                );
                missionsSnap.docs.forEach((doc) =>
                  missionsToReset.push(doc.id),
                );
                updatedData.lastDailyMissionReset = today;
                needsUpdate = true;
              }

              if (lastWeeklyReset !== mondayDate) {
                // Reset weekly missions
                const missionsSnap = await getDocs(
                  query(
                    collection(db, "missions"),
                    where("period", "==", "weekly"),
                  ),
                );
                missionsSnap.docs.forEach((doc) =>
                  missionsToReset.push(doc.id),
                );
                updatedData.lastWeeklyMissionReset = mondayDate;
                needsUpdate = true;
              }

              if (missionsToReset.length > 0 && data.missionsProgress) {
                const newProgress = { ...data.missionsProgress };
                missionsToReset.forEach((id) => {
                  if (newProgress[id]) {
                    delete newProgress[id];
                  }
                });
                updatedData.missionsProgress = newProgress;
                needsUpdate = true;
              }

              // Weekly Streak Logic
              if (!lastLogin) {
                // First time login
                updatedData.streak = 1;
                updatedData.lastLoginDate = today;
                updatedData.claimedStreakDays = [];
                needsUpdate = true;
                setShowStreakModal(true);
              } else if (lastLogin !== today) {
                const lastDate = new Date(lastLogin);
                const todayDate = new Date(today);
                const diffTime = Math.abs(
                  todayDate.getTime() - lastDate.getTime(),
                );
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                  // Consecutive login
                  if (data.streak >= 7) {
                    updatedData.streak = 1;
                    updatedData.claimedStreakDays = [];
                  } else {
                    updatedData.streak = (data.streak || 0) + 1;
                  }
                } else {
                  // Missed a day or more
                  updatedData.streak = 1;
                  updatedData.claimedStreakDays = [];
                }

                updatedData.lastLoginDate = today;
                needsUpdate = true;
                setShowStreakModal(true);
              } else {
                // Already logged in today, check if reward claimed
                if (!data.claimedStreakDays?.includes(data.streak || 1)) {
                  setShowStreakModal(true);
                }
              }

              if (updatedData.language && updatedData.language !== appLanguage) {
                setAppLanguage(updatedData.language as any);
              }

              if (needsUpdate) {
                try {
                  await setDoc(docRef, updatedData, { merge: true });
                  // We set the profile here so they log in regardless of network timing
                  setProfile(updatedData);
                } catch (e: any) {
                  console.error(
                    "Failed to update user profile on snapshot:",
                    e,
                  );
                  // Still log them in!
                  setProfile(updatedData);
                }
              } else {
                setProfile(updatedData);
              }
            } else {
              if (
                safeSessionStorage.getItem("isCreatingAccount") &&
                profile !== null
              ) {
                // Ignore the very first negative snapshot if we are creating an account
              } else {
                setProfile(null);
                safeSessionStorage.removeItem("isCreatingAccount");
              }
            }
            setLoading(false);
          },
          (error) => {
            console.error("Profile snapshot error:", error);
            if (
              error.message?.includes("Quota limit exceeded") ||
              error.message?.includes("quota")
            ) {
              setQuotaExceeded(true);
            }
            setLoading(false);
          },
        );
      } else {
        setProfile(null);
        setLoading(false);
        loadingRef.current = false;
        currentUserRef.current = null;
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Periodic check for energy refill (+5 per hour)
  useEffect(() => {
    if (!user || !profile) return;

    const checkEnergy = async () => {
      const lastRefillTime = new Date(
        profile.lastEnergyRefill || new Date().toISOString(),
      ).getTime();
      const nowTime = new Date().getTime();
      const msPassed = nowTime - lastRefillTime;
      const hoursPassed = Math.floor(msPassed / (1000 * 60 * 60));

      const maxE = (profile.maxEnergy || 100) + (profile.skinEnergyBonus || 0);
      if (hoursPassed >= 1 && profile.energy < maxE) {
        const energyToAdd = hoursPassed * 5;
        const newEnergy = Math.min(maxE, (profile.energy || 0) + energyToAdd);
        const newRefillTime = new Date(
          lastRefillTime + hoursPassed * 3600000,
        ).toISOString();

        const docRef = doc(db, "users", user.uid);
        await setDoc(
          docRef,
          {
            energy: newEnergy,
            lastEnergyRefill: newRefillTime,
          },
          { merge: true },
        );
      }
    };

    const interval = setInterval(checkEnergy, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user, profile]);

  if (quotaExceeded) {
    return (
      <Layout containerClassName="flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a]">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black uppercase italic text-white mb-4">
            Quota de lecture dépassé
          </h2>
          <p className="text-gray-400 mb-6">
            L'application a atteint sa limite quotidienne de lectures Firestore.
            Le service sera rétabli automatiquement demain.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-red-500 hover:bg-red-600"
          >
            Réessayer
          </Button>
        </div>
      </Layout>
    );
  }

  if (resetCode) {
    return (
      <ResetPassword
        oobCode={resetCode}
        onClose={() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setResetCode(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-8 bg-[#0a0a0a] overflow-hidden">
        <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(249,115,22,0.15)]">
              <LayoutGrid className="w-10 h-10 text-orange-500 animate-[spin_20s_linear_infinite]" />
            </div>

            <div className="text-center">
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                THE BEST <span className="text-orange-500">FAN</span>
              </h1>
              <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase mt-1">
                L'expérience ultime commence
              </p>
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="flex justify-between items-end px-1">
              <span className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-t-2 border-orange-500 animate-spin" />
                Démarrage...
              </span>
              <span className="text-orange-500 font-black text-sm animate-pulse">
                ...
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden outline outline-1 outline-white/5 outline-offset-2">
              <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-[3000ms] ease-out w-[10%]">
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (guestView === "matches") {
      return (
        <div className="min-h-screen bg-[#111] text-white overflow-x-hidden w-full max-w-[100vw] relative">
          {/* Public guest-friendly navigation bar */}
          <header className="sticky top-0 z-50 bg-[#111]/85 backdrop-blur-xl border-b border-white/5 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-6">
              <button
                onClick={() => {
                  setSelectedMatchId(null);
                  setSelectedLeague(null);
                  setSelectedTeam(null);
                  setSelectedPlayer(null);
                  setGuestView("landing");
                }}
                className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs uppercase"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
                <span>Accueil</span>
              </button>
              <div
                className="text-xl md:text-2xl font-black italic tracking-tighter text-orange-500 cursor-pointer hidden sm:block"
                onClick={() => {
                  setSelectedMatchId(null);
                  setSelectedLeague(null);
                  setSelectedTeam(null);
                  setSelectedPlayer(null);
                  setGuestView("landing");
                }}
              >
                TBFO
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* LANGUAGE SELECTOR IN NAVBAR */}
              <div className="flex items-center pr-2 border-r border-white/10">
                <LanguageSelector />
              </div>

              <button
                onClick={() => {
                  setGuestView("landing");
                  // Small delay to let landing page render then trigger Auth view
                  setTimeout(() => {
                    const btn = document.getElementById(
                      "landing-connect-button",
                    );
                    if (btn) btn.click();
                  }, 50);
                }}
                className="bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-[10px] md:text-xs px-3 py-2 md:px-6 md:py-2.5 rounded-lg transition-all shadow-lg shadow-orange-600/20 active:scale-95 whitespace-nowrap"
              >
                Connexion
              </button>
            </div>
          </header>

          <main className="w-full max-w-7xl mx-auto py-4 pt-6">
            {selectedMatchId ? (
              <MatchDetails
                fixtureId={selectedMatchId}
                user={null}
                initialTab={selectedMatchTab}
                initialDuelId={undefined}
                initialDuelType={undefined}
                onDuelStatusChange={() => {}}
                onDuelIntent={() => {
                  setGuestView("landing");
                  setTimeout(() => {
                    const btn = document.getElementById(
                      "landing-connect-button",
                    );
                    if (btn) btn.click();
                  }, 50);
                }}
                onBack={() => {
                  setSelectedMatchId(null);
                  setSelectedMatchTab("summary");
                }}
                onTeamClick={(id, season) => {
                  setSelectedTeam({ id, season });
                  setSelectedMatchId(null);
                }}
                onLeagueClick={(id, season) => {
                  setSelectedLeague({ id, season });
                  setSelectedMatchId(null);
                }}
                onPlayerClick={(id, season) => {
                  setSelectedPlayer({ id, season });
                  setSelectedMatchId(null);
                }}
                onFanzClick={() => {}}
              />
            ) : selectedPlayer ? (
              <PlayerDetails
                playerId={selectedPlayer.id}
                season={selectedPlayer.season}
                onBack={() => setSelectedPlayer(null)}
                onTeamClick={(id, season) => setSelectedTeam({ id, season })}
                onLeagueClick={(id, season) =>
                  setSelectedLeague({ id, season })
                }
              />
            ) : selectedTeam ? (
              <TeamDetails
                teamId={selectedTeam.id}
                season={selectedTeam.season || 2026}
                onBack={() => setSelectedTeam(null)}
                onMatchClick={(matchId) => {
                  setSelectedMatchId(matchId);
                  setSelectedMatchTab("summary");
                }}
                onTeamClick={(id, season) => {
                  setSelectedTeam({ id, season });
                }}
                onPlayerClick={(id, season) => {
                  setSelectedPlayer({ id, season });
                }}
                onLeagueClick={(id, season) => {
                  setSelectedLeague({ id, season });
                }}
                profile={null}
              />
            ) : selectedLeague ? (
              <LeagueDetails
                leagueId={selectedLeague.id}
                season={selectedLeague.season}
                onBack={() => setSelectedLeague(null)}
                onMatchClick={(matchId, tab) => {
                  setSelectedMatchId(matchId);
                  setSelectedMatchTab(tab || "summary");
                }}
                onTeamClick={(id, season) => {
                  setSelectedTeam({ id, season });
                }}
                onPlayerClick={(id, season) => {
                  setSelectedPlayer({ id, season });
                }}
                profile={null}
              />
            ) : (
              <MatchesPage
                profile={null}
                onMatchClick={(id, tab = "summary") => {
                  setSelectedMatchId(id);
                  setSelectedMatchTab(tab);
                }}
                onJoinDuel={() => {
                  setGuestView("landing");
                  setTimeout(() => {
                    const btn = document.getElementById(
                      "landing-connect-button",
                    );
                    if (btn) btn.click();
                  }, 50);
                }}
                onTeamClick={(id, season) => setSelectedTeam({ id, season })}
                onLeagueClick={(id, season) =>
                  setSelectedLeague({ id, season })
                }
              />
            )}
          </main>
        </div>
      );
    }

    return (
      <LandingPage
        onShowLiveScores={() => setGuestView("matches")}
        onMatchSelect={(matchId) => {
          setSelectedMatchId(matchId);
          setSelectedMatchTab("summary");
          setGuestView("matches");
        }}
      />
    );
  }

  if (user && !profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col pt-4">
        <Auth onAuthSuccess={() => {}} />
      </div>
    );
  }

  if (user && profile && !assetsLoaded) {
    return (
      <AnimatePresence mode="wait">
        <Preloader uid={user.uid} onComplete={() => setAssetsLoaded(true)} />
      </AnimatePresence>
    );
  }

  if (profile?.isBanned) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="max-w-md p-8 bg-zinc-900 border border-red-900/40 rounded-2xl shadow-2xl flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 text-2xl">
            <AlertCircle className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase text-red-500 tracking-tighter">Compte Suspendu</h1>
            <p className="text-zinc-400 text-sm">
              Votre accès au jeu a été suspendu par l'administration de Fanz.
            </p>
          </div>
          <div className="p-4 bg-black/40 border border-zinc-800 rounded-xl w-full text-left text-xs font-mono text-zinc-500 space-y-1">
            <div>UID: {profile.uid}</div>
            <div>EMAIL: {profile.email}</div>
            <div>STATUS: BANNI</div>
          </div>
          <Button 
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 border-none shadow-[0_4px_12px_rgba(220,38,38,0.3)] transition-all cursor-pointer"
            onClick={() => signOut(auth)}
          >
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {profile && profile.hasCompletedOnboarding === false && (
          <OnboardingTutorial profile={profile} onComplete={() => {}} />
        )}
      </AnimatePresence>

      <Layout containerClassName="md:flex-row md:justify-center">
        <GlobalSocketListener
          onDuelStarting={(duelId, duelData) => {
            if (!isDuelActive) {
              setCurrentDuel(duelData);
              if (duelData && duelData.matchId) {
                setView("matches");
                setSelectedLeague(null);
                setSelectedTeam(null);
                setSelectedFanzId(null);
                setSelectedPlayer(null);
                setSelectedMatchId(Number(duelData.matchId));
                setJoiningDuel({
                  id: duelId,
                  type: duelData.type,
                  matchId: Number(duelData.matchId),
                });
                setIsDuelActive(true);
              }
            }
          }}
          onInvitationReceived={(invitation) => {
            const displayType = invitation.type === 'training_1v1' ? "d'entraînement" : "réel";
            showAlert({
              type: "success",
              title: "🔥 Duel Privé !",
              subtitle: `${invitation.hostPseudo} t'attend pour un duel ${displayType} !`,
              action: {
                label: "Rejoindre",
                onClick: () => {
                  setJoiningDuel({
                    id: invitation.duelId,
                    type: invitation.type,
                    matchId: invitation.matchId,
                  });
                  setSelectedMatchId(invitation.matchId);
                  setView("matches");
                },
              },
            });
          }}
        />

        {profile && view !== "duel" && !isDuelActive && view !== "admin" && (
          <aside className="hidden md:flex flex-col w-20 lg:w-64 bg-[#0a0a0a]/95 backdrop-blur-3xl border-r border-white/5 h-[100dvh] shrink-0 shadow-[20px_0_40px_rgba(0,0,0,0.5)] z-40 overflow-y-auto relative">
            <div
              className="p-4 lg:px-4 lg:py-5 flex items-center gap-2 border-b border-white/5 shrink-0 justify-center lg:justify-start cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => {
                setView("home");
                setSelectedMatchId(null);
                setSelectedTeam(null);
                setSelectedLeague(null);
                setSelectedFanzId(null);
                setSelectedPlayer(null);
              }}
            >
              <img
                src="/img/logo2.png"
                alt="TBFO"
                className="w-7 h-7 rounded-lg outline outline-1 outline-white/10"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="hidden lg:flex items-center gap-1 min-w-0">
                <span className="font-black italic text-[13px] uppercase tracking-wider text-white leading-none shrink-0">
                  TheBestFan.Online
                </span>
                <span className="px-1 py-0.5 text-[7px] font-extrabold uppercase bg-orange-500 text-black rounded-full leading-none shrink-0 tracking-wider">
                  BETA
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1 p-2 lg:p-4 flex-1 overflow-y-auto no-scrollbar">
              <SidebarButton
                icon={
                  <div className="relative">
                    <Star />
                    {claimableAlerts.fanzFervor && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                    )}
                  </div>
                }
                label={t("menu.my_fanz", "MES FANZ")}
                active={view === "fanz"}
                onClick={() => {
                  setView("fanz");
                  setSelectedMatchId(null);
                  setSelectedTeam(null);
                  setSelectedLeague(null);
                  setSelectedFanzId(null);
                  setSelectedPlayer(null);
                }}
              />
              <SidebarButton
                icon={
                  <div className="relative">
                    <Layers />
                    {hasFavoriteMatchToday && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                    )}
                  </div>
                }
                label={t("menu.my_teams", "MES EQUIPES")}
                active={view === "favorite-teams"}
                onClick={() => {
                  setView("favorite-teams");
                  setSelectedMatchId(null);
                  setSelectedTeam(null);
                  setSelectedLeague(null);
                  setSelectedFanzId(null);
                  setSelectedPlayer(null);
                }}
              />
              <SidebarButton
                icon={
                  <div className="relative">
                    <Database />
                    {hasNewMuseumItems && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                    )}
                  </div>
                }
                label={t("menu.my_museum", "MON MUSÉE")}
                active={view === "collection"}
                onClick={() => {
                  setView("collection");
                  setSelectedMatchId(null);
                  setSelectedTeam(null);
                  setSelectedLeague(null);
                  setSelectedFanzId(null);
                  setSelectedPlayer(null);
                }}
              />
              <SidebarButton
                icon={<PieChart />}
                label={t("menu.my_stats", "MES STATS")}
                active={view === "stats"}
                onClick={() => {
                  setView("stats");
                  setSelectedMatchId(null);
                  setSelectedTeam(null);
                  setSelectedLeague(null);
                  setSelectedFanzId(null);
                  setSelectedPlayer(null);
                }}
              />
              <SidebarButton
                icon={
                  <div className="relative">
                    <Swords />
                    {waitingDuelsCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">
                        {waitingDuelsCount}
                      </div>
                    )}
                  </div>
                }
                label={t("menu.duels", "DUELS")}
                active={view === "waiting-room"}
                onClick={() => {
                  setView("waiting-room");
                  setSelectedMatchId(null);
                  setSelectedTeam(null);
                  setSelectedLeague(null);
                  setSelectedFanzId(null);
                  setSelectedPlayer(null);
                }}
              />
              <SidebarButton
                icon={<BarChart2 />}
                label={t("menu.rank", "RANK")}
                active={view === "rankings"}
                onClick={() => {
                  setView("rankings");
                  setSelectedMatchId(null);
                  setSelectedTeam(null);
                  setSelectedLeague(null);
                  setSelectedFanzId(null);
                  setSelectedPlayer(null);
                }}
              />
              <SidebarButton
                icon={
                  <div className="relative">
                    <Users />
                    {unreadSocialCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                    )}
                  </div>
                }
                label={t("menu.social", "SOCIAL")}
                active={view === "social"}
                onClick={() => {
                  setView("social");
                  setSelectedMatchId(null);
                  setSelectedTeam(null);
                  setSelectedLeague(null);
                  setSelectedFanzId(null);
                  setSelectedPlayer(null);
                }}
              />

              <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                <SidebarButton
                  icon={<Calendar />}
                  label={t("menu.weekly_streak", "SERIE HEBDO")}
                  active={false}
                  onClick={() => {
                    setShowStreakModal(true);
                  }}
                />
                <SidebarButton
                  icon={
                    <div className="relative">
                      <Briefcase />
                      {claimableAlerts.globalFervor && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                      )}
                    </div>
                  }
                  label={t("menu.fervor", "FERVEUR")}
                  active={view === "fervor-path"}
                  onClick={() => {
                    setView("fervor-path");
                    setSelectedMatchId(null);
                    setSelectedTeam(null);
                    setSelectedLeague(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                />
                <SidebarButton
                  icon={
                    <div className="relative">
                      <Target />
                      {claimableAlerts.missions && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                      )}
                    </div>
                  }
                  label={t("menu.missions", "MISSIONS")}
                  active={view === "missions"}
                  onClick={() => {
                    setView("missions");
                    setSelectedMatchId(null);
                    setSelectedTeam(null);
                    setSelectedLeague(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                />
                <SidebarButton
                  icon={<Sparkles />}
                  label={t("menu.pass", "PASS")}
                  active={view === "pass"}
                  onClick={() => {
                    setView("pass");
                    setSelectedMatchId(null);
                    setSelectedTeam(null);
                    setSelectedLeague(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                />
                <SidebarButton
                  icon={<Store />}
                  label={t("menu.shop", "BOUTIQUE")}
                  active={view === "shop"}
                  onClick={() => {
                    setView("shop");
                    setSelectedMatchId(null);
                    setSelectedTeam(null);
                    setSelectedLeague(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                />
                <SidebarButton
                  icon={
                    <div className="w-6 h-6 flex items-center justify-center bg-orange-500/20 rounded-full border border-orange-500/30 overflow-hidden">
                      <img
                        src="https://thebestfan.online/img/public/mrfan/mrfan.png"
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  }
                  label={t("menu.mrfanz_guide", "GUIDE MRFANZ")}
                  active={view === "mrfanz"}
                  onClick={() => {
                    setView("mrfanz");
                    setSelectedMatchId(null);
                    setSelectedTeam(null);
                    setSelectedLeague(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                />
              </div>

              <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                <SidebarButton
                  icon={
                    <div className="relative">
                      <Activity />
                      {hasLiveFavoriteMatch && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                      )}
                    </div>
                  }
                  label={t("menu.todays_matches", "MATCHS DU JOUR")}
                  active={view === "matches"}
                  onClick={() => {
                    setView("matches");
                    setSelectedMatchId(null);
                    setSelectedTeam(null);
                    setSelectedLeague(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                />
                <SidebarButton
                  icon={<Globe />}
                  label={t("menu.competitions", "COMPETITIONS")}
                  active={view === "competitions"}
                  onClick={() => {
                    setView("competitions");
                    setSelectedMatchId(null);
                    setSelectedTeam(null);
                    setSelectedLeague(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                />
              </div>

              {profile.role === "admin" && (
                <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                  <SidebarButton
                    icon={<Settings />}
                    label={t("menu.admin", "ADMIN")}
                    active={view === ("admin" as any)}
                    onClick={() => {
                      setView("admin" as any);
                      setSelectedMatchId(null);
                      setSelectedTeam(null);
                      setSelectedLeague(null);
                      setSelectedFanzId(null);
                      setSelectedPlayer(null);
                    }}
                  />
                </div>
              )}

              <div className="mt-auto border-t border-white/5 pt-4 flex flex-col gap-3">
                <div className="px-1 py-1 flex flex-col items-center lg:items-stretch">
                  <div className="text-[8px] lg:text-[9px] font-black tracking-widest text-orange-500 uppercase mb-1.5 opacity-80 text-center lg:text-left">
                    {t("menu.language", "Langue")}
                  </div>
                  <LanguageSelector className="w-full justify-around" />
                </div>
                <SidebarButton
                  icon={<LogOut />}
                  label={t("menu.quit", "QUITTER")}
                  active={false}
                  onClick={() => {
                    setIsMenuOpen(false);
                    _setView("home");
                    signOut(auth);
                  }}
                  isDanger
                />
              </div>
            </div>
          </aside>
        )}

        <div
          className={cn(
            "flex-1 flex flex-col overflow-hidden relative min-h-0 bg-black/40",
            view !== "admin" && "md:flex-none md:w-[600px] md:max-w-[600px]",
          )}
        >
          {view === "home" ? (
            <Home
              profile={profile}
              claimableAlerts={claimableAlerts}
              onlineCount={onlineUsersCount}
              onStartDirectDuel={(matchId, type, invitedFriend) => {
                setInitialInvitedFriend(invitedFriend);
                setInitialPrivateDuel(true);
                setJoiningDuel(null);
                setSelectedMatchId(matchId);
                setSelectedMatchTab("duels");
                setView("matches");
              }}
              onNavigate={(v) => {
                setView(v);
                setSelectedLeague(null);
                setSelectedTeam(null);
                setSelectedMatchId(null);
                setSelectedFanzId(null);
                setSelectedPlayer(null);
              }}
              onMenuClick={() => {
                console.log("Menu clicked from Home!");
                setIsMenuOpen(true);
              }}
              onMatchClick={(id, tab = "summary") => {
                setSelectedMatchId(id);
                setSelectedMatchTab(
                  tab as "summary" | "lineups" | "stats" | "duels",
                );
                setJoiningDuel(null); // Clear joining flow if clicking a match normally
                setView("matches");
              }}
              onLeagueClick={(id, season) => {
                setSelectedLeague({ id, season });
                setView("competitions");
              }}
              onTeamClick={(id, season) => {
                setSelectedTeam({ id, season });
                setView("teams");
              }}
              onJoinDuel={(id, isLive) => {
                handleDuelIntent(() => {
                  setSelectedMatchId(id);
                  setView("matches");
                });
              }}
              onOpenStreak={() => setShowStreakModal(true)}
              onJoinSpecificDuel={(duelId, type, matchId) => {
                handleDuelIntent(() => {
                  setJoiningDuel({ id: duelId, type, matchId });
                  setSelectedMatchId(matchId);
                  setView("matches");
                });
              }}
              onFanzClick={(fanzId, tab) => {
                setSelectedFanzId(fanzId);
                if (tab) {
                  setSelectedFanzTab(tab as any);
                } else {
                  setSelectedFanzTab(undefined);
                }
                setView("fanz");
              }}
            />
          ) : (
            <div
              className={cn(
                "flex-1 flex flex-col overflow-hidden relative min-h-0 w-full shadow-2xl bg-[#0a0a0a]",
                view !== "admin" &&
                  "max-w-[600px] mx-auto lg:border-x border-white/5",
              )}
            >
              {profile && view !== "duel" && !isDuelActive && (
                <Header
                  profile={profile}
                  variant={(view as string) === "home" ? "home" : "subpage"}
                  onBackClick={
                    (view as string) === "home" ? undefined : handleBack
                  }
                  onHomeClick={
                    (view as string) === "home"
                      ? undefined
                      : () => {
                          setView("home");
                          setSelectedLeague(null);
                          setSelectedTeam(null);
                          setSelectedMatchId(null);
                          setSelectedFanzId(null);
                          setSelectedPlayer(null);
                        }
                  }
                  onMenuClick={() => {
                    console.log("Menu clicked from Header!");
                    setIsMenuOpen(true);
                  }}
                  onTransactionsClick={() => {
                    setView("transactions");
                    setSelectedLeague(null);
                    setSelectedTeam(null);
                    setSelectedMatchId(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                  onFervorClick={() => {
                    setView("fervor-path");
                    setSelectedLeague(null);
                    setSelectedTeam(null);
                    setSelectedMatchId(null);
                    setSelectedFanzId(null);
                    setSelectedPlayer(null);
                  }}
                  unreadSocialCount={unreadSocialCount}
                  hasClaimableFervorAlert={claimableAlerts.globalFervor}
                  wide={view === "admin"}
                />
              )}

              <div
                className={cn(
                  "flex-1 overflow-y-auto pb-6",
                  !selectedFanzId &&
                    !selectedMatchId &&
                    !selectedLeague &&
                    !selectedTeam &&
                    ![
                      "matches",
                      "fervor-path",
                      "rankings",
                      "social",
                      "missions",
                      "pass",
                      "shop",
                      "favorite-teams",
                      "transactions",
                      "stats",
                    ].includes(view as string) &&
                    "px-4 md:px-6 pt-4",
                  (selectedFanzId ||
                    selectedMatchId ||
                    selectedLeague ||
                    selectedTeam ||
                    [
                      "matches",
                      "fervor-path",
                      "rankings",
                      "social",
                      "missions",
                      "pass",
                      "shop",
                      "favorite-teams",
                      "transactions",
                      "stats",
                    ].includes(view as string)) &&
                    "px-0",
                )}
              >
                <div className="w-full h-full relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={
                        view +
                        (selectedMatchId || "") +
                        (selectedTeam?.id || "") +
                        (selectedLeague?.id || "") +
                        (selectedFanzId || "")
                      }
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="w-full min-h-full"
                    >
                      {selectedMatchId ? (
                        <MatchDetails
                          fixtureId={selectedMatchId}
                          user={profile}
                          initialTab={selectedMatchTab}
                          initialDuelId={joiningDuel?.id}
                          initialDuelType={joiningDuel?.type}
                          onDuelStatusChange={setIsDuelActive}
                          onDuelIntent={handleDuelIntent}
                          initialPrivateDuel={initialPrivateDuel}
                          initialInvitedFriend={initialInvitedFriend}
                          onBack={() => {
                            setSelectedMatchId(null);
                            setSelectedMatchTab("summary");
                            setJoiningDuel(null);
                            setInitialInvitedFriend(null);
                            setInitialPrivateDuel(false);
                          }}
                          onTeamClick={(id, season) => {
                            setSelectedTeam({ id, season });
                            setSelectedMatchId(null);
                          }}
                          onLeagueClick={(id, season) => {
                            setSelectedLeague({ id, season });
                            setSelectedMatchId(null);
                          }}
                          onPlayerClick={(id, season) => {
                            setSelectedPlayer({ id, season });
                            setSelectedMatchId(null);
                          }}
                          onFanzClick={(id) => {
                            setSelectedMatchId(null);
                            setSelectedFanzId(id);
                          }}
                        />
                      ) : selectedPlayer ? (
                        <PlayerDetails
                          playerId={selectedPlayer.id}
                          season={selectedPlayer.season}
                          onBack={() => setSelectedPlayer(null)}
                          onTeamClick={(id, season) =>
                            setSelectedTeam({ id, season })
                          }
                          onLeagueClick={(id, season) =>
                            setSelectedLeague({ id, season })
                          }
                        />
                      ) : selectedTeam ? (
                        <TeamDetails
                          teamId={selectedTeam.id}
                          season={selectedTeam.season}
                          onBack={() => setSelectedTeam(null)}
                          onLeagueClick={(id, season) =>
                            setSelectedLeague({ id, season })
                          }
                          onTeamClick={(id, season) =>
                            setSelectedTeam({ id, season })
                          }
                          onPlayerClick={(id, season) =>
                            setSelectedPlayer({ id, season })
                          }
                          onMatchClick={(id, tab = "summary") => {
                            setSelectedMatchId(id);
                            setSelectedMatchTab(
                              tab as "summary" | "lineups" | "stats" | "duels",
                            );
                            setView("matches");
                          }}
                          profile={profile}
                        />
                      ) : selectedLeague ? (
                        <LeagueDetails
                          leagueId={selectedLeague.id}
                          season={selectedLeague.season}
                          onBack={() => setSelectedLeague(null)}
                          onTeamClick={(id, season) =>
                            setSelectedTeam({ id, season })
                          }
                          onPlayerClick={(id, season) =>
                            setSelectedPlayer({ id, season })
                          }
                          onMatchClick={(id, tab = "summary") => {
                            setSelectedMatchId(id);
                            setSelectedMatchTab(
                              tab as "summary" | "lineups" | "stats" | "duels",
                            );
                            setView("matches");
                          }}
                        />
                      ) : selectedFanzId ? (
                        <FanzDetails
                          fanzId={selectedFanzId}
                          userProfile={profile}
                          initialTab={selectedFanzTab}
                          onBack={() => {
                            setSelectedFanzId(null);
                            setSelectedFanzTab(undefined);
                          }}
                        />
                      ) : view === "waiting-room" ? (
                        <WaitingRoom
                          user={profile}
                          onBack={() => setView("home")}
                          onJoinDuel={(id, type, matchId) => {
                            handleDuelIntent(() => {
                              setJoiningDuel({ id, type, matchId });
                              setSelectedMatchId(matchId);
                              setView("matches");
                            });
                          }}
                          onMatchClick={(matchId) => {
                            setSelectedMatchId(matchId);
                            setSelectedMatchTab("summary");
                            setView("matches");
                          }}
                        />
                      ) : view === "mrfanz" ? (
                        <MrFanzPage onBack={() => setView("home")} />
                      ) : view === "admin" ? (
                        <AdminZone />
                      ) : view === "matches" ? (
                        <MatchesPage
                          profile={profile}
                          onMatchClick={(id, tab = "summary") => {
                            setSelectedMatchId(id);
                            setSelectedMatchTab(tab);
                          }}
                          onJoinDuel={(id, isLive) => {
                            handleDuelIntent(() => {
                              setSelectedMatchId(id);
                              setSelectedMatchTab("summary");
                            });
                          }}
                          onTeamClick={(id, season) =>
                            setSelectedTeam({ id, season })
                          }
                          onLeagueClick={(id, season) =>
                            setSelectedLeague({ id, season })
                          }
                        />
                      ) : view === "competitions" ? (
                        <CompetitionsPage
                          onLeagueClick={(id, season) =>
                            setSelectedLeague({ id, season })
                          }
                          profile={profile}
                        />
                      ) : view === "teams" ? (
                        <TeamsPage
                          onTeamClick={(id, season) =>
                            setSelectedTeam({ id, season })
                          }
                        />
                      ) : view === "fanz" ? (
                        <FanzPage
                          userProfile={profile}
                          onFanzClick={(id) => setSelectedFanzId(id)}
                          onNavigate={setView}
                        />
                      ) : view === "collection" ? (
                        <CollectionPage user={profile} />
                      ) : view === "transactions" ? (
                        <TransactionsPage
                          profile={profile}
                          onBack={() => setView("home")}
                        />
                      ) : view === "social" ? (
                        <SocialPage
                          user={profile}
                          onBack={() => setView("home")}
                        />
                      ) : view === "fervor-path" ? (
                        <FervorPathPage
                          profile={profile}
                          onBack={() => setView("home")}
                        />
                      ) : view === "favorite-teams" ? (
                        <FavoriteTeamsPage
                          profile={profile}
                          onBack={() => setView("home")}
                          onTeamClick={(id, season) => {
                            setSelectedTeam({ id, season });
                            setView("teams");
                          }}
                        />
                      ) : view === "leaderboard" ? (
                        <LeaderboardPage />
                      ) : view === "rankings" ? (
                        <Rankings onBack={() => setView("home")} />
                      ) : view === "shop" ? (
                        <ShopPage
                          profile={profile}
                          onBack={() => setView("home")}
                        />
                      ) : view === "missions" ? (
                        <MissionsPage
                          profile={profile}
                          onBack={() => setView("home")}
                        />
                      ) : view === "pass" ? (
                        <PassPage
                          profile={profile}
                          onBack={() => setView("home")}
                        />
                      ) : view === "stats" ? (
                        <StatsPage
                          profile={profile}
                          onBack={() => setView("home")}
                        />
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {showStreakModal && profile && (
            <WeeklyStreakModal
              profile={profile}
              onClose={() => setShowStreakModal(false)}
            />
          )}

          {profile && <CommercialAlertOverlay setView={setView} />}

          <UpdatePrompt />
        </div>

        {/* Menu Modal */}
        <AnimatePresence>
          {isMenuOpen && profile && (
            <motion.div
              key="side-menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute inset-0 z-[100] bg-[#0a0a0a] flex flex-col"
            >
              <div className="p-3 shrink-0 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                  <img
                    src="/img/logo2.png"
                    alt="Logo"
                    className="w-5 h-5 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      TheBestFan.Online
                    </h2>
                    <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase bg-orange-500 text-black rounded-full leading-none shrink-0 tracking-widest scale-95">
                      BETA
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-1">
                {/* Language Selector */}
                <div className="px-3 py-2 mb-2">
                  <div className="text-[9px] font-black tracking-widest text-orange-500 uppercase mb-1.5 opacity-80">
                    Langue / Language
                  </div>
                  <LanguageSelector className="w-full justify-around" />
                </div>

                <div className="flex flex-col gap-0.5">
                  <SidebarButton
                    icon={
                      <div className="relative">
                        <Star className="w-5 h-5" />
                        {claimableAlerts.fanzFervor && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0a0a0a]" />
                        )}
                      </div>
                    }
                    label={t("menu.my_fanz", "MES FANZ")}
                    active={view === "fanz"}
                    onClick={() => {
                      setView("fanz");
                      setIsMenuOpen(false);
                      setSelectedMatchId(null);
                      setSelectedTeam(null);
                      setSelectedLeague(null);
                      setSelectedFanzId(null);
                      setSelectedPlayer(null);
                    }}
                  />
                  <SidebarButton
                    icon={
                      <div className="relative">
                        <Layers className="w-5 h-5" />
                        {hasFavoriteMatchToday && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0a0a0a]" />
                        )}
                      </div>
                    }
                    label={t("menu.my_teams", "MES EQUIPES")}
                    active={view === "favorite-teams"}
                    onClick={() => {
                      setView("favorite-teams");
                      setIsMenuOpen(false);
                      setSelectedMatchId(null);
                      setSelectedTeam(null);
                      setSelectedLeague(null);
                      setSelectedFanzId(null);
                      setSelectedPlayer(null);
                    }}
                  />
                  <SidebarButton
                    icon={
                      <div className="relative">
                        <Database className="w-5 h-5" />
                        {hasNewMuseumItems && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                        )}
                      </div>
                    }
                    label={t("menu.my_museum", "MON MUSÉE")}
                    active={view === "collection"}
                    onClick={() => {
                      setView("collection");
                      setIsMenuOpen(false);
                      setSelectedMatchId(null);
                      setSelectedTeam(null);
                      setSelectedLeague(null);
                      setSelectedFanzId(null);
                      setSelectedPlayer(null);
                    }}
                  />
                  <SidebarButton
                    icon={<PieChart className="w-5 h-5" />}
                    label={t("menu.my_stats", "MES STATS")}
                    active={view === "stats"}
                    onClick={() => {
                      setView("stats");
                      setIsMenuOpen(false);
                      setSelectedMatchId(null);
                      setSelectedTeam(null);
                      setSelectedLeague(null);
                      setSelectedFanzId(null);
                      setSelectedPlayer(null);
                    }}
                  />
                  <SidebarButton
                    icon={
                      <div className="relative">
                        <Swords className="w-5 h-5" />
                        {waitingDuelsCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0a0a0a] flex items-center justify-center text-[7px] font-black text-white">
                            {waitingDuelsCount}
                          </div>
                        )}
                      </div>
                    }
                    label={t("menu.duels", "DUELS")}
                    active={view === "waiting-room"}
                    onClick={() => {
                      setView("waiting-room");
                      setIsMenuOpen(false);
                      setSelectedMatchId(null);
                      setSelectedTeam(null);
                      setSelectedLeague(null);
                      setSelectedFanzId(null);
                      setSelectedPlayer(null);
                    }}
                  />
                  <SidebarButton
                    icon={<BarChart2 className="w-5 h-5" />}
                    label={t("menu.rank", "RANK")}
                    active={view === "rankings"}
                    onClick={() => {
                      setView("rankings");
                      setIsMenuOpen(false);
                      setSelectedMatchId(null);
                      setSelectedTeam(null);
                      setSelectedLeague(null);
                      setSelectedFanzId(null);
                      setSelectedPlayer(null);
                    }}
                  />
                  <SidebarButton
                    icon={
                      <div className="relative">
                        <Users className="w-5 h-5" />
                        {unreadSocialCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                        )}
                      </div>
                    }
                    label={t("menu.social", "SOCIAL")}
                    active={view === "social"}
                    onClick={() => {
                      setView("social");
                      setIsMenuOpen(false);
                      setSelectedMatchId(null);
                      setSelectedTeam(null);
                      setSelectedLeague(null);
                      setSelectedFanzId(null);
                      setSelectedPlayer(null);
                    }}
                  />

                  <div className="pt-2 mt-2 border-t border-white/5 flex flex-col gap-0.5">
                    <SidebarButton
                      icon={<Calendar className="w-5 h-5" />}
                      label={t("menu.weekly_streak", "SERIE HEBDO")}
                      active={false}
                      onClick={() => {
                        setShowStreakModal(true);
                        setIsMenuOpen(false);
                        setSelectedMatchId(null);
                        setSelectedTeam(null);
                        setSelectedLeague(null);
                        setSelectedFanzId(null);
                        setSelectedPlayer(null);
                      }}
                    />
                    <SidebarButton
                      icon={
                        <div className="relative">
                          <Briefcase className="w-5 h-5" />
                          {claimableAlerts.globalFervor && (
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0a0a0a]" />
                          )}
                        </div>
                      }
                      label={t("menu.fervor", "FERVEUR")}
                      active={view === "fervor-path"}
                      onClick={() => {
                        setView("fervor-path");
                        setIsMenuOpen(false);
                        setSelectedMatchId(null);
                        setSelectedTeam(null);
                        setSelectedLeague(null);
                        setSelectedFanzId(null);
                        setSelectedPlayer(null);
                      }}
                    />
                    <SidebarButton
                      icon={
                        <div className="relative">
                          <Target className="w-5 h-5" />
                          {claimableAlerts.missions && (
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0a0a0a]" />
                          )}
                        </div>
                      }
                      label={t("menu.missions", "MISSIONS")}
                      active={view === "missions"}
                      onClick={() => {
                        setView("missions");
                        setIsMenuOpen(false);
                        setSelectedMatchId(null);
                        setSelectedTeam(null);
                        setSelectedLeague(null);
                        setSelectedFanzId(null);
                        setSelectedPlayer(null);
                      }}
                    />
                    <SidebarButton
                      icon={<Sparkles className="w-5 h-5" />}
                      label={t("menu.pass", "PASS")}
                      active={view === "pass"}
                      onClick={() => {
                        setView("pass");
                        setIsMenuOpen(false);
                        setSelectedMatchId(null);
                        setSelectedTeam(null);
                        setSelectedLeague(null);
                        setSelectedFanzId(null);
                        setSelectedPlayer(null);
                      }}
                    />
                    <SidebarButton
                      icon={<Store className="w-5 h-5" />}
                      label={t("menu.shop", "BOUTIQUE")}
                      active={view === "shop"}
                      onClick={() => {
                        setView("shop");
                        setIsMenuOpen(false);
                        setSelectedMatchId(null);
                        setSelectedTeam(null);
                        setSelectedLeague(null);
                        setSelectedFanzId(null);
                        setSelectedPlayer(null);
                      }}
                    />
                    <SidebarButton
                      icon={
                        <div className="w-5 h-5 flex items-center justify-center bg-orange-500/20 rounded-full border border-orange-500/30 overflow-hidden">
                          <img
                            src="https://thebestfan.online/img/public/mrfan/mrfan.png"
                            className="w-4 h-4 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      }
                      label={t("menu.mrfanz_guide", "GUIDE MRFANZ")}
                      active={view === "mrfanz"}
                      onClick={() => {
                        setView("mrfanz");
                        setIsMenuOpen(false);
                        setSelectedMatchId(null);
                        setSelectedTeam(null);
                        setSelectedLeague(null);
                        setSelectedFanzId(null);
                        setSelectedPlayer(null);
                      }}
                    />
                  </div>

                  <div className="pt-2 mt-2 border-t border-white/5 flex flex-col gap-0.5">
                    <SidebarButton
                      icon={
                        <div className="relative">
                          <Activity className="w-5 h-5" />
                          {hasLiveFavoriteMatch && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                          )}
                        </div>
                      }
                      label={t("menu.todays_matches", "MATCHS DU JOUR")}
                      active={view === "matches"}
                      onClick={() => {
                        setView("matches");
                        setIsMenuOpen(false);
                        setSelectedMatchId(null);
                        setSelectedTeam(null);
                        setSelectedLeague(null);
                        setSelectedFanzId(null);
                        setSelectedPlayer(null);
                      }}
                    />
                    <SidebarButton
                      icon={<Globe className="w-5 h-5" />}
                      label={t("menu.competitions", "COMPETITIONS")}
                      active={view === "competitions"}
                      onClick={() => {
                        setView("competitions");
                        setIsMenuOpen(false);
                        setSelectedMatchId(null);
                        setSelectedTeam(null);
                        setSelectedLeague(null);
                        setSelectedFanzId(null);
                        setSelectedPlayer(null);
                      }}
                    />
                  </div>

                  {profile.role === "admin" && (
                    <div className="pt-2 mt-2 border-t border-white/5 flex flex-col gap-0.5">
                      <SidebarButton
                        icon={<Settings className="w-5 h-5" />}
                        label={t("menu.admin", "ADMIN")}
                        active={view === ("admin" as any)}
                        onClick={() => {
                          setView("admin" as any);
                          setIsMenuOpen(false);
                          setSelectedMatchId(null);
                          setSelectedTeam(null);
                          setSelectedLeague(null);
                          setSelectedFanzId(null);
                          setSelectedPlayer(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 mt-auto border-t border-white/10 shrink-0">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    _setView("home");
                    signOut(auth);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2 bg-red-500/10 text-red-500 rounded-lg font-bold hover:bg-red-500/20 transition-colors text-xs uppercase"
                >
                  <LogOut className="w-4 h-4" />
                  {t("menu.quit", "QUITTER")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Action Modal */}
        {showActiveActionModal &&
          activeActionDetails &&
          activeFanz &&
          profile && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
              <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 w-full max-w-md overflow-hidden flex flex-col relative">
                <button
                  onClick={() => setShowActiveActionModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="p-6">
                  <h3 className="text-xl font-black text-white uppercase italic mb-4 text-center">
                    Action en cours
                  </h3>
                  <p className="text-sm text-gray-400 text-center mb-6">
                    Vous ne pouvez pas rejoindre ou créer un duel pendant qu'une
                    action de vie est en cours.
                  </p>
                  <LifeActionCard
                    action={activeActionDetails}
                    fanz={activeFanz}
                    userProfile={profile}
                  />
                </div>
              </div>
            </div>
          )}

        {/* Alerte de passage de palier de ferveur */}
        <AnimatePresence>
          {!dismissedFervorAlert &&
            (claimableAlerts.globalFervor || claimableAlerts.fanzFervor) && (
              <motion.div
                key="fervor-palier-alert"
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="fixed bottom-24 md:bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-[380px] bg-[#0f0f0f]/95 border-2 border-orange-500/40 rounded-2xl p-4 shadow-[0_10px_30px_-5px_rgba(234,88,12,0.4)] backdrop-blur-md z-[120] flex flex-col gap-3 overflow-hidden text-white"
              >
                {/* Effet lumineux de fond */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-orange-600/25 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-start justify-between relative">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500 shrink-0">
                      <Flame className="w-5 h-5 animate-pulse text-orange-500 fill-orange-500/20" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black italic uppercase tracking-wider text-orange-500 flex items-center gap-1.5 leading-none">
                        {t("fervor.milestone_reached", "PALIER FRANCHI !")}{" "}
                        <Sparkles className="w-3.5 h-3.5 text-orange-300" />
                      </h4>
                      <p className="text-[11px] text-gray-300 font-bold leading-normal mt-1">
                        {t("fervor.milestone_desc", "Tu as passé un nouveau niveau de ferveur ! Récupère vite tes récompenses.")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDismissedFervorAlert(true)}
                    className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all -mt-1 -mr-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 mt-1 relative">
                  {claimableAlerts.globalFervor && (
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5 hover:border-orange-500/10 transition-all">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-[10px] font-bold text-gray-300 uppercase italic">
                          {t("fervor.global", "Ferveur Générale")}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setView("fervor-path");
                          setSelectedMatchId(null);
                          setSelectedTeam(null);
                          setSelectedLeague(null);
                          setSelectedFanzId(null);
                          setSelectedPlayer(null);
                          setDismissedFervorAlert(true);
                        }}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-black italic uppercase text-[9px] tracking-wider px-3.5 py-1.5 h-auto rounded-lg shadow-md hover:shadow-orange-500/20"
                      >
                        {t("common.claim", "Récupérer")} <Gift className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  )}

                  {claimableAlerts.fanzFervor && (
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5 hover:border-orange-500/10 transition-all">
                      <div className="flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-[10px] font-bold text-gray-300 uppercase italic">
                          Ferveur FANZ
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setView("fanz");
                          setSelectedMatchId(null);
                          setSelectedTeam(null);
                          setSelectedLeague(null);
                          setSelectedFanzId(null);
                          setSelectedPlayer(null);
                          setDismissedFervorAlert(true);
                        }}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-black italic uppercase text-[9px] tracking-wider px-3.5 py-1.5 h-auto rounded-lg shadow-md hover:shadow-orange-500/20"
                      >
                        Récupérer <Gift className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        {renderFooter()}
      </Layout>
    </>
  );
}

function SidebarButton({
  active,
  onClick,
  icon,
  label,
  isDanger = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isDanger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-2 lg:gap-4 p-3 lg:px-4 lg:py-3 rounded-xl transition-all font-black uppercase italic tracking-wider text-[10px] lg:text-sm w-full group",
        active
          ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
          : isDanger
            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
            : "text-gray-400 hover:text-white hover:bg-white/5",
      )}
    >
      <div
        className={cn(
          "w-6 h-6 flex items-center justify-center transition-transform",
          active ? "scale-110" : "group-hover:scale-110",
        )}
      >
        {icon}
      </div>
      <span className="truncate">{label}</span>
      {active && (
        <div className="absolute right-0 w-1 h-8 bg-white rounded-l-full hidden lg:block" />
      )}
    </button>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 p-2 bg-[#1a1a1a] border border-white/5 rounded-xl hover:bg-white/10 hover:border-orange-500 transition-all group shrink-0"
    >
      <div className="w-8 h-8 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tight text-center leading-none text-white truncate w-full">
        {label}
      </span>
    </button>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold uppercase italic text-xs tracking-wider ${
        active
          ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
