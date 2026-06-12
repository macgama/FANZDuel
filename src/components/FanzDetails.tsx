import React, { useState, useEffect, useRef } from "react";
import { getImageUrl } from "../lib/utils";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { logTransaction } from "../services/transactionService";
import { Card, Button } from "./Layout";
import {
  UserProfile,
  Fanz,
  ActiveAction,
  LifeAction,
  UserCard,
  Card as DuelCard,
  FanzTemplate,
  FanzSkin,
  FanzEmote,
  GlobalFervorConfig,
} from "../types";
import {
  Trophy,
  Lock,
  Unlock,
  Star,
  Info,
  ArrowLeft,
  Shield,
  Brain,
  Heart,
  Eye,
  MessageCircle,
  Users,
  Flame,
  Activity,
  Database,
  Clock,
  Trash2,
  FastForward,
  ChevronUp,
  CheckCircle,
  RefreshCw,
  Layers,
  Smile,
  ChevronLeft,
  ChevronRight,
  Check,
  Gift,
  X,
  Target,
  Plus,
  Minus,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LOGOS } from "../constants";

import { LifeActionCard } from "./LifeActionCard";

import { BASE_CARDS } from "../constants/cards";
import { OptimizedMedia } from "./OptimizedMedia";

import { useReward } from "../context/RewardContext";
import { generateFervorPath } from "../utils/fervorPath";

const isAllowedByRank = (rarity: string | undefined, rank: number): boolean => {
  const r = rarity || 'common';
  if (rank >= 1 && rank <= 3) {
    return r === 'common';
  }
  if (rank >= 4 && rank <= 6) {
    return r === 'common' || r === 'rare';
  }
  if (rank >= 7 && rank <= 8) {
    return r === 'common' || r === 'rare' || r === 'epic';
  }
  return true;
};

interface FanzDetailsProps {
  fanzId: string;
  userProfile: UserProfile;
  onBack: () => void;
  initialTab?: "infos" | "stats" | "cards" | "skins" | "emotes" | "rank" | "ferveur";
}

export function FanzDetails({ fanzId, userProfile, onBack, initialTab }: FanzDetailsProps) {
  const [fanz, setFanz] = useState<Fanz | null>(null);
  const [template, setTemplate] = useState<FanzTemplate | null>(null);
  const [lifeActions, setLifeActions] = useState<LifeAction[]>([]);
  const [allCards, setAllCards] = useState<DuelCard[]>([]);
  const [allSkins, setAllSkins] = useState<FanzSkin[]>([]);
  const [allEmotes, setAllEmotes] = useState<FanzEmote[]>([]);
  const [fanzFervorConfig, setFanzFervorConfig] = useState<
    GlobalFervorConfig | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "infos" | "stats" | "cards" | "skins" | "emotes" | "rank" | "ferveur"
  >(initialTab || "infos");
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [rankingUp, setRankingUp] = useState(false);
  const [rewardModal, setRewardModal] = useState<{
    isOpen: boolean;
    title: string;
    rankNum?: number;
    slotId: string;
    rewardType:
      | "choice"
      | "card"
      | "xp"
      | "skin"
      | "emote"
      | "action"
      | "fanz"
      | "team_slot"
      | "money"
      | "gems"
      | "boost"
      | "energy";
    amount?: number;
    cardId?: string;
    skinId?: string;
    emoteId?: string;
    actionId?: string;
    choices?: any[]; // RankReward[]
    step:
      | "initial"
      | "skill-selection"
      | "card-selection"
      | "skin-selection"
      | "emote-selection"
      | "action-selection"
      | "success";
    selectedChoice?: "card" | "xp" | "skin" | "emote" | "action";
    unlockedCard?: DuelCard;
    unlockedSkin?: FanzSkin;
    unlockedEmote?: FanzEmote;
    unlockedAction?: LifeAction;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [purchaseConfirm, setPurchaseConfirm] = useState<{
    type: "skin" | "emote" | "card";
    item: any;
  } | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const [cardFilter, setCardFilter] = useState<"all" | "available" | "locked">(
    "all",
  );
  const [selectedMuseumCard, setSelectedMuseumCard] = useState<{
    card: DuelCard;
    isUnlocked: boolean;
    requirements: any[];
    canAfford: boolean;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount =
        direction === "left"
          ? -scrollContainerRef.current.clientWidth
          : scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const toggleCard = async (cardId: string) => {
    if (!fanz) return;

    const currentDeck = fanz.equippedCards || [];
    let newDeck: string[];

    if (currentDeck.includes(cardId)) {
      newDeck = currentDeck.filter((id) => id !== cardId);
    } else {
      if (currentDeck.length >= 8) return;
      newDeck = [...currentDeck, cardId];
    }

    try {
      const fanzRef = doc(db, "fanz", fanz.id);
      await updateDoc(fanzRef, { equippedCards: newDeck });
      setFanz({ ...fanz, equippedCards: newDeck });
    } catch (error) {
      console.error("Error updating deck:", error);
    }
  };

  const handleBuyCard = async (card: DuelCard) => {
    if (!userProfile) return;
    setPurchasing(true);
    try {
      const priceParams = card.price || {};
      const updates: any = {};
      if (priceParams.money) updates.money = increment(-priceParams.money);
      if (priceParams.gems) updates.gems = increment(-priceParams.gems);
      if (priceParams.boostPoints)
        updates.boostPoints = increment(-priceParams.boostPoints);

      updates.cards = arrayUnion(card.id);

      await updateDoc(doc(db, "users", userProfile.uid), updates);

      setAlertModal({
        title: "Achat réussi !",
        message: `La carte ${card.name} a été ajoutée à votre musée.`,
        type: "success",
      });
      setPurchaseConfirm(null);
    } catch (err) {
      console.error(err);
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${userProfile.uid}`,
      );
    } finally {
      setPurchasing(false);
    }
  };

  const { showReward } = useReward();

  useEffect(() => {
    let unsubscribeFanz: () => void;

    const fetchFanzAndActions = async () => {
      try {
        const docRef = doc(db, "fanz", fanzId);

        unsubscribeFanz = onSnapshot(
          docRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              const fanzData = docSnap.data() as Fanz;
              setFanz(fanzData);

              const tplRef = doc(db, "fanz_templates", fanzData.templateId);
              const tplSnap = await getDoc(tplRef);
              if (tplSnap.exists()) {
                const tplData = tplSnap.data() as FanzTemplate;
                setTemplate(tplData);
                setAllSkins(tplData.skins || []);
                setAllEmotes(tplData.emotes || []);
              }
            }
          },
          (error) => {
            console.error("Error listening to Fanz:", error);
            handleFirestoreError(error, OperationType.GET, `fanz/${fanzId}`);
          },
        );

        const cardsSnapshot = await getDocs(collection(db, "cards"));
        const cardsData = cardsSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as DuelCard,
        );
        setAllCards(cardsData);

        const actionsSnapshot = await getDocs(collection(db, "life_actions"));
        const actionsData = actionsSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as LifeAction,
        );
        setLifeActions(actionsData);

        const configDoc = await getDoc(
          doc(db, "global_configs", "fanz_fervor"),
        );
        if (configDoc.exists()) {
          setFanzFervorConfig(configDoc.data() as GlobalFervorConfig);
        }
      } catch (error) {
        console.error("Error fetching Fanz details or actions:", error);
        handleFirestoreError(error, OperationType.GET, `fanz/${fanzId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFanzAndActions();
    return () => {
      if (unsubscribeFanz) unsubscribeFanz();
    };
  }, [fanzId]);

  const ferveurPath = React.useMemo(() => {
    const configToUse = template?.ferveurConfig || fanzFervorConfig;
    if (configToUse) {
      const maxPoints =
        configToUse.ranges?.[configToUse.ranges.length - 1]?.max || 50000;
      return generateFervorPath(maxPoints, configToUse);
    }
    if (template?.ferveurPath && template.ferveurPath.length > 0)
      return template.ferveurPath;
    if (fanz?.ferveurPath && fanz.ferveurPath.length > 0)
      return fanz.ferveurPath;
    return [];
  }, [
    template?.ferveurPath,
    fanz?.ferveurPath,
    fanzFervorConfig,
    template?.ferveurConfig,
  ]);

  const maxFerveurPoints =
    ferveurPath.length > 0
      ? ferveurPath[ferveurPath.length - 1].pointsRequired
      : 1000;

  const hasClaimableFerveur = React.useMemo(() => {
    if (!fanz || !ferveurPath) return false;
    const pts = fanz.ferveurPoints || 0;
    return ferveurPath.some((step) => {
      const slotId = step.isIntermediate
        ? `ferveur-inter-${step.id || step.pointsRequired}`
        : `ferveur-level-${step.level}`;
      return (
        pts >= step.pointsRequired && !fanz.claimedRewards?.includes(slotId)
      );
    });
  }, [fanz, ferveurPath]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">
          Chargement du FANZ...
        </p>
      </div>
    );
  }

  if (!fanz || !template) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 font-bold">FANZ introuvable.</p>
        <button onClick={onBack} className="mt-4 text-orange-500 font-bold">
          Retour
        </button>
      </div>
    );
  }

  const statIcons = {
    force: (
      <img
        src="https://thebestfan.online/img/public/logo/logoForce.png"
        alt="Force"
        className="w-8 h-8 object-contain drop-shadow-md"
        referrerPolicy="no-referrer"
      />
    ),
    endurance: (
      <img
        src="https://thebestfan.online/img/public/logo/logoEndurance.png"
        alt="Endurance"
        className="w-8 h-8 object-contain drop-shadow-md"
        referrerPolicy="no-referrer"
      />
    ),
    mental: (
      <img
        src="https://thebestfan.online/img/public/logo/logoMental.png"
        alt="Mental"
        className="w-8 h-8 object-contain drop-shadow-md"
        referrerPolicy="no-referrer"
      />
    ),
    bluff: (
      <img
        src="https://thebestfan.online/img/public/logo/logoBluff.png"
        alt="Bluff"
        className="w-8 h-8 object-contain drop-shadow-md"
        referrerPolicy="no-referrer"
      />
    ),
    creativity: (
      <img
        src="https://thebestfan.online/img/public/logo/logoCreativity.png"
        alt="Créativité"
        className="w-8 h-8 object-contain drop-shadow-md"
        referrerPolicy="no-referrer"
      />
    ),
    social: (
      <img
        src="https://thebestfan.online/img/public/logo/logoSocial.png"
        alt="Social"
        className="w-8 h-8 object-contain drop-shadow-md"
        referrerPolicy="no-referrer"
      />
    ),
    intelligence: (
      <img
        src="https://thebestfan.online/img/public/logo/logoIntelligence.png"
        alt="Intelligence"
        className="w-8 h-8 object-contain drop-shadow-md"
        referrerPolicy="no-referrer"
      />
    ),
    charisma: (
      <img
        src="https://thebestfan.online/img/public/logo/logoCharisme.png"
        alt="Charisme"
        className="w-8 h-8 object-contain drop-shadow-md"
        referrerPolicy="no-referrer"
      />
    ),
  };

  const cardTypeStyles = {
    bonus: {
      bg: "from-green-900/40 to-black",
      border: "border-green-500",
      text: "text-green-500",
      label: "Bonus",
    },
    malus: {
      bg: "from-red-900/40 to-black",
      border: "border-red-500",
      text: "text-red-500",
      label: "Malus",
    },
    neutral: {
      bg: "from-blue-900/40 to-black",
      border: "border-blue-500",
      text: "text-blue-500",
      label: "Neutre",
    },
  };

  const effectLabels: Record<string, string> = {
    push_rope: "Pousse la corde",
    drain_energy: "Vole de l'excitation",
    refill_energy: "Restaure l'excitation",
    hide_button: "Cache le bouton",
    shrink_button: "Rétrécit le bouton",
    move_button: "Déplace le bouton",
    blur_view: "Floute la vue",
    hide_score: "Cache le score",
    discard_enemy_cards: "Défausse les cartes adverses",
    shuffle_deck: "Mélange le deck",
    freeze_button: "Gèle le bouton",
    double_points: "Points doublés",
    shield: "Bouclier",
    mirror: "Miroir",
    energy_regen_boost: "Boost régén. excitation",
    earthquake: "Tremblement de terre",
    fake_buttons: "Faux boutons",
    card_lock: "Verrouille les cartes",
    swap_hands: "Échange les mains",
    mimic: "Imite la dernière carte",
    lucky_draw: "Tirage chanceux",
    steal_energy: "Vole de l'énergie",
    cleanse: "Purge les malus",
    vampirism: "Vampirisme",
    fog_of_war: "Brouillard de guerre",
    frenzy: "Frénésie",
    sabotage: "Sabotage",
    immunity: "Immunité",
    critical_strike: "Coup critique",
    momentum: "Dynamique",
    overload: "Surcharge",
    cancel_last_attack: "Annule la dernière attaque",
    rage_quit_discard: "Défausse de rage",
    meta_update: "Mise à jour méta",
    invert_rope: "Inverse la corde",
    blackout: "Blackout",
    stealth_jacket_flip: "Retournement de Veste Furtif",
    desert_crossing: "La Traversée du Désert",
    half_half_scarf: "L'Écharpe Half-Half",
    megaphone_echo: "L'Écho du Mégaphone",
    biological_curfew: "Le Couvre-Feu Biologique",
    early_craquage: "Le Craquage Précoce",
    laser_relaunch: "La Relance Laser",
    pro_tantrum: "Le Coup de Sang du Pro",
    multiball_chaos: "Le Multi-Ballon Maléfique",
    mental_main_courante: "Le Mental de la Main Courante",
    heritage_weight: "Le Poids de l'Héritage",
    buvette_alert: "Alerte Buvette (Saucisse-Frites)",
    tiktok_highlight: "L'Highlight TikTok",
    boucher_district: "Le Boucher du District",
    faux_rebond_excuse: "L'Excuse du Faux Rebond",
    prime_goat: "Le Prime (G.O.A.T)",
    attention_swipe: "Perte d'Attention (Swipe)",
    sterile_debate: "Le Débat Stérile sur les Réseaux",
    curse: "Malédiction",
    blessing: "Bénédiction",
    confetti: "Confettis",
    golden_goal: "But en or",
    hypnosis: "Hypnose",
    pacifier_drama: "Drame de la tétine",
    draw_cards: "Pioche de cartes",
    mascot_bazooka: "Bazooka de mascotte",
    steal_best_card: "Vole la meilleure carte",
    discard_random_cards: "Défausse aléatoire",
    trade_stickers: "Échange d'autocollants",
    stun: "Étourdissement",
    heavy_ball_boost: "Boulet de canon",
    throat_tackle: "Tacle à la gorge",
    mammoth_charge: "Charge de mammouth",
    mascot_bone_drum: "Tambour d'os",
    scarves_wall: "Mur d'écharpes",
    virage_host: "Virage hôte",
    clapping_odin: "Clapping d'Odin",
    corne_drakkar: "Corne de drakkar",
    steal_object_card: "Vole une carte objet",
    parrot_taunt: "Provocation du perroquet",
    pumpkin_fog: "Brouillard de citrouille",
    locker_room_curse: "Malédiction de vestiaire",
    luminescent_standard: "Étendard luminescent",
    buvette_grail: "Graal de buvette",
    var_illusion: "Illusion de la VAR",
    grimoire_chants: "Grimoire des chants",
    chainsaw_megaphone: "Mégaphone tronçonneuse",
    burning_seats: "Sièges en feu",
    var_temporelle: "VAR temporelle",
    tifo_holographique: "Tifo holographique",
    capo_megaphone: "Mégaphone du capo",
    craquage_massif: "Craquage massif",
    vol_ballon: "Vol de Ballon",
    regard_chien_battu: "Regard de Chien Battu",
    zoomies_chaos: "Les Zoomies du Chaos",
    transfusion_tactique: "Transfusion tactique",
    eclipse_artificielle: "Éclipse artificielle",
    coup_d_envoi_13h: "Coup d'envoi 13h"
  };

  const statLabels = {
    force: "Force",
    endurance: "Endurance",
    mental: "Mental",
    bluff: "Bluff",
    creativity: "Créativité",
    social: "Social",
    intelligence: "Intelligence",
    charisma: "Charisme",
  };

  const statDuelDescriptions = {
    force: "Augmente la puissance des clics et l'excitation de départ en duel.",
    endurance: "Augmente l'excitation max et sa vitesse de récupération par seconde.",
    mental: "Allonge la durée de tous les malus infligés à l'adversaire.",
    bluff: "Prolonge les effets visuels indésirables infligés à l'adversaire.",
    creativity: "Réduit le coût en excitation de toutes vos cartes d'action.",
    social: "Booste la Ferveur et le score générés lors d'un duel.",
    intelligence: "Améliore les chances d'obtenir des cartes d'action plus rares.",
    charisma: "Renforce la puissance globale et le bonus de vos cartes jouées.",
  };

  const handleBuySkin = async (skin: FanzSkin) => {
    if (!fanz || !userProfile) return;

    const missingCurrencies: string[] = [];
    if (skin.price.money && (userProfile.money || 0) < skin.price.money)
      missingCurrencies.push(
        `${skin.price.money - (userProfile.money || 0)} Argent`,
      );
    if (skin.price.gems && (userProfile.gems || 0) < skin.price.gems)
      missingCurrencies.push(
        `${skin.price.gems - (userProfile.gems || 0)} Gemmes`,
      );
    if (
      skin.price.boostPoints &&
      (userProfile.boostPoints || 0) < skin.price.boostPoints
    )
      missingCurrencies.push(
        `${skin.price.boostPoints - (userProfile.boostPoints || 0)} Boost`,
      );

    if (missingCurrencies.length > 0) {
      setAlertModal({
        title: "Fonds insuffisants",
        message: `Il vous manque : ${missingCurrencies.join(", ")} pour acheter ce skin.`,
        type: "error",
      });
      setPurchaseConfirm(null);
      return;
    }

    setPurchasing(true);
    try {
      const userRef = doc(db, "users", userProfile.uid);
      const fanzRef = doc(db, "fanz", fanz.id);

      const updatedSkins = [...(fanz.unlockedSkins || []), skin.id];
      const userUpdates: any = {
        skins: arrayUnion(skin.id),
      };
      if (skin.price.money)
        userUpdates.money = (userProfile.money || 0) - skin.price.money;
      if (skin.price.gems)
        userUpdates.gems = (userProfile.gems || 0) - skin.price.gems;
      if (skin.price.boostPoints)
        userUpdates.boostPoints =
          (userProfile.boostPoints || 0) - skin.price.boostPoints;

      await updateDoc(userRef, userUpdates);
      await updateDoc(fanzRef, {
        unlockedSkins: updatedSkins,
        equippedSkin: skin.id,
        name: skin.name,
      });

      if (skin.price.money)
        await logTransaction(
          userProfile.uid,
          "money",
          -skin.price.money,
          `Achat skin: ${skin.name}`,
        );
      if (skin.price.gems)
        await logTransaction(
          userProfile.uid,
          "gems",
          -skin.price.gems,
          `Achat skin: ${skin.name}`,
        );
      if (skin.price.boostPoints)
        await logTransaction(
          userProfile.uid,
          "boost",
          -skin.price.boostPoints,
          `Achat skin: ${skin.name}`,
        );

      setPurchaseConfirm(null);
      setAlertModal({
        title: "Skin acheté !",
        message: `Vous avez débloqué le skin ${skin.name}.`,
        type: "success",
      });
    } catch (error) {
      console.error("Error buying skin:", error);
      handleFirestoreError(error, OperationType.UPDATE, `fanz/${fanz.id}`);
    } finally {
      setPurchasing(false);
    }
  };

  const handleBuyEmote = async (emote: FanzEmote) => {
    if (!fanz || !userProfile || !emote.price) return;

    const missingCurrencies: string[] = [];
    if (emote.price.money && (userProfile.money || 0) < emote.price.money)
      missingCurrencies.push(
        `${emote.price.money - (userProfile.money || 0)} Argent`,
      );
    if (emote.price.gems && (userProfile.gems || 0) < emote.price.gems)
      missingCurrencies.push(
        `${emote.price.gems - (userProfile.gems || 0)} Gemmes`,
      );
    if (
      emote.price.boostPoints &&
      (userProfile.boostPoints || 0) < emote.price.boostPoints
    )
      missingCurrencies.push(
        `${emote.price.boostPoints - (userProfile.boostPoints || 0)} Boost`,
      );

    if (missingCurrencies.length > 0) {
      setAlertModal({
        title: "Fonds insuffisants",
        message: `Il vous manque : ${missingCurrencies.join(", ")} pour acheter cet emote.`,
        type: "error",
      });
      setPurchaseConfirm(null);
      return;
    }

    setPurchasing(true);
    try {
      const userRef = doc(db, "users", userProfile.uid);
      const fanzRef = doc(db, "fanz", fanz.id);

      const updatedEmotes = [...(fanz.unlockedEmotes || []), emote.id];
      const userUpdates: any = {
        emotes: arrayUnion(emote.id),
      };
      if (emote.price.money)
        userUpdates.money = (userProfile.money || 0) - emote.price.money;
      if (emote.price.gems)
        userUpdates.gems = (userProfile.gems || 0) - emote.price.gems;
      if (emote.price.boostPoints)
        userUpdates.boostPoints =
          (userProfile.boostPoints || 0) - emote.price.boostPoints;

      await updateDoc(userRef, userUpdates);
      await updateDoc(fanzRef, {
        unlockedEmotes: updatedEmotes,
      });

      if (emote.price.money)
        await logTransaction(
          userProfile.uid,
          "money",
          -emote.price.money,
          `Achat emote: ${emote.name}`,
        );
      if (emote.price.gems)
        await logTransaction(
          userProfile.uid,
          "gems",
          -emote.price.gems,
          `Achat emote: ${emote.name}`,
        );
      if (emote.price.boostPoints)
        await logTransaction(
          userProfile.uid,
          "boost",
          -emote.price.boostPoints,
          `Achat emote: ${emote.name}`,
        );

      setPurchaseConfirm(null);
      setAlertModal({
        title: "Emote acheté !",
        message: `Vous avez débloqué l'emote ${emote.name}.`,
        type: "success",
      });
    } catch (error) {
      console.error("Error buying emote:", error);
      handleFirestoreError(error, OperationType.UPDATE, `fanz/${fanz.id}`);
    } finally {
      setPurchasing(false);
    }
  };

  const handleEquipSkin = async (skinId: string | undefined) => {
    if (!fanz || !template || !userProfile) return;

    try {
      const fanzRef = doc(db, "fanz", fanz.id);
      const skin = template.skins?.find((s) => s.id === skinId);
      const newName = skin ? skin.name : template.name;

      const fanzUpdates: any = {
        equippedSkin: skinId || null,
        name: newName,
      };

      if (skinId && !fanz.unlockedSkins?.includes(skinId)) {
        fanzUpdates.unlockedSkins = arrayUnion(skinId);
      }

      await updateDoc(fanzRef, fanzUpdates);

      if (userProfile.activeFanzId === fanz.id) {
        // We no longer automatically change the user's avatar when they equip a skin
        // The user can configure their avatar separately in their profile
      }
    } catch (error) {
      console.error("Error equipping skin:", error);
      handleFirestoreError(error, OperationType.UPDATE, `fanz/${fanz.id}`);
    }
  };

  const activeActionId =
    userProfile.activeAction?.fanzId === fanz.id
      ? userProfile.activeAction.actionId
      : null;
  const activeAction = lifeActions.find((a) => a.id === activeActionId);

  const equippedSkinData = template?.skins?.find(
    (s) => s.id === fanz?.equippedSkin,
  );

  let currentImageUrl = template?.image;
  let currentVideoUrl = template?.video;

  if (fanz?.imageUrl) currentImageUrl = fanz.imageUrl;
  if (fanz?.videoUrl) currentVideoUrl = fanz.videoUrl;

  if (equippedSkinData) {
    currentImageUrl = equippedSkinData.imageUrl || currentImageUrl;
    currentVideoUrl = equippedSkinData.videoUrl || null; // Don't fallback to template video if skin has no video
  }

  if (activeAction) {
    let resolvedImage = activeAction.image;
    let resolvedVideoUrl = activeAction.videoUrl;
    if (
      fanz.equippedSkin &&
      activeAction.skinOverrides &&
      activeAction.skinOverrides[fanz.equippedSkin]
    ) {
      const override = activeAction.skinOverrides[fanz.equippedSkin];
      if (override.image) resolvedImage = override.image;
      if (override.videoUrl) resolvedVideoUrl = override.videoUrl;
    }
    currentImageUrl = resolvedImage || currentImageUrl;
    currentVideoUrl = resolvedVideoUrl || null; // Don't fallback to skin video if action has no video
  }

  const finalVideoUrl = getImageUrl(currentVideoUrl);
  if (!finalVideoUrl) {
    currentVideoUrl = null;
  }

  const handleSetActiveFanz = async () => {
    if (!userProfile || !fanz) return;
    try {
      await updateDoc(doc(db, "users", userProfile.uid), {
        activeFanzId: fanz.id,
      });
      setAlertModal({
        title: "FANZ Actif",
        message: "Ce FANZ est maintenant votre FANZ actif !",
        type: "success",
      });
    } catch (error) {
      console.error("Error setting active FANZ:", error);
      setAlertModal({
        title: "Erreur",
        message: "Impossible de définir ce FANZ comme actif.",
        type: "error",
      });
    }
  };

  const generateProgressHeight = () => {
    if (ferveurPath.length === 0) return 0;
    const pts = fanz?.ferveurPoints || 0;
    const lastStep = ferveurPath[ferveurPath.length - 1];
    if (pts >= lastStep.pointsRequired) return 100;

    for (let i = 0; i < ferveurPath.length; i++) {
      const step = ferveurPath[i];
      if (pts < step.pointsRequired) {
        const prevPoints = i === 0 ? 0 : ferveurPath[i - 1].pointsRequired;
        const segmentProgress =
          (pts - prevPoints) / (step.pointsRequired - prevPoints);
        const heightPerSegment = 100 / ferveurPath.length;
        // Add a little offset to center the progress at the node
        return Math.min(
          100,
          Math.max(
            0,
            i * heightPerSegment + segmentProgress * heightPerSegment,
          ),
        );
      }
    }
    return 0;
  };

  return (
    <div className="flex flex-col pb-20">
      {/* Hero Section (4:3 Aspect Ratio) */}
      <div className="w-full aspect-[4/3] relative shrink-0 overflow-hidden group">
        {/* Rarity Badge */}
        <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
          <div className="px-2 py-0.5 sm:px-3 sm:py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
            <span className="text-[8px] sm:text-[10px] font-black italic uppercase tracking-widest text-orange-500">
              {template.rarity}
            </span>
          </div>
          {userProfile.activeFanzId !== fanz.id ? (
            <button
              onClick={handleSetActiveFanz}
              className="px-2 py-0.5 sm:px-3 sm:py-1 bg-orange-500/20 hover:bg-orange-500/40 backdrop-blur-md rounded-full border border-orange-500/50 transition-colors"
            >
              <span className="text-[8px] sm:text-[10px] font-black italic uppercase tracking-widest text-orange-500">
                Définir Actif
              </span>
            </button>
          ) : (
            <div className="px-2 py-0.5 sm:px-3 sm:py-1 bg-green-500/20 backdrop-blur-md rounded-full border border-green-500/50">
              <span className="text-[8px] sm:text-[10px] font-black italic uppercase tracking-widest text-green-500">
                FANZ Actif
              </span>
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/40 to-transparent z-10 pointer-events-none"></div>

        {currentVideoUrl ? (
          <OptimizedMedia
            type="video"
            src={currentVideoUrl}
            poster={currentImageUrl || undefined}
            dataSaver={userProfile.dataSaver}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <OptimizedMedia
            type="image"
            src={currentImageUrl || ""}
            alt={equippedSkinData?.name || fanz.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}

        {/* Superimposed Info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex items-end justify-between">
          <div className="flex-1">
            <h1
              onClick={() => setActiveTab("stats")}
              className="text-lg sm:text-2xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] cursor-pointer hover:text-orange-500 transition-colors"
            >
              {equippedSkinData?.name || fanz.name}
            </h1>

            {template.battleCry && (
              <p className="text-[8px] sm:text-xs font-black italic uppercase tracking-wider text-orange-400 drop-shadow-md mb-1 animate-pulse">
                "{template.battleCry}"
              </p>
            )}

            {activeAction && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-[10px] sm:text-sm font-black italic uppercase tracking-tighter text-orange-500 drop-shadow-md">
                  {activeAction.name}
                </p>
              </div>
            )}

            {!activeAction && (
              <p className="text-[8px] sm:text-[10px] sm:text-xs font-medium text-gray-300 mt-1 max-w-[80%] line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {template.shortDescription || template.description}
              </p>
            )}

            {equippedSkinData && (() => {
              const isDuplicatedName = equippedSkinData.name.trim().toLowerCase() === (fanz.name || '').trim().toLowerCase();
              return (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-1">
                  {!isDuplicatedName && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
                      Skin: {equippedSkinData.name}
                    </div>
                  )}
                  {equippedSkinData.energyBonus ? (
                    <div className="bg-blue-500/20 backdrop-blur-md border border-blue-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-blue-400 flex items-center gap-1 shadow-sm">
                      <Zap className="w-2.5 h-2.5" /> +
                      {equippedSkinData.energyBonus} ENER Max
                    </div>
                  ) : null}
                  {equippedSkinData.moneyBonus ? (
                    <div className="bg-yellow-500/20 backdrop-blur-md border border-yellow-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-yellow-400 shadow-sm">
                      +{equippedSkinData.moneyBonus}% CRÉDITS
                    </div>
                  ) : null}
                  {equippedSkinData.fervorBonus ? (
                    <div className="bg-orange-500/20 backdrop-blur-md border border-orange-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-orange-400 shadow-sm">
                      +{equippedSkinData.fervorBonus}% FERV
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3">
              {/* Jauge Ferveur */}
              {(() => {
                const nextStep = ferveurPath.find(
                  (l) => (fanz.ferveurPoints || 0) < l.pointsRequired,
                );
                const nextLevelPoints =
                  nextStep?.pointsRequired ||
                  (ferveurPath.length > 0
                    ? ferveurPath[ferveurPath.length - 1].pointsRequired
                    : 1000);
                const currentPoints = fanz.ferveurPoints || 0;
                const prevStep = ferveurPath
                  .filter((l) => l.pointsRequired <= currentPoints)
                  .pop();
                const prevPoints = prevStep ? prevStep.pointsRequired : 0;

                const progressPercent = nextStep
                  ? ((currentPoints - prevPoints) /
                      (nextLevelPoints - prevPoints)) *
                    100
                  : 100;

                return (
                  <div
                    onClick={() => setActiveTab("ferveur")}
                    className="flex flex-col gap-1 w-24 sm:w-28 cursor-pointer select-none"
                  >
                    <div className="flex justify-between items-center text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-orange-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      <span>Ferveur</span>
                      <span>{currentPoints}/{nextLevelPoints}</span>
                    </div>
                    <div className="h-2.5 bg-black/60 rounded-full border border-white/15 relative overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500 relative"
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-[scan_2s_ease-in-out_infinite]" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Jauge Aptitudes / Compétences */}
              {(() => {
                const stats = (fanz.stats || {}) as any;
                const getStatLvl = (xp: number) => Math.min(10, Math.floor((xp || 1) / 100) + 1);
                const totalLevels = 
                  getStatLvl(stats.force) +
                  getStatLvl(stats.endurance) +
                  getStatLvl(stats.mental) +
                  getStatLvl(stats.bluff) +
                  getStatLvl(stats.creativity) +
                  getStatLvl(stats.social) +
                  getStatLvl(stats.intelligence) +
                  getStatLvl(stats.charisma);
                return (
                  <div
                    onClick={() => setActiveTab("stats")}
                    className="flex flex-col gap-1 w-24 sm:w-28 cursor-pointer select-none"
                  >
                    <div className="flex justify-between items-center text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      <span>Stats</span>
                      <span>{totalLevels}/80</span>
                    </div>
                    <div className="h-2.5 bg-black/60 rounded-full border border-white/15 relative overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500 relative"
                        style={{ width: `${Math.min(100, Math.max(12, (totalLevels / 80) * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Jauge Rang */}
              {(() => {
                const rank = fanz.rank ?? 1;
                return (
                  <div
                    onClick={() => setActiveTab("rank")}
                    className="flex flex-col gap-1 w-24 sm:w-28 cursor-pointer select-none"
                  >
                    <div className="flex justify-between items-center text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-rose-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      <span>Rang</span>
                      <span>{rank}/10</span>
                    </div>
                    <div className="h-2.5 bg-black/60 rounded-full border border-white/15 relative overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500 relative"
                        style={{ width: `${Math.min(100, Math.max(10, (rank / 10) * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex justify-center mt-[10px] px-5">
        <div className="flex w-full gap-0.5 p-1 bg-white/5 rounded-xl border border-white/10">
          <TabButton
            active={activeTab === "infos"}
            onClick={() => setActiveTab("infos")}
            label="Infos"
            icon={<Info className="w-4 h-4" />}
          />
          <TabButton
            active={activeTab === "stats"}
            onClick={() => setActiveTab("stats")}
            label="Stats"
            icon={<Activity className="w-4 h-4" />}
          />
          <TabButton
            active={activeTab === "ferveur"}
            onClick={() => setActiveTab("ferveur")}
            label="Ferveur"
            icon={<Flame className="w-4 h-4" />}
            hasAlert={hasClaimableFerveur}
          />
          <TabButton
            active={activeTab === "rank"}
            onClick={() => setActiveTab("rank")}
            label="Rang"
            icon={<Trophy className="w-4 h-4" />}
          />
          <TabButton
            active={activeTab === "cards"}
            onClick={() => setActiveTab("cards")}
            label="Deck"
            icon={<Database className="w-4 h-4" />}
          />
          <TabButton
            active={activeTab === "skins"}
            onClick={() => setActiveTab("skins")}
            label="Skins"
            icon={<Users className="w-4 h-4" />}
          />
          <TabButton
            active={activeTab === "emotes"}
            onClick={() => setActiveTab("emotes")}
            label="Emotes"
            icon={<MessageCircle className="w-4 h-4" />}
          />
        </div>
      </div>

      <div className="py-6 px-5 space-y-6">
        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === "stats" && (
            <div className="space-y-6">
              {/* Active Action Banner */}
              {userProfile.activeAction?.fanzId === fanz.id ? (
                <div className="mb-6 flex justify-center w-full">
                  {lifeActions
                    .filter((a) => a.id === userProfile.activeAction?.actionId)
                    .map((action) => (
                      <div key={action.id} className="w-full max-w-[500px]">
                        <LifeActionCard
                          key={action.id}
                          action={action}
                          fanz={fanz}
                          userProfile={userProfile}
                          fanzTemplate={template}
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <>
                  <div className="bg-white/5 border border-white/10 text-center rounded-2xl p-4 text-xs sm:text-sm font-medium text-gray-300 shadow-inner">
                    <span className="text-white font-black uppercase tracking-widest text-[10px] sm:text-xs inline-block mb-1">
                      Entraînez votre Fanz !
                    </span>
                    <br />
                    Réalisez des actions{" "}
                    <strong className="text-orange-500 font-black italic">
                      LIFE
                    </strong>{" "}
                    pour accumuler de l'expérience et renforcer les statistiques
                    de votre{" "}
                    <strong className="text-orange-500 font-black italic">
                      FANZ
                    </strong>{" "}
                    pour les{" "}
                    <strong className="text-white font-black italic">
                      DUELS
                    </strong>
                    .<br />
                    Certaines actions vous rapportent également de l'argent, des
                    boosts ou des gemmes !
                  </div>

                  <Card className="p-0 overflow-hidden">
                    <h3 className="text-lg font-black italic uppercase tracking-tighter px-6 pt-6 mb-4">
                      Actions LIFE
                    </h3>

                    <div className="relative w-full pb-6">
                      {/* Left Scroll Button */}
                      <button
                        onClick={() => scroll("left")}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div
                        ref={scrollContainerRef}
                        className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                      >
                        <div className="flex flex-nowrap w-full">
                          {lifeActions
                            .filter((action) => {
                              const isTemplateMatch =
                                action.fanzTemplateId === template.id ||
                                !action.fanzTemplateId;
                              const isSkinMatch =
                                !action.skinId ||
                                action.skinId === fanz.equippedSkin;
                              const isSpecialAction =
                                action.id === equippedSkinData?.specialActionId;
                              return (
                                (isTemplateMatch && isSkinMatch) ||
                                isSpecialAction
                              );
                            })
                            .reduce((acc, action) => {
                              // Find if there's already an action with the same name in the accumulator
                              const existingIdx = acc.findIndex(
                                (a) => a.name === action.name,
                              );
                              if (existingIdx !== -1) {
                                // If the current action is skin-specific and the existing one is generic, override it
                                if (action.skinId && !acc[existingIdx].skinId) {
                                  acc[existingIdx] = action;
                                }
                                // Otherwise, if existing is skin-specific and current is generic, keep existing (do nothing)
                              } else {
                                acc.push(action);
                              }
                              return acc;
                            }, [] as LifeAction[])
                            .filter(
                              (action) =>
                                action.id !==
                                userProfile.activeAction?.actionId,
                            )
                            .sort((a, b) => {
                              // Put linked actions first
                              const isALinked = Object.values(
                                template.lifeActionIds || {},
                              ).includes(a.id);
                              const isBLinked = Object.values(
                                template.lifeActionIds || {},
                              ).includes(b.id);
                              if (isALinked && !isBLinked) return -1;
                              if (!isALinked && isBLinked) return 1;
                              return 0;
                            })
                            .map((action) => (
                              <div
                                key={action.id}
                                className="snap-center shrink-0 w-full"
                              >
                                <LifeActionCard
                                  action={action}
                                  fanz={fanz}
                                  userProfile={userProfile}
                                  fanzTemplate={template}
                                />
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Right Scroll Button */}
                      <button
                        onClick={() => scroll("right")}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(statLabels).map(([stat, label]) => {
                      const xp =
                        fanz.stats[stat as keyof typeof statLabels] || 1;
                      const calculatedLevel = Math.floor(xp / 100) + 1;
                      const level = Math.min(10, calculatedLevel);
                      const bonusLevel =
                        equippedSkinData?.statsBonus?.[
                          stat as keyof NonNullable<
                            typeof equippedSkinData
                          >["statsBonus"]
                        ] || 0;
                      const totalLevel = level + bonusLevel;
                      const currentXp = level >= 10 ? 100 : xp % 100;
                      const progress =
                        level >= 10 ? 100 : (currentXp / 100) * 100;

                      const linkedActionId = template.lifeActionIds?.[stat];
                      const linkedAction = linkedActionId
                        ? lifeActions.find((a) => a.id === linkedActionId)
                        : null;

                      return (
                        <Card
                          key={stat}
                          className="p-4 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group/stat"
                        >
                          <div className="flex items-center gap-3 w-full justify-center">
                            <div className="p-2.5 bg-white/5 rounded-full">
                              {statIcons[stat as keyof typeof statIcons]}
                            </div>
                            <div className="text-left">
                              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-tight">
                                {label}
                              </div>
                              <div className="text-lg sm:text-xl font-black leading-tight flex items-center gap-1">
                                Niv. {totalLevel}
                                {bonusLevel > 0 && (
                                  <span className="text-[10px] text-blue-400">
                                    +{bonusLevel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="w-full mt-1">
                            {linkedAction && (
                              <div className="flex items-center justify-center gap-1 mb-2">
                                <Activity className="w-3 h-3 text-orange-500" />
                                <span
                                  className="text-[9px] text-orange-400 font-bold uppercase truncate max-w-[120px] sm:max-w-[150px]"
                                  title={linkedAction.name}
                                >
                                  {linkedAction.name}
                                </span>
                              </div>
                            )}
                            <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden relative border border-white/10">
                              <div
                                className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-black text-white drop-shadow-md">
                                  {currentXp} / 100 XP
                                </span>
                              </div>
                            </div>

                            <p className="text-[10px] font-bold text-gray-400 mt-2 bg-white/5 p-1.5 rounded border border-white/5 leading-snug">
                              {statDuelDescriptions[stat as keyof typeof statDuelDescriptions]}
                            </p>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "ferveur" && (
            <div className="flex flex-col gap-6 pb-20">
              <div className="text-center mb-2">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white drop-shadow-md flex items-center justify-center gap-2">
                  <Flame className="w-6 h-6 text-orange-500" />
                  Chemin de Ferveur
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-1">
                  Joue avec {fanz.name} pour débloquer ces récompenses !
                </p>
              </div>

              {/* Next Reward Highlight */}
              {(() => {
                const nextStep = ferveurPath.find(
                  (l) => (fanz.ferveurPoints || 0) < l.pointsRequired,
                );
                if (!nextStep) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-2"
                  >
                    <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-2xl p-4 sm:p-6 flex items-center justify-between shadow-[0_0_30px_rgba(249,115,22,0.25)] relative overflow-hidden">
                      <div className="absolute -right-10 -top-10 w-48 h-48 bg-orange-500/30 blur-[60px] rounded-full" />

                      <div className="z-10">
                        <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-orange-400 mb-1 flex items-center gap-1">
                          <Star className="w-3 h-3 sm:w-4 sm:h-4" /> Prochain
                          Objectif
                        </div>
                        <div className="text-2xl sm:text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_2px_10px_rgba(249,115,22,0.8)]">
                          {nextStep.pointsRequired.toLocaleString()} PTS
                        </div>
                        {!nextStep.isIntermediate && (
                          <div className="text-sm sm:text-base text-orange-300 font-bold uppercase tracking-widest mt-1">
                            Palier {nextStep.displayLevel || nextStep.level}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 z-10">
                        <div className="text-right">
                          <div className="text-lg sm:text-2xl font-black italic uppercase text-green-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {[
                              "money",
                              "gems",
                              "boost",
                              "energy",
                              "xp",
                            ].includes(nextStep.reward?.type || "")
                              ? `+${nextStep.reward?.amount} ${nextStep.reward?.type === "money" ? "$" : nextStep.reward?.type}`
                              : nextStep.reward?.type === "skin"
                                ? "Skin"
                                : nextStep.reward?.type === "emote"
                                  ? "Emote"
                                  : nextStep.reward?.type === "card"
                                    ? "Carte"
                                    : nextStep.reward?.type === "action"
                                      ? "Action"
                                      : nextStep.reward?.type}
                          </div>
                        </div>
                        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-black/50 border-2 border-orange-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.3)] overflow-hidden">
                          {nextStep.reward?.type === "money" ? (
                            <img
                              src={LOGOS.money}
                              alt="Money"
                              className="w-10 h-10 sm:w-16 sm:h-16 object-contain"
                            />
                          ) : nextStep.reward?.type === "gems" ? (
                            <img
                              src={LOGOS.gems}
                              alt="Gems"
                              className="w-10 h-10 sm:w-16 sm:h-16 object-contain"
                            />
                          ) : (
                            <Gift className="w-8 h-8 sm:w-12 sm:h-12 text-orange-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Progress Tracker (Neon) */}
              <div
                className="px-2 relative cursor-pointer group"
                onClick={() => {
                  const nextStep = ferveurPath.find(
                    (l) => (fanz.ferveurPoints || 0) < l.pointsRequired,
                  );
                  if (nextStep) {
                    const el = document.getElementById(
                      `fanz-ferveur-node-${nextStep.pointsRequired}`,
                    );
                    if (el)
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                  } else if (ferveurPath.length > 0) {
                    const el = document.getElementById(
                      `fanz-ferveur-node-${ferveurPath[ferveurPath.length - 1].pointsRequired}`,
                    );
                    if (el)
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                  }
                }}
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors rounded-xl -m-2 opacity-0 group-hover:opacity-100 pointer-events-none" />
                <div className="flex justify-between items-end mb-2 relative z-10">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-300 transition-colors">
                    Ma progression
                  </h3>
                  <span className="text-sm font-black text-orange-400 group-hover:text-orange-300 transition-colors">
                    {(fanz.ferveurPoints || 0).toLocaleString()}{" "}
                    <span className="text-xs text-orange-500/50">
                      / {maxFerveurPoints.toLocaleString()} PTS
                    </span>
                  </span>
                </div>
                <div className="h-4 w-full bg-gray-900/80 rounded-full overflow-hidden border border-gray-800 relative z-10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, ((fanz.ferveurPoints || 0) / maxFerveurPoints) * 100))}%`,
                    }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-700 via-orange-500 to-yellow-500 shadow-[0_0_15px_rgba(249,115,22,0.6)] rounded-full"
                  />
                  {/* Pattern overlay on progress */}
                  <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
                </div>
              </div>

              {/* Vertical Path */}
              <div className="relative mt-8 px-4">
                {/* Progress Bar Container */}
                <div
                  className="absolute left-1/2 top-0 bottom-0 w-6 sm:w-8 bg-gray-900 border-x border-white/10 -translate-x-1/2 rounded-full overflow-hidden cursor-pointer shadow-inner"
                  onClick={() => {
                    const nextStep = ferveurPath.find(
                      (l) => (fanz.ferveurPoints || 0) < l.pointsRequired,
                    );
                    if (nextStep) {
                      const el = document.getElementById(
                        `fanz-ferveur-node-${nextStep.pointsRequired}`,
                      );
                      if (el)
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }
                  }}
                  title="Cliquez pour aller à votre progression"
                >
                  {/* Active Neon Progress Line */}
                  <div
                    className="w-full bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_30px_rgba(249,115,22,1)] rounded-full transition-all duration-1000 relative"
                    style={{
                      height: `${generateProgressHeight()}%`,
                    }}
                  >
                    <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
                  </div>
                  {/* Pattern for empty part */}
                  <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
                </div>

                <div className="space-y-32 sm:space-y-40 relative">
                  {ferveurPath.length > 0 ? (
                    ferveurPath.map((step, idx) => {
                      const isUnlocked =
                        (fanz.ferveurPoints || 0) >= step.pointsRequired;
                      const slotId = step.isIntermediate
                        ? `ferveur-inter-${step.id || step.pointsRequired}`
                        : `ferveur-level-${step.level}`;
                      const isClaimed = fanz.claimedRewards?.includes(slotId);
                      const isLeft = idx % 2 === 0;
                      const nextStep = ferveurPath.find(
                        (l) => (fanz.ferveurPoints || 0) < l.pointsRequired,
                      );
                      const isCurrentTarget =
                        nextStep?.pointsRequired === step.pointsRequired;

                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 50 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-50px" }}
                          transition={{ duration: 0.5, delay: idx * 0.05 }}
                          key={idx}
                          id={`fanz-ferveur-node-${step.pointsRequired}`}
                          className="relative flex items-center justify-center"
                        >
                          {/* Milestone Node */}
                          <div className="relative z-10 w-full flex justify-center">
                            <div
                              className={`relative rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                                step.isIntermediate
                                  ? "w-16 h-16 sm:w-20 sm:h-20 rotate-45 overflow-hidden"
                                  : "w-24 h-24 sm:w-32 sm:h-32 overflow-hidden"
                              } ${
                                isClaimed
                                  ? "bg-green-900/40 border-green-500 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.3)]"
                                  : isUnlocked
                                    ? "bg-orange-600 border-orange-300 text-white shadow-[0_0_40px_rgba(249,115,22,0.8)]"
                                    : isCurrentTarget
                                      ? "bg-gray-900 border-orange-500/50 text-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-[pulse_2s_ease-in-out_infinite]"
                                      : "bg-[#111] border-white/10 text-gray-600"
                              }`}
                            >
                              <div
                                className={
                                  step.isIntermediate
                                    ? "-rotate-45 block w-full h-full"
                                    : "w-full h-full"
                                }
                              >
                                {(() => {
                                  if (isClaimed)
                                    return (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Check
                                          className={
                                            step.isIntermediate
                                              ? "w-8 h-8 sm:w-10 sm:h-10"
                                              : "w-12 h-12 sm:w-16 sm:h-16"
                                          }
                                        />
                                      </div>
                                    );
                                  if (step.reward?.type === "money")
                                    return (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <img
                                          src={LOGOS.money}
                                          alt="Money"
                                          className={`${step.isIntermediate ? "w-10 h-10 sm:w-12 sm:h-12" : "w-14 h-14 sm:w-20 sm:h-20"} object-contain drop-shadow-lg`}
                                        />
                                      </div>
                                    );
                                  if (step.reward?.type === "gems")
                                    return (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <img
                                          src={LOGOS.gems}
                                          alt="Gems"
                                          className={`${step.isIntermediate ? "w-10 h-10 sm:w-12 sm:h-12" : "w-14 h-14 sm:w-20 sm:h-20"} object-contain drop-shadow-lg`}
                                        />
                                      </div>
                                    );

                                  if (
                                    step.reward?.type === "skin" &&
                                    step.reward?.skinId
                                  ) {
                                    const skin = template?.skins?.find(
                                      (s) => s.id === step.reward?.skinId,
                                    );
                                    if (skin) {
                                      return (
                                        <div className="w-full h-full rounded-[inherit] overflow-hidden">
                                          <OptimizedMedia
                                            type={
                                              skin.videoUrl ? "video" : "image"
                                            }
                                            src={
                                              skin.videoUrl ||
                                              skin.imageUrl ||
                                              null
                                            }
                                            poster={skin.imageUrl}
                                            className="w-full h-full object-cover scale-[1.2]"
                                            autoPlay
                                            loop
                                          />
                                        </div>
                                      );
                                    }
                                  } else if (
                                    step.reward?.type === "emote" &&
                                    step.reward?.emoteId
                                  ) {
                                    const emote = template?.emotes?.find(
                                      (e) => e.id === step.reward?.emoteId,
                                    );
                                    if (emote) {
                                      return (
                                        <div className="w-full h-full rounded-[inherit] overflow-hidden p-2 flex items-center justify-center bg-black/40">
                                          <OptimizedMedia
                                            type={
                                              emote.videoUrl ? "video" : "image"
                                            }
                                            src={
                                              emote.videoUrl ||
                                              emote.imageUrl ||
                                              null
                                            }
                                            poster={emote.imageUrl}
                                            className="w-full h-full object-contain"
                                            autoPlay
                                            loop
                                          />
                                        </div>
                                      );
                                    }
                                  } else if (
                                    step.reward?.type === "card" &&
                                    step.reward?.cardId
                                  ) {
                                    const card = allCards.find(
                                      (c) => c.id === step.reward?.cardId,
                                    );
                                    if (card?.imageUrl) {
                                      return (
                                        <div className="w-full h-full rounded-[inherit] overflow-hidden p-1 sm:p-2 bg-black/40">
                                          <img
                                            src={card.imageUrl}
                                            className="w-full h-full object-cover rounded-[inherit] border border-white/20"
                                          />
                                        </div>
                                      );
                                    }
                                  } else if (
                                    step.reward?.type === "action" &&
                                    step.reward?.actionId
                                  ) {
                                    const action = lifeActions.find(
                                      (a) => a.id === step.reward?.actionId,
                                    );
                                    let resolvedImg = action?.image;
                                    if (
                                      action &&
                                      fanz.equippedSkin &&
                                      action.skinOverrides &&
                                      action.skinOverrides[fanz.equippedSkin]
                                        ?.image
                                    ) {
                                      resolvedImg =
                                        action.skinOverrides[fanz.equippedSkin]
                                          .image;
                                    }
                                    if (resolvedImg) {
                                      return (
                                        <div className="w-full h-full rounded-[inherit] overflow-hidden p-1 sm:p-2 bg-black/40">
                                          <img
                                            src={resolvedImg}
                                            className="w-full h-full object-cover rounded-[inherit] border border-white/20"
                                          />
                                        </div>
                                      );
                                    }
                                  }

                                  return (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Trophy
                                        className={
                                          step.isIntermediate
                                            ? "w-8 h-8 sm:w-10 sm:h-10"
                                            : "w-12 h-12 sm:w-16 sm:h-16"
                                        }
                                      />
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Points Label */}
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap z-40 pointer-events-none flex flex-col ${!isLeft ? (step.isIntermediate ? "left-[calc(50%+35px)] sm:left-[calc(50%+55px)] origin-bottom-left -rotate-[45deg] items-start" : "left-[calc(50%+50px)] sm:left-[calc(50%+75px)] items-start text-left") : step.isIntermediate ? "right-[calc(50%+35px)] sm:right-[calc(50%+55px)] origin-bottom-right rotate-[45deg] items-end" : "right-[calc(50%+50px)] sm:right-[calc(50%+75px)] items-end text-right"}`}
                          >
                            <div
                              className={`text-lg sm:text-2xl font-black italic uppercase tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isUnlocked ? "text-orange-400" : "text-gray-500"}`}
                            >
                              {step.pointsRequired.toLocaleString()} PTS
                            </div>
                            {!step.isIntermediate && (
                              <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-400 bg-black/80 px-2 sm:px-3 py-1 rounded-full inline-block mt-1 border border-white/10 shadow-lg">
                                Palier{" "}
                                {step.displayLevel || step.level || idx + 1}
                              </div>
                            )}
                          </div>

                          {/* Reward Box */}
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 z-20 ${step.isIntermediate ? "w-[100px] sm:w-[140px]" : "w-[120px] sm:w-[180px]"} ${isLeft ? (step.isIntermediate ? "right-[calc(50%+25px)] sm:right-[calc(50%+45px)]" : "right-[calc(50%+35px)] sm:right-[calc(50%+55px)]") : step.isIntermediate ? "left-[calc(50%+25px)] sm:left-[calc(50%+45px)]" : "left-[calc(50%+35px)] sm:left-[calc(50%+55px)]"}`}
                          >
                            <div
                              className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl border backdrop-blur-sm transition-all duration-500 bg-black/60 shadow-xl ${
                                isClaimed
                                  ? "border-green-500/20 opacity-70"
                                  : isUnlocked
                                    ? "bg-gradient-to-br from-orange-900/60 to-black/80 border-orange-500/50 shadow-[0_0_25px_rgba(249,115,22,0.25)] scale-105"
                                    : isCurrentTarget
                                      ? "bg-gray-900/90 border-orange-500/40"
                                      : "border-white/5 opacity-60"
                              }`}
                            >
                              <div className="text-center">
                                <div
                                  className={`text-sm sm:text-lg font-black italic uppercase tracking-tighter sm:mb-3 mb-1.5 drop-shadow-md ${isUnlocked && !isClaimed ? "text-green-400" : "text-gray-400"}`}
                                >
                                  {[
                                    "money",
                                    "gems",
                                    "boost",
                                    "energy",
                                    "xp",
                                  ].includes(step.reward?.type || "")
                                    ? `+${step.reward?.amount} ${step.reward?.type === "money" ? "$" : step.reward?.type}`
                                    : step.reward?.type === "skin"
                                      ? "Skin"
                                      : step.reward?.type === "emote"
                                        ? "Emote"
                                        : step.reward?.type === "card"
                                          ? "Carte"
                                          : step.reward?.type === "action"
                                            ? "Action"
                                            : step.reward?.type}
                                </div>
                                {isUnlocked && !isClaimed ? (
                                  <Button
                                    size="sm"
                                    className="w-full h-8 sm:h-10 text-xs sm:text-sm bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-black italic uppercase tracking-widest shadow-lg shadow-orange-500/25 border border-orange-400/50 px-1 sm:px-3"
                                    onClick={async () => {
                                      if (claimingReward) return;

                                      if (
                                        step.reward?.type === "choice" ||
                                        (step.reward?.type === "card" &&
                                          !step.reward.cardId) ||
                                        (step.reward?.type === "skin" &&
                                          !step.reward.skinId) ||
                                        (step.reward?.type === "emote" &&
                                          !step.reward.emoteId) ||
                                        (step.reward?.type === "action" &&
                                          !step.reward.actionId)
                                      ) {
                                        setRewardModal({
                                          isOpen: true,
                                          title: step.isIntermediate
                                            ? `Gain Intermédiaire`
                                            : `Palier Ferveur ${step.displayLevel || step.level}`,
                                          slotId,
                                          rewardType: step.reward.type as any,
                                          amount: step.reward.amount,
                                          cardId: step.reward.cardId,
                                          skinId: step.reward.skinId,
                                          emoteId: step.reward.emoteId,
                                          actionId: step.reward.actionId,
                                          step: "initial",
                                          rankNum: step.displayLevel || step.level,
                                        });
                                        return;
                                      }

                                      setClaimingReward(slotId);
                                      try {
                                        const fanzRef = doc(
                                          db,
                                          "fanz",
                                          fanz.id,
                                        );
                                        const userRef = doc(
                                          db,
                                          "users",
                                          userProfile.uid,
                                        );
                                        const newClaimed = [
                                          ...(fanz.claimedRewards || []),
                                          slotId,
                                        ];

                                        const updates: any = {
                                          claimedRewards: newClaimed,
                                        };
                                        const userUpdates: any = {};

                                        if (step.reward?.type === "money")
                                          userUpdates.money =
                                            (userProfile.money || 0) +
                                            (step.reward.amount || 0);
                                        if (step.reward?.type === "gems")
                                          userUpdates.gems =
                                            (userProfile.gems || 0) +
                                            (step.reward.amount || 0);
                                        if (step.reward?.type === "boost")
                                          userUpdates.boostPoints =
                                            (userProfile.boostPoints || 0) +
                                            (step.reward.amount || 0);
                                        if (step.reward?.type === "team_slot")
                                          userUpdates.teamSlots =
                                            (userProfile.teamSlots || 2) + 1;

                                        if (
                                          step.reward?.type === "fanz" &&
                                          step.reward.fanzId
                                        ) {
                                          const newFanzRef = doc(
                                            db,
                                            "fanz",
                                            `${userProfile.uid}_${step.reward.fanzId}`,
                                          );
                                          const newFanzDoc =
                                            await getDoc(newFanzRef);
                                          if (!newFanzDoc.exists()) {
                                            const templateDoc = await getDoc(
                                              doc(
                                                db,
                                                "fanz_templates",
                                                step.reward.fanzId,
                                              ),
                                            );
                                            if (templateDoc.exists()) {
                                              const templateData =
                                                templateDoc.data();
                                              await setDoc(newFanzRef, {
                                                id: `${userProfile.uid}_${step.reward.fanzId}`,
                                                templateId: step.reward.fanzId,
                                                ownerUid: userProfile.uid,
                                                name:
                                                  templateData.name ||
                                                  "Unknown Fanz",
                                                sport:
                                                  templateData.sport ||
                                                  "Football",
                                                imageUrl:
                                                  templateData.image || null,
                                                videoUrl:
                                                  templateData.video || null,
                                                baseExcitement:
                                                  templateData.baseExcitement ||
                                                  5,
                                                level: 1,
                                                xp: 0,
                                                rank: 1,
                                                ferveurPoints: 0,
                                                ferveurLevel: 1,
                                                energy: 100,
                                                equippedCards: [],
                                                deck: [],
                                                unlockedSkins: [],
                                                unlockedEmotes: [],
                                                stats:
                                                  templateData.baseStats || {
                                                    force: 10,
                                                    endurance: 10,
                                                    mental: 10,
                                                    bluff: 10,
                                                    creativity: 10,
                                                    social: 10,
                                                    intelligence: 10,
                                                    charisma: 10,
                                                  },
                                                createdAt:
                                                  new Date().toISOString(),
                                                updatedAt:
                                                  new Date().toISOString(),
                                              });
                                            }
                                          }
                                        }

                                        if (
                                          step.reward?.type === "xp" &&
                                          step.reward.statName
                                        ) {
                                          const newStats = { ...fanz.stats };
                                          const currentStat = newStats[step.reward.statName] || 0;
                                          newStats[step.reward.statName] = Math.min(900, currentStat + (step.reward.amount || 0));
                                          updates.stats = newStats;
                                        }
                                        if (
                                          step.reward?.type === "card" &&
                                          step.reward.cardId
                                        ) {
                                          const card = allCards.find(
                                            (c) => c.id === step.reward!.cardId,
                                          );
                                          if (
                                            card &&
                                            !(userProfile.cards || []).includes(
                                              card.id,
                                            )
                                          ) {
                                            userUpdates.cards = [
                                              ...(userProfile.cards || []),
                                              card.id,
                                            ];
                                          }
                                        }
                                        if (
                                          step.reward?.type === "skin" &&
                                          step.reward.skinId
                                        ) {
                                          const skin = template?.skins?.find(
                                            (s) => s.id === step.reward!.skinId,
                                          );
                                          if (
                                            skin &&
                                            !(
                                              fanz.unlockedSkins || []
                                            ).includes(skin.id)
                                          ) {
                                            updates.unlockedSkins = [
                                              ...(fanz.unlockedSkins || []),
                                              skin.id,
                                            ];
                                          }
                                        }
                                        if (
                                          step.reward?.type === "emote" &&
                                          step.reward.emoteId
                                        ) {
                                          const emote = template?.emotes?.find(
                                            (e) =>
                                              e.id === step.reward!.emoteId,
                                          );
                                          if (
                                            emote &&
                                            !(
                                              fanz.unlockedEmotes || []
                                            ).includes(emote.id)
                                          ) {
                                            updates.unlockedEmotes = [
                                              ...(fanz.unlockedEmotes || []),
                                              emote.id,
                                            ];
                                          }
                                        }
                                        if (
                                          step.reward?.type === "action" &&
                                          step.reward.actionId
                                        ) {
                                          if (
                                            !(
                                              fanz.unlockedActions || []
                                            ).includes(step.reward.actionId)
                                          ) {
                                            updates.unlockedActions = [
                                              ...(fanz.unlockedActions || []),
                                              step.reward.actionId,
                                            ];
                                          }
                                        }

                                        await updateDoc(fanzRef, updates);
                                        if (Object.keys(userUpdates).length > 0)
                                          await updateDoc(userRef, userUpdates);

                                        if (
                                          step.reward?.type === "money" &&
                                          step.reward.amount
                                        )
                                          await logTransaction(
                                            userProfile.uid,
                                            "money",
                                            step.reward.amount,
                                            `Récompense palier ${step.level}`,
                                          );
                                        if (
                                          step.reward?.type === "gems" &&
                                          step.reward.amount
                                        )
                                          await logTransaction(
                                            userProfile.uid,
                                            "gems",
                                            step.reward.amount,
                                            `Récompense palier ${step.level}`,
                                          );
                                        if (
                                          step.reward?.type === "boost" &&
                                          step.reward.amount
                                        )
                                          await logTransaction(
                                            userProfile.uid,
                                            "boost",
                                            step.reward.amount,
                                            `Récompense palier ${step.level}`,
                                          );

                                        setFanz({
                                          ...fanz,
                                          claimedRewards: newClaimed,
                                          stats: updates.stats || fanz.stats,
                                          unlockedSkins:
                                            updates.unlockedSkins ||
                                            fanz.unlockedSkins,
                                          unlockedEmotes:
                                            updates.unlockedEmotes ||
                                            fanz.unlockedEmotes,
                                          unlockedActions:
                                            updates.unlockedActions ||
                                            fanz.unlockedActions,
                                        });

                                        if (step.reward) {
                                          const reward = step.reward;
                                          let rewardData: any = {
                                            type: reward.type,
                                            amount: reward.amount || 1,
                                          };

                                          if (
                                            reward.type === "card" &&
                                            reward.cardId
                                          ) {
                                            const card = allCards.find(
                                              (c) => c.id === reward.cardId,
                                            );
                                            if (card) rewardData.card = card;
                                          } else if (
                                            reward.type === "skin" &&
                                            reward.skinId
                                          ) {
                                            const skin = template?.skins?.find(
                                              (s) => s.id === reward.skinId,
                                            );
                                            if (skin) rewardData.skin = skin;
                                          } else if (
                                            reward.type === "emote" &&
                                            reward.emoteId
                                          ) {
                                            const emote =
                                              template?.emotes?.find(
                                                (e) => e.id === reward.emoteId,
                                              );
                                            if (emote) rewardData.emote = emote;
                                          } else if (
                                            reward.type === "action" &&
                                            reward.actionId
                                          ) {
                                            const action = lifeActions.find(
                                              (a) => a.id === reward.actionId,
                                            );
                                            if (action)
                                              rewardData.action = action;
                                          } else if (
                                            reward.type === "xp" &&
                                            reward.statName
                                          ) {
                                            rewardData.title = `+${reward.amount} ${statLabels[reward.statName as keyof typeof statLabels]}`;
                                          }

                                          showReward(rewardData);
                                        }
                                      } catch (e) {
                                        console.error(e);
                                      }
                                      setClaimingReward(null);
                                    }}
                                  >
                                    Réclamer
                                  </Button>
                                ) : (
                                  <div
                                    className={`text-[9px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1 sm:gap-1.5 ${isClaimed ? "text-green-500/50" : "text-gray-600"}`}
                                  >
                                    {isClaimed ? (
                                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                                    ) : (
                                      <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                                    )}
                                    {isClaimed ? "RÉCUPÉRÉ" : "BLOQUÉ"}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="text-center py-20 bg-black/20 rounded-2xl border border-white/5">
                      <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-500 font-bold uppercase italic">
                        Aucun chemin de ferveur défini
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "rank" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-8">
                {Array.from({ length: 10 }).map((_, rIdx) => {
                  const rankNum = rIdx + 1;
                  const isRankUnlocked = (fanz.rank ?? 0) >= rankNum;
                  const nextRankNum = (fanz.rank ?? 0) + 1;
                  const isNextRank = rankNum === nextRankNum;
                  const slotId = `rank-${rankNum}`;
                  const customReward = template?.rankRewards?.[slotId];
                  const rankCost = template?.rankCosts?.[slotId] || {
                    money: rankNum * 1000,
                    boostPoints: rankNum * 50,
                  };
                  const costMoney = rankCost.money || 0;
                  const costBoost = rankCost.boostPoints || 0;

                  return (
                    <div key={rankNum} className="space-y-6">
                      <div
                        className={`flex items-center gap-2 ${!isRankUnlocked ? "opacity-40 grayscale" : ""}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-base font-black italic text-white">
                          {rankNum}
                        </div>
                        <h3 className="text-base font-black italic uppercase tracking-tighter text-white">
                          Rang {rankNum}
                        </h3>
                        <span className="text-[8px] font-black uppercase tracking-widest text-orange-500">
                          +{(rankNum - 1) * 2}% Ferv.
                        </span>
                        <div className="h-px flex-1 bg-white/10"></div>
                        {!isRankUnlocked && (
                          <Lock className="w-2.5 h-2.5 text-gray-500" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className={`flex justify-center ${!isRankUnlocked ? "opacity-40 grayscale" : ""}`}
                        >
                          {(() => {
                            const isClaimed =
                              fanz.claimedRewards?.includes(slotId);
                            const claimedChoice = fanz.claimedChoices?.[slotId];

                            return (
                              <button
                                disabled={!isRankUnlocked || !!claimingReward}
                                onClick={async () => {
                                  if (!isRankUnlocked || claimingReward) return;

                                  if (isClaimed) {
                                    // Show reward alert for already claimed reward
                                    if (claimedChoice) {
                                      if (
                                        claimedChoice.type === "card" &&
                                        claimedChoice.cardId
                                      ) {
                                        const card = allCards.find(
                                          (c) => c.id === claimedChoice.cardId,
                                        );
                                        if (card)
                                          showReward({
                                            type: "card",
                                            card,
                                            title: "Carte Débloquée",
                                          });
                                      } else if (
                                        claimedChoice.type === "skin" &&
                                        claimedChoice.skinId
                                      ) {
                                        const skin = allSkins.find(
                                          (s) => s.id === claimedChoice.skinId,
                                        );
                                        if (skin)
                                          showReward({
                                            type: "skin",
                                            skin,
                                            title: "Skin Débloqué",
                                          });
                                      } else if (
                                        claimedChoice.type === "emote" &&
                                        claimedChoice.emoteId
                                      ) {
                                        const emote = allEmotes.find(
                                          (e) => e.id === claimedChoice.emoteId,
                                        );
                                        if (emote)
                                          showReward({
                                            type: "emote",
                                            emote,
                                            title: "Emote Débloqué",
                                          });
                                      } else if (
                                        claimedChoice.type === "action" &&
                                        claimedChoice.actionId
                                      ) {
                                        const action = lifeActions.find(
                                          (a) =>
                                            a.id === claimedChoice.actionId,
                                        );
                                        if (action)
                                          showReward({
                                            type: "action",
                                            action,
                                            title: "Action Débloquée",
                                          });
                                      } else if (
                                        claimedChoice.type === "skill"
                                      ) {
                                        showReward({
                                          type: "xp",
                                          amount: claimedChoice.amount || 100,
                                          title: "Stat Améliorée",
                                        });
                                      }
                                    } else {
                                      // Fallback for older claimed rewards without choice info
                                      showReward({
                                        type: "xp",
                                        amount: 100,
                                        title: "Récompense Récupérée",
                                      });
                                    }
                                    return;
                                  }

                                  // If it's a simple reward (not a choice or something needing selection), claim it directly
                                  if (
                                    customReward &&
                                    ![
                                      "choice",
                                      "card",
                                      "skin",
                                      "emote",
                                      "action",
                                      "xp",
                                    ].includes(customReward.type) &&
                                    (customReward.type !== "card" ||
                                      customReward.cardId) &&
                                    (customReward.type !== "skin" ||
                                      customReward.skinId) &&
                                    (customReward.type !== "emote" ||
                                      customReward.emoteId) &&
                                    (customReward.type !== "action" ||
                                      customReward.actionId)
                                  ) {
                                    setClaimingReward(slotId);
                                    try {
                                      const fanzRef = doc(db, "fanz", fanz.id);
                                      const userRef = doc(
                                        db,
                                        "users",
                                        userProfile.uid,
                                      );
                                      const newClaimed = [
                                        ...(fanz.claimedRewards || []),
                                        slotId,
                                      ];

                                      const updates: any = {
                                        claimedRewards: newClaimed,
                                      };
                                      const userUpdates: any = {};

                                      if (customReward.type === "money")
                                        userUpdates.money =
                                          (userProfile.money || 0) +
                                          (customReward.amount || 0);
                                      if (customReward.type === "gems")
                                        userUpdates.gems =
                                          (userProfile.gems || 0) +
                                          (customReward.amount || 0);
                                      if (customReward.type === "boost")
                                        userUpdates.boostPoints =
                                          (userProfile.boostPoints || 0) +
                                          (customReward.amount || 0);
                                      if (customReward.type === "energy")
                                        userUpdates.energy = Math.min(
                                          100,
                                          (userProfile.energy || 0) +
                                            (customReward.amount || 0),
                                        );
                                      if (customReward.type === "team_slot")
                                        userUpdates.teamSlots =
                                          (userProfile.teamSlots || 2) + 1;

                                      await updateDoc(fanzRef, updates);
                                      if (Object.keys(userUpdates).length > 0)
                                        await updateDoc(userRef, userUpdates);

                                      if (
                                        customReward.type === "money" &&
                                        customReward.amount
                                      )
                                        await logTransaction(
                                          userProfile.uid,
                                          "money",
                                          customReward.amount,
                                          `Récompense Rang ${rankNum}`,
                                        );
                                      if (
                                        customReward.type === "gems" &&
                                        customReward.amount
                                      )
                                        await logTransaction(
                                          userProfile.uid,
                                          "gems",
                                          customReward.amount,
                                          `Récompense Rang ${rankNum}`,
                                        );
                                      if (
                                        customReward.type === "boost" &&
                                        customReward.amount
                                      )
                                        await logTransaction(
                                          userProfile.uid,
                                          "boost",
                                          customReward.amount,
                                          `Récompense Rang ${rankNum}`,
                                        );

                                      setFanz({
                                        ...fanz,
                                        claimedRewards: newClaimed,
                                      });

                                      showReward({
                                        type: customReward.type as any,
                                        amount: customReward.amount || 1,
                                        title: `Récompense Rang ${rankNum}`,
                                      });
                                    } catch (e) {
                                      console.error(
                                        "Error claiming rank reward:",
                                        e,
                                      );
                                    }
                                    setClaimingReward(null);
                                    return;
                                  }

                                  setRewardModal({
                                    isOpen: true,
                                    title: `Rang ${rankNum}`,
                                    rankNum,
                                    slotId,
                                    rewardType: (customReward?.type ||
                                      "choice") as any,
                                    amount: customReward?.amount || 100,
                                    cardId: customReward?.cardId,
                                    skinId: customReward?.skinId,
                                    emoteId: customReward?.emoteId,
                                    actionId: customReward?.actionId,
                                    choices: customReward?.choices,
                                    step: "initial",
                                  });
                                }}
                                className={`w-full h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative ${
                                  isClaimed
                                    ? "bg-green-500/10 border-green-500/50 text-green-500"
                                    : isRankUnlocked
                                      ? "bg-white/5 border-white/10 hover:border-orange-500 hover:bg-orange-500/5 text-gray-400 hover:text-white"
                                      : "bg-black/20 border-white/5 text-gray-600"
                                }`}
                              >
                                {isClaimed ? (
                                  <div className="flex flex-col items-center gap-1">
                                    {claimedChoice?.type === "card" && (
                                      <Layers className="w-8 h-8" />
                                    )}
                                    {claimedChoice?.type === "skin" && (
                                      <Shield className="w-8 h-8" />
                                    )}
                                    {claimedChoice?.type === "emote" && (
                                      <Smile className="w-8 h-8" />
                                    )}
                                    {claimedChoice?.type === "action" && (
                                      <Activity className="w-8 h-8" />
                                    )}
                                    {claimedChoice?.type === "skill" && (
                                      <Star className="w-8 h-8" />
                                    )}
                                    {!claimedChoice && (
                                      <Trophy className="w-8 h-8" />
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex gap-2 items-center justify-center relative w-full h-full overflow-hidden">
                                    {customReward ? (
                                      customReward.type === "money" ? (
                                        <img
                                          src={LOGOS.money}
                                          alt="Money"
                                          className="w-8 h-8 object-contain"
                                        />
                                      ) : customReward.type === "gems" ? (
                                        <img
                                          src={LOGOS.gems}
                                          alt="Gems"
                                          className="w-8 h-8 object-contain"
                                        />
                                      ) : customReward.type === "boost" ? (
                                        <img
                                          src={LOGOS.boost}
                                          alt="Boost"
                                          className="w-8 h-8 object-contain"
                                        />
                                      ) : customReward.type === "energy" ? (
                                        <img
                                          src={LOGOS.energy}
                                          alt="Energy"
                                          className="w-8 h-8 object-contain"
                                        />
                                      ) : customReward.type === "xp" ? (
                                        <img
                                          src={LOGOS.level}
                                          alt="XP"
                                          className="w-8 h-8 object-contain"
                                        />
                                      ) : customReward.type === "card" ? (
                                        customReward.cardId ? (
                                          <div className="w-16 h-16 rounded-[inherit] overflow-hidden p-1 absolute">
                                            <img
                                              src={
                                                allCards.find(
                                                  (c) =>
                                                    c.id ===
                                                    customReward.cardId,
                                                )?.imageUrl
                                              }
                                              className="w-full h-full object-cover rounded-[inherit] border border-white/20"
                                            />
                                          </div>
                                        ) : (
                                          <Layers className="w-8 h-8" />
                                        )
                                      ) : customReward.type === "skin" ? (
                                        customReward.skinId ? (
                                          (() => {
                                            const skin = allSkins.find(
                                              (s) =>
                                                s.id === customReward.skinId,
                                            );
                                            return skin ? (
                                              <div className="absolute inset-0 z-0 opacity-50">
                                                <OptimizedMedia
                                                  type={
                                                    skin.videoUrl
                                                      ? "video"
                                                      : "image"
                                                  }
                                                  src={
                                                    skin.videoUrl ||
                                                    skin.imageUrl ||
                                                    null
                                                  }
                                                  poster={skin.imageUrl}
                                                  className="w-full h-full object-cover"
                                                  autoPlay
                                                  loop
                                                  muted
                                                />
                                              </div>
                                            ) : (
                                              <Shield className="w-8 h-8" />
                                            );
                                          })()
                                        ) : (
                                          <Shield className="w-8 h-8" />
                                        )
                                      ) : customReward.type === "emote" ? (
                                        customReward.emoteId ? (
                                          (() => {
                                            const emote = allEmotes.find(
                                              (e) =>
                                                e.id === customReward.emoteId,
                                            );
                                            return emote ? (
                                              <div className="absolute inset-0 z-0 opacity-30 flex items-center justify-center pointer-events-none p-2">
                                                <OptimizedMedia
                                                  type={
                                                    emote.videoUrl
                                                      ? "video"
                                                      : "image"
                                                  }
                                                  src={
                                                    emote.videoUrl ||
                                                    emote.imageUrl ||
                                                    null
                                                  }
                                                  poster={emote.imageUrl}
                                                  className="w-full h-full object-contain"
                                                  autoPlay
                                                  loop
                                                  muted
                                                />
                                              </div>
                                            ) : (
                                              <Smile className="w-8 h-8" />
                                            );
                                          })()
                                        ) : (
                                          <Smile className="w-8 h-8" />
                                        )
                                      ) : customReward.type === "action" ? (
                                        customReward.actionId ? (
                                          (() => {
                                            const action = lifeActions.find(
                                              (a) =>
                                                a.id === customReward.actionId,
                                            );
                                            let resolvedImg = action?.image;
                                            if (
                                              action &&
                                              fanz.equippedSkin &&
                                              action.skinOverrides &&
                                              action.skinOverrides[
                                                fanz.equippedSkin
                                              ]?.image
                                            ) {
                                              resolvedImg =
                                                action.skinOverrides[
                                                  fanz.equippedSkin
                                                ].image;
                                            }
                                            return resolvedImg ? (
                                              <div className="w-16 h-16 rounded-[inherit] overflow-hidden p-1 absolute">
                                                <img
                                                  src={resolvedImg}
                                                  className="w-full h-full object-cover rounded-[inherit] border border-white/20"
                                                />
                                              </div>
                                            ) : (
                                              <Activity className="w-8 h-8" />
                                            );
                                          })()
                                        ) : (
                                          <Activity className="w-8 h-8" />
                                        )
                                      ) : customReward.type === "team_slot" ? (
                                        <div className="font-black">SLOT</div>
                                      ) : (
                                        <>
                                          <img
                                            src={LOGOS.energy}
                                            alt="Energy"
                                            className="w-5 h-5 object-contain"
                                          />
                                          <Activity className="w-5 h-5" />
                                        </>
                                      )
                                    ) : (
                                      <>
                                        <img
                                          src={LOGOS.energy}
                                          alt="Energy"
                                          className="w-5 h-5 object-contain"
                                        />
                                        <Activity className="w-5 h-5" />
                                      </>
                                    )}
                                  </div>
                                )}
                                <div className="text-center px-2">
                                  <div className="text-[9px] font-black uppercase tracking-wider leading-tight">
                                    {isClaimed ? (
                                      <>
                                        {claimedChoice?.type === "card" &&
                                          "Carte Débloquée"}
                                        {claimedChoice?.type === "skin" &&
                                          "Skin Débloqué"}
                                        {claimedChoice?.type === "emote" &&
                                          "Emote Débloqué"}
                                        {claimedChoice?.type === "action" &&
                                          "Action Débloquée"}
                                        {claimedChoice?.type === "skill" &&
                                          "Stat Améliorée"}
                                        {!claimedChoice &&
                                          "Récompense Récupérée"}
                                      </>
                                    ) : customReward ? (
                                      customReward.type === "money" ? (
                                        `${customReward.amount} Argent`
                                      ) : customReward.type === "gems" ? (
                                        `${customReward.amount} Gemmes`
                                      ) : customReward.type === "boost" ? (
                                        `${customReward.amount} Boost`
                                      ) : customReward.type === "energy" ? (
                                        `${customReward.amount} Énergie`
                                      ) : customReward.type === "xp" ? (
                                        `${customReward.amount} XP`
                                      ) : customReward.type === "card" ? (
                                        "Carte"
                                      ) : customReward.type === "skin" ? (
                                        "Skin"
                                      ) : customReward.type === "emote" ? (
                                        "Emote"
                                      ) : customReward.type === "action" ? (
                                        "Action"
                                      ) : customReward.type === "team_slot" ? (
                                        "Slot Équipe"
                                      ) : (
                                        "Récompense de Rang"
                                      )
                                    ) : (
                                      "Récompense de Rang"
                                    )}
                                  </div>
                                  {!isClaimed && isRankUnlocked && (
                                    <div className="text-[8px] font-bold text-orange-500 mt-0.5">
                                      Choisir
                                    </div>
                                  )}
                                </div>
                                {claimingReward === slotId && (
                                  <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                  </div>
                                )}
                              </button>
                            );
                          })()}
                        </div>

                        {/* Rank Up Button */}
                        {isNextRank && (
                          <div className="flex flex-col items-center justify-center gap-3 py-4 border border-white/10 bg-white/5 rounded-2xl">
                            <div className="text-center">
                              <h4 className="text-[10px] font-black italic uppercase text-orange-500 mb-1">
                                Débloquer Rang {rankNum}
                              </h4>
                              <div className="flex gap-3 justify-center">
                                {costMoney > 0 && (
                                  <div className="flex items-center gap-1 text-yellow-500 font-bold text-xs">
                                    <img
                                      src={LOGOS.money}
                                      alt="Money"
                                      className="w-3.5 h-3.5 object-contain"
                                    />
                                    {costMoney}
                                  </div>
                                )}
                                {costBoost > 0 && (
                                  <div className="flex items-center gap-1 text-blue-400 font-bold text-xs">
                                    <img
                                      src={LOGOS.boost}
                                      alt="Boost"
                                      className="w-3.5 h-3.5 object-contain"
                                    />
                                    {costBoost}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                if (
                                  userProfile.money < costMoney ||
                                  userProfile.boostPoints < costBoost
                                ) {
                                  setAlertModal({
                                    title: "Ressources insuffisantes",
                                    message:
                                      "Vous n'avez pas assez de pièces ou de points de boost pour passer au rang suivant.",
                                    type: "error",
                                  });
                                  return;
                                }
                                try {
                                  setRankingUp(true);
                                  const fanzRef = doc(db, "fanz", fanz.id);
                                  const userRef = doc(
                                    db,
                                    "users",
                                    userProfile.uid,
                                  );
                                  await updateDoc(fanzRef, { rank: rankNum });

                                  const userUpdates: any = {};
                                  if (costMoney > 0)
                                    userUpdates.money =
                                      userProfile.money - costMoney;
                                  if (costBoost > 0)
                                    userUpdates.boostPoints =
                                      userProfile.boostPoints - costBoost;

                                  if (Object.keys(userUpdates).length > 0) {
                                    await updateDoc(userRef, userUpdates);
                                  }

                                  if (costMoney > 0)
                                    await logTransaction(
                                      userProfile.uid,
                                      "money",
                                      -costMoney,
                                      `Passage Rang ${rankNum} (${fanz.name})`,
                                    );
                                  if (costBoost > 0)
                                    await logTransaction(
                                      userProfile.uid,
                                      "boost",
                                      -costBoost,
                                      `Passage Rang ${rankNum} (${fanz.name})`,
                                    );

                                  setFanz({ ...fanz, rank: rankNum });
                                  setAlertModal({
                                    title: "Rang débloqué !",
                                    message: `Félicitations ! Votre FANZ est maintenant Rang ${rankNum}.`,
                                    type: "success",
                                  });
                                } catch (e) {
                                  console.error(e);
                                } finally {
                                  setRankingUp(false);
                                }
                              }}
                              disabled={rankingUp}
                              className="w-full max-w-[140px] py-2 bg-orange-600 hover:bg-orange-500 text-white font-black italic uppercase tracking-widest text-[10px] rounded-lg transition-all shadow-lg shadow-orange-900/20 active:scale-95 disabled:opacity-50"
                            >
                              {rankingUp ? "..." : `Passer Rang ${rankNum}`}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "cards" && (
            <div className="space-y-8">
              {/* Deck Actuel */}
              <Card className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-black italic uppercase tracking-tighter">
                    Votre Deck ({fanz.equippedCards?.length || 0}/8)
                  </h3>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                    Retirer
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {allCards
                    .filter((c) => fanz.equippedCards?.includes(c.id))
                    .map((card) => {
                      const typeStyle =
                        cardTypeStyles[card.type] || cardTypeStyles.neutral;

                      return (
                        <motion.div
                          key={card.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`bg-gradient-to-br ${typeStyle.bg} border-2 ${typeStyle.border} rounded-lg relative group flex flex-col overflow-hidden aspect-[2/3]`}
                        >
                          <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm text-yellow-500 text-[6px] font-black px-1 py-0.5 rounded-full z-10 flex items-center gap-0.5">
                            <img
                              src={LOGOS.level}
                              alt="Level"
                              className="w-2 h-2 object-contain"
                            />
                            Niv.{fanz.cardProgress?.[card.id]?.level || 1}
                          </div>
                          <div
                            className={`absolute top-1 right-1 ${typeStyle.text === "text-green-500" ? "bg-green-500" : typeStyle.text === "text-red-500" ? "bg-red-500" : "bg-blue-500"} text-white text-[6px] font-black uppercase px-1 py-0.5 rounded-full z-10`}
                          >
                            {typeStyle.label}
                          </div>
                          <div className="w-full h-full overflow-hidden bg-gray-900 shrink-0 relative">
                            {card.videoUrl ? (
                              <OptimizedMedia
                                type="video"
                                src={card.videoUrl}
                                poster={card.imageUrl || undefined}
                                dataSaver={userProfile.dataSaver}
                                className="w-full h-full object-cover cursor-pointer"
                              />
                            ) : (
                              <OptimizedMedia
                                type="image"
                                src={card.imageUrl || undefined}
                                alt={card.name}
                                className="w-full h-full object-cover cursor-pointer"
                              />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCard(card.id);
                              }}
                              className="absolute bottom-1 right-1 bg-red-600 hover:bg-red-500 text-white p-1 rounded-full shadow-lg z-20 tooltip"
                              title="Retirer du deck"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  {Array.from({
                    length: 8 - (fanz.equippedCards?.length || 0),
                  }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="border-2 border-dashed border-white/10 rounded-lg aspect-[2/3] flex items-center justify-center"
                    >
                      <Database className="w-4 h-4 text-white/5" />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Toutes les Cartes */}
              <Card className="p-4">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                  <h3 className="text-base font-black italic uppercase tracking-tighter">
                    Musée de Cartes
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCardFilter("all")}
                      className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${cardFilter === "all" ? "bg-orange-500 text-white" : "bg-white/10 text-gray-400"}`}
                    >
                      Toutes
                    </button>
                    <button
                      onClick={() => setCardFilter("available")}
                      className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${cardFilter === "available" ? "bg-orange-500 text-white" : "bg-white/10 text-gray-400"}`}
                    >
                      Débloquées
                    </button>
                    <button
                      onClick={() => setCardFilter("locked")}
                      className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${cardFilter === "locked" ? "bg-orange-500 text-white" : "bg-white/10 text-gray-400"}`}
                    >
                      Verrouillées
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {allCards
                    .filter((card) => {
                      const isAllowed =
                        !card.fanzIds ||
                        card.fanzIds.length === 0 ||
                        card.fanzIds.includes(fanz.templateId);
                      const isBlocked =
                        card.blockedFanzIds &&
                        card.blockedFanzIds.includes(fanz.templateId);
                      const isSkinMatch =
                        !card.skinId || card.skinId === fanz.equippedSkin;
                      let themeMatch = true;
                      if (card.skinTheme && fanz.equippedSkin) {
                        const theme = card.skinTheme.toLowerCase();
                        if (fanz.equippedSkin.toLowerCase().includes(theme)) {
                          themeMatch = true;
                        } else {
                          const skinObj = allSkins.find(
                            (s: any) => s.id === fanz.equippedSkin,
                          );
                          themeMatch =
                            skinObj &&
                            skinObj.name &&
                            skinObj.name.toLowerCase().includes(theme);
                        }
                      } else if (card.skinTheme && !fanz.equippedSkin) {
                        themeMatch = false;
                      }
                      return (
                        isAllowed && !isBlocked && isSkinMatch && themeMatch
                      );
                    })
                    .map((card) => {
                      const requirements = card.unlockRequirements || [];
                      const hasRequirements = requirements.length > 0;
                      const metRequirements =
                        hasRequirements &&
                        requirements.every((req) => {
                          if (req.type === "skill" && req.skillName) {
                            const xp = fanz.stats[req.skillName] || 0;
                            const level = Math.min(
                              10,
                              Math.floor(xp / 100) + 1,
                            );
                            return level >= req.minLevel;
                          }
                          if (req.type === "ferveur") {
                            return fanz.ferveurLevel >= req.minLevel;
                          }
                          if (req.type === "rank") {
                            return (fanz.rank ?? 0) >= req.minLevel;
                          }
                          return true;
                        });
                      const isUnlocked =
                        userProfile.cards?.includes(card.id) ||
                        metRequirements ||
                        (!hasRequirements && card.rarity === "common");
                      const canAfford =
                        !isUnlocked &&
                        userProfile &&
                        card.price &&
                        (!card.price.money ||
                          (userProfile.money || 0) >= card.price.money) &&
                        (!card.price.gems ||
                          (userProfile.gems || 0) >= card.price.gems) &&
                        (!card.price.boostPoints ||
                          (userProfile.boostPoints || 0) >=
                            card.price.boostPoints);
                      return { card, isUnlocked, requirements, canAfford };
                    })
                    .filter(({ isUnlocked }) => {
                      if (cardFilter === "available") return isUnlocked;
                      if (cardFilter === "locked") return !isUnlocked;
                      return true;
                    })
                    .sort((a, b) => {
                      if (a.isUnlocked === b.isUnlocked) return 0;
                      return a.isUnlocked ? -1 : 1;
                    })
                    .map(({ card, isUnlocked, requirements, canAfford }) => {
                      const isEquipped = fanz.equippedCards?.includes(card.id);
                      const typeStyle =
                        cardTypeStyles[card.type] || cardTypeStyles.neutral;

                      return (
                        <motion.div
                          key={card.id}
                          whileHover={
                            isUnlocked && !isEquipped ? { scale: 1.05 } : {}
                          }
                          whileTap={
                            isUnlocked && !isEquipped ? { scale: 0.95 } : {}
                          }
                          onClick={() =>
                            setSelectedMuseumCard({
                              card,
                              isUnlocked,
                              requirements,
                              canAfford,
                            })
                          }
                          className={`relative rounded-xl transition-all flex flex-col h-full overflow-hidden cursor-pointer ${
                            isUnlocked
                              ? isEquipped
                                ? "bg-white/5 border-2 border-white/10 opacity-50 grayscale"
                                : `bg-gradient-to-br ${typeStyle.bg} border-2 ${typeStyle.border}`
                              : "bg-gradient-to-br from-gray-950 via-gray-900 to-[#1e1510] border-2 border-orange-500/45 shadow-[0_0_8px_rgba(249,115,22,0.15)] hover:border-orange-500 hover:shadow-[0_0_12px_rgba(249,115,22,0.3)] hover:scale-[1.02] transition-colors"
                          }`}
                        >
                          {isUnlocked && (
                            <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
                              <div
                                className={`${typeStyle.text === "text-green-500" ? "bg-green-500" : typeStyle.text === "text-red-500" ? "bg-red-500" : "bg-blue-500"} text-white text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase`}
                              >
                                {typeStyle.label}
                              </div>
                              <div className="bg-black/60 backdrop-blur-sm text-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <img
                                  src={LOGOS.level}
                                  alt="Level"
                                  className="w-2.5 h-2.5 object-contain"
                                />
                                Niv.{fanz.cardProgress?.[card.id]?.level || 1}
                              </div>
                            </div>
                          )}
                          {!isUnlocked && (
                            <>
                              <div className="absolute top-2 left-2 z-20 bg-gradient-to-r from-orange-600 to-amber-500 text-white text-[7px] font-black uppercase px-2 py-1 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(249,115,22,0.4)] animate-pulse">
                                <span>À BLOQUER</span>
                                <Lock className="w-2.5 h-2.5" />
                              </div>
                              <div className="absolute bottom-2 left-2 right-2 z-20 bg-black/85 backdrop-blur-md px-2 py-1 rounded-md border border-orange-500/40 text-[7px] font-black uppercase text-white tracking-widest text-center shadow-lg">
                                {card.price && card.price?.money ? (
                                  <div className="flex items-center gap-1 justify-center text-orange-400">
                                    <img
                                      src={LOGOS.money}
                                      alt="Money"
                                      className="w-2.5 h-2.5 object-contain"
                                    />
                                    {card.price.money} {canAfford ? "Acheter" : ""}
                                  </div>
                                ) : requirements.length > 0 ? (
                                  <div className="text-amber-400 text-[6.5px]">
                                    {requirements.map((req, i) => (
                                      <span key={i} className="block truncate leading-tight">
                                        {req.type === "skill" && `${statLabels[req.skillName as keyof typeof statLabels].substring(0,6)}. N.${req.minLevel}`}
                                        {req.type === "ferveur" && `Ferv. N.${req.minLevel}`}
                                        {req.type === "rank" && `Rang ${req.minLevel}`}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  "Verrouillé"
                                )}
                              </div>
                            </>
                          )}
                          <div className="w-full aspect-[3/4] overflow-hidden bg-gray-900 shrink-0 relative">
                            {card.videoUrl ? (
                              <OptimizedMedia
                                type="video"
                                src={card.videoUrl}
                                poster={card.imageUrl || undefined}
                                dataSaver={userProfile.dataSaver}
                                className="w-full h-full object-cover cursor-pointer"
                              />
                            ) : (
                              <OptimizedMedia
                                type="image"
                                src={card.imageUrl || undefined}
                                alt={card.name}
                                className="w-full h-full object-cover cursor-pointer"
                              />
                            )}
                            {isUnlocked && !isEquipped && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCard(card.id);
                                }}
                                className="absolute bottom-2 right-2 bg-green-600 hover:bg-green-500 text-white p-1.5 rounded-full shadow-lg z-20 tooltip transition-transform hover:scale-110"
                                title="Ajouter au deck"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                          <div className="p-2 flex-1 flex flex-col gap-1.5">
                            <h4
                              className={`font-black italic uppercase text-[10px] truncate ${isUnlocked ? typeStyle.text : "text-gray-400"}`}
                            >
                              {card.name}
                            </h4>

                            <div className="flex-1 flex flex-col gap-1.5">
                              <div className="flex items-center gap-1 text-[7px] font-bold text-gray-500 uppercase">
                                <span className="text-yellow-500">
                                  ⚡ {card.energyCost} Excitation
                                </span>
                              </div>

                              {isUnlocked && (
                                <>
                                  <p className="text-[6px] text-gray-300 leading-tight line-clamp-2 italic">
                                    {card.description}
                                  </p>
                                  <div className="space-y-0.5 mt-auto">
                                    {(card.effects || []).map((effect, idx) => (
                                      <div
                                        key={idx}
                                        className="text-[5px] font-bold text-gray-400 uppercase flex justify-between"
                                      >
                                        <span>
                                          {effectLabels[effect.type.toLowerCase()] ||
                                            effect.type.replace(/_/g, ' ')}
                                        </span>
                                        <span className={typeStyle.text}>
                                          {effect.value
                                            ? `+${effect.value}`
                                            : ""}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              </Card>
            </div>
          )}

          {activeTab === "skins" && (
            <div className="grid grid-cols-2 gap-3">
              {/* Default Skin */}
              <Card
                onClick={() => handleEquipSkin(undefined)}
                className={`relative overflow-hidden cursor-pointer transition-all hover:scale-105 p-0 ${!fanz.equippedSkin ? "ring-2 ring-orange-500 bg-orange-500/10" : "bg-gray-800/50"}`}
              >
                <div className="w-full aspect-[4/3] overflow-hidden bg-gray-900 pointer-events-none">
                  {template.video ? (
                    <OptimizedMedia
                      type="video"
                      src={template.video}
                      poster={template.image}
                      dataSaver={userProfile.dataSaver}
                      className="w-full h-full object-cover"
                      forceUnmuted={true}
                      muted={userProfile.isMuted}
                    />
                  ) : (
                    <OptimizedMedia
                      type="image"
                      src={template.image}
                      alt="Original"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {!fanz.equippedSkin && (
                  <div className="absolute top-2 right-2 bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full z-20">
                    Équipé
                  </div>
                )}
              </Card>

              {(template.skins || [])
                .filter(
                  (skin) =>
                    fanz.unlockedSkins?.includes(skin.id) ||
                    userProfile?.skins?.includes(skin.id) ||
                    skin.category !== "event" ||
                    skin.isActive !== false,
                )
                .sort((a, b) => {
                  const aUnlocked =
                    fanz.unlockedSkins?.includes(a.id) ||
                    userProfile?.skins?.includes(a.id);
                  const bUnlocked =
                    fanz.unlockedSkins?.includes(b.id) ||
                    userProfile?.skins?.includes(b.id);
                  if (aUnlocked === bUnlocked) return 0;
                  return aUnlocked ? -1 : 1;
                })
                .map((skin, idx) => {
                  const isUnlocked =
                    fanz.unlockedSkins?.includes(skin.id) ||
                    userProfile?.skins?.includes(skin.id);
                  const isEquipped = fanz.equippedSkin === skin.id;
                  const canAfford =
                    !isUnlocked &&
                    userProfile &&
                    (!skin.price.money ||
                      (userProfile.money || 0) >= skin.price.money) &&
                    (!skin.price.gems ||
                      (userProfile.gems || 0) >= skin.price.gems) &&
                    (!skin.price.boostPoints ||
                      (userProfile.boostPoints || 0) >= skin.price.boostPoints);

                  const rarityBorder =
                    skin.rarity === "legendary"
                      ? "border-[3px] border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]"
                      : skin.rarity === "epic"
                        ? "border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                        : skin.rarity === "rare"
                          ? "border-2 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                          : "border border-gray-600";

                  const bonusClass =
                    "h-5 sm:h-6 min-w-[70px] sm:min-w-[80px] justify-center backdrop-blur-md shadow-lg border text-white text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 flex items-center shadow-black/50 drop-shadow-md rounded-md shrink-0";

                  return (
                    <Card
                      key={`${skin.id}-${idx}`}
                      onClick={() => {
                        if (skin.isActive === false && !isUnlocked) return;
                        setPurchaseConfirm({ type: "skin", item: skin });
                      }}
                      className={`relative overflow-hidden transition-all p-0 ${skin.isActive === false && !isUnlocked ? "cursor-default" : "cursor-pointer hover:scale-105"} ${rarityBorder} ${isEquipped ? "ring-2 ring-orange-500 bg-orange-500/10" : "bg-gray-800/50"}`}
                    >
                      {skin.isActive === false && !isUnlocked && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30" onClick={(e) => e.stopPropagation()}>
                          <Lock className="w-5 h-5 text-white/50 mb-1" />
                          <div className="bg-orange-500 text-white text-[8px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
                            Bientôt dispo
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start">
                        {skin.category === "event" && (
                          <div className="backdrop-blur-sm bg-fuchsia-600 border border-fuchsia-400 font-black uppercase text-[7px] tracking-widest px-1.5 py-0.5 rounded-sm text-white shadow-[0_0_10px_rgba(192,38,211,0.5)]">
                            Événement
                          </div>
                        )}
                        {skin.rarity && (
                          <div
                            className={`px-2 py-1 rounded text-[9px] sm:text-[10px] font-black uppercase shadow-lg drop-shadow-md tracking-wider ${
                              skin.rarity === "legendary"
                                ? "bg-gradient-to-r from-yellow-600 to-yellow-400 text-black border border-yellow-200"
                                : skin.rarity === "epic"
                                  ? "bg-gradient-to-r from-purple-700 to-purple-500 text-white border border-purple-300"
                                  : skin.rarity === "rare"
                                    ? "bg-gradient-to-r from-blue-700 to-blue-500 text-white border border-blue-300"
                                    : "bg-gradient-to-r from-gray-600 to-gray-400 text-white border border-gray-300"
                            }`}
                          >
                            {skin.rarity === "legendary"
                              ? "Légendaire"
                              : skin.rarity === "epic"
                                ? "Épique"
                                : skin.rarity === "rare"
                                  ? "Rare"
                                  : "Commun"}
                          </div>
                        )}
                      </div>
                      {!isUnlocked && (
                        <>
                          <div
                            className={`absolute top-2 right-2 z-20 backdrop-blur-sm p-1.5 rounded-lg ${canAfford ? "bg-green-500/80" : "bg-black/60"}`}
                          >
                            {canAfford ? (
                              <Unlock className="w-4 h-4 text-white" />
                            ) : (
                              <Lock className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div
                            className={`absolute bottom-2 left-2 z-20 backdrop-blur-sm px-2 py-1 rounded-lg flex flex-col gap-0.5 text-[8px] font-black text-white uppercase tracking-tighter ${canAfford ? "bg-green-600/80" : "bg-black/60"}`}
                          >
                            {skin.price.money > 0 && (
                              <div className="flex items-center gap-1">
                                <img
                                  src={LOGOS.money}
                                  alt="Money"
                                  className="w-2.5 h-2.5 object-contain"
                                />
                                {skin.price.money}
                              </div>
                            )}
                            {skin.price.gems > 0 && (
                              <div className="flex items-center gap-1">
                                <img
                                  src={LOGOS.gems}
                                  alt="Gems"
                                  className="w-2.5 h-2.5 object-contain"
                                />
                                {skin.price.gems}
                              </div>
                            )}
                            {skin.price.boostPoints > 0 && (
                              <div className="flex items-center gap-1">
                                <img
                                  src={LOGOS.boost}
                                  alt="Boost"
                                  className="w-2.5 h-2.5 object-contain"
                                />
                                {skin.price.boostPoints}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      <div
                        className={`relative w-full aspect-[4/3] overflow-hidden bg-gray-900 pointer-events-none ${!isUnlocked && !canAfford ? "grayscale opacity-60" : !isUnlocked && canAfford ? "opacity-90" : ""}`}
                      >
                        {skin.videoUrl ? (
                          <OptimizedMedia
                            type="video"
                            src={skin.videoUrl}
                            poster={skin.imageUrl}
                            dataSaver={userProfile.dataSaver}
                            className="w-full h-full object-cover"
                            forceUnmuted={true}
                            muted={userProfile.isMuted}
                          />
                        ) : (
                          <OptimizedMedia
                            type="image"
                            src={skin.imageUrl}
                            alt={skin.name}
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Skin Bonuses Overlay - Icons only */}
                        {(skin.energyBonus ||
                          skin.fervorBonus ||
                          skin.moneyBonus ||
                          skin.gemsBonus ||
                          skin.boostBonus ||
                          skin.specialCardId ||
                          skin.specialActionId ||
                          skin.statsBonus) && (
                          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent flex flex-wrap justify-end content-end gap-1 h-[50%] pointer-events-none">
                            {skin.statsBonus &&
                              Object.entries(skin.statsBonus).some(
                                ([s, v]) => v > 0,
                              ) && (
                                <div className="w-5 h-5 bg-blue-600/90 rounded-full flex items-center justify-center border border-blue-400/40 shadow-lg">
                                  <Activity className="w-3 h-3 text-white" />
                                </div>
                              )}
                            {skin.energyBonus ? (
                              <div className="w-5 h-5 bg-amber-500/90 rounded-full flex items-center justify-center border border-amber-400/40 shadow-lg">
                                <img
                                  src={LOGOS.energy}
                                  alt=""
                                  className="w-3 h-3 drop-shadow-md"
                                />
                              </div>
                            ) : null}
                            {skin.fervorBonus ? (
                              <div className="w-5 h-5 bg-purple-600/90 rounded-full flex items-center justify-center border border-purple-400/40 shadow-lg">
                                <Flame className="w-3 h-3 text-white" />
                              </div>
                            ) : null}
                            {skin.moneyBonus ? (
                              <div className="w-5 h-5 bg-yellow-500/90 rounded-full flex items-center justify-center border border-yellow-300/40 shadow-lg">
                                <img
                                  src={LOGOS.money}
                                  alt=""
                                  className="w-3 h-3 drop-shadow-md"
                                />
                              </div>
                            ) : null}
                            {skin.gemsBonus ? (
                              <div className="w-5 h-5 bg-pink-500/90 rounded-full flex items-center justify-center border border-pink-300/40 shadow-lg">
                                <img
                                  src={LOGOS.gems}
                                  alt=""
                                  className="w-3 h-3 drop-shadow-md"
                                />
                              </div>
                            ) : null}
                            {skin.boostBonus ? (
                              <div className="w-5 h-5 bg-orange-500/90 rounded-full flex items-center justify-center border border-orange-400/40 shadow-lg">
                                <img
                                  src={LOGOS.boost}
                                  alt=""
                                  className="w-3 h-3 drop-shadow-md"
                                />
                              </div>
                            ) : null}
                            {skin.specialCardId ? (
                              <div className="w-5 h-5 bg-indigo-500/90 rounded-full flex items-center justify-center border border-indigo-400/40 shadow-lg">
                                <Database className="w-3 h-3 text-white" />
                              </div>
                            ) : null}
                            {skin.specialActionId ? (
                              <div className="w-5 h-5 bg-emerald-500/90 rounded-full flex items-center justify-center border border-emerald-400/40 shadow-lg">
                                <Zap className="w-3 h-3 text-white" />
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {isEquipped && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full z-20">
                          Équipé
                        </div>
                      )}
                    </Card>
                  );
                })}
            </div>
          )}

          {activeTab === "emotes" && (
            <div className="grid grid-cols-2 gap-3">
              {(template.emotes || [])
                .filter(
                  (emote) =>
                    fanz.unlockedEmotes?.includes(emote.id) ||
                    userProfile?.emotes?.includes(emote.id) ||
                    emote.category !== "event" ||
                    emote.isActive !== false,
                )
                .sort((a, b) => {
                  const aUnlocked =
                    fanz.unlockedEmotes?.includes(a.id) ||
                    userProfile?.emotes?.includes(a.id);
                  const bUnlocked =
                    fanz.unlockedEmotes?.includes(b.id) ||
                    userProfile?.emotes?.includes(b.id);
                  if (aUnlocked === bUnlocked) return 0;
                  return aUnlocked ? -1 : 1;
                })
                .map((emote, idx) => {
                  const isUnlocked =
                    fanz.unlockedEmotes?.includes(emote.id) ||
                    userProfile?.emotes?.includes(emote.id);
                  const canAfford =
                    !isUnlocked &&
                    emote.price &&
                    userProfile &&
                    (!emote.price.money ||
                      (userProfile.money || 0) >= emote.price.money) &&
                    (!emote.price.gems ||
                      (userProfile.gems || 0) >= emote.price.gems) &&
                    (!emote.price.boostPoints ||
                      (userProfile.boostPoints || 0) >=
                        emote.price.boostPoints);

                  return (
                    <Card
                      key={`${emote.id}-${idx}`}
                      onClick={() =>
                        emote.price &&
                        setPurchaseConfirm({ type: "emote", item: emote })
                      }
                      className={`relative transition-all overflow-hidden p-0 ${!isUnlocked ? "cursor-pointer hover:scale-105" : "cursor-pointer hover:scale-105"}`}
                    >
                      {emote.category === "event" && (
                        <div className="absolute top-2 left-2 z-20 backdrop-blur-sm bg-fuchsia-600 border border-fuchsia-400 font-black uppercase text-[7px] tracking-widest px-1.5 py-0.5 rounded-sm text-white shadow-[0_0_10px_rgba(192,38,211,0.5)]">
                          Événement
                        </div>
                      )}
                      {!isUnlocked && (
                        <>
                          <div
                            className={`absolute top-2 right-2 z-20 backdrop-blur-sm p-1 rounded-lg ${canAfford ? "bg-green-500/80" : "bg-black/60"}`}
                          >
                            {canAfford ? (
                              <Unlock className="w-3 h-3 text-white" />
                            ) : (
                              <Lock className="w-3 h-3 text-white" />
                            )}
                          </div>
                          {emote.price && (
                            <div
                              className={`absolute bottom-2 left-2 z-20 backdrop-blur-sm px-1.5 py-0.5 rounded-lg flex flex-col gap-0.5 text-[7px] font-black text-white uppercase tracking-tighter ${canAfford ? "bg-green-600/80" : "bg-black/60"}`}
                            >
                              {emote.price.money > 0 && (
                                <div className="flex items-center gap-0.5">
                                  <img
                                    src={LOGOS.money}
                                    alt="Money"
                                    className="w-2 h-2 object-contain"
                                  />
                                  {emote.price.money}
                                </div>
                              )}
                              {emote.price.gems > 0 && (
                                <div className="flex items-center gap-0.5">
                                  <img
                                    src={LOGOS.gems}
                                    alt="Gems"
                                    className="w-2 h-2 object-contain"
                                  />
                                  {emote.price.gems}
                                </div>
                              )}
                              {emote.price.boostPoints > 0 && (
                                <div className="flex items-center gap-0.5">
                                  <img
                                    src={LOGOS.boost}
                                    alt="Boost"
                                    className="w-2 h-2 object-contain"
                                  />
                                  {emote.price.boostPoints}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      <div
                        className={`w-full aspect-[4/3] overflow-hidden bg-gray-900 ${!isUnlocked && !canAfford ? "grayscale opacity-60" : !isUnlocked && canAfford ? "opacity-90" : ""}`}
                      >
                        {emote.videoUrl ? (
                          <OptimizedMedia
                            type="video"
                            src={emote.videoUrl}
                            poster={emote.imageUrl}
                            dataSaver={userProfile.dataSaver}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <OptimizedMedia
                            type="image"
                            src={emote.imageUrl}
                            alt={emote.name}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        )}
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}

          {activeTab === "infos" && (
            <div className="space-y-6">
              <Card className="p-4 bg-gray-800/50">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-orange-500 mb-2">
                  Histoire
                </h3>
                {template.longDescription ? (
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {template.longDescription}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Aucune histoire disponible pour ce Fanz.
                  </p>
                )}
                {template.battleCry && (
                  <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10 flex items-start gap-3">
                    <MessageCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-black uppercase text-gray-500 mb-1">
                        Cri de guerre
                      </div>
                      <div className="text-sm font-bold italic text-white">
                        « {template.battleCry} »
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {template.specialAttackIds &&
                template.specialAttackIds.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-base font-black italic uppercase tracking-tighter flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      Attaques Spéciales
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {template.specialAttackIds.map((cardId) => {
                        const card = allCards.find((c) => c.id === cardId);
                        if (!card) return null;

                        const requirements = card.unlockRequirements || [];
                        const hasRequirements = requirements.length > 0;
                        const metRequirements =
                          hasRequirements &&
                          requirements.every((req: any) => {
                            if (req.type === "skill" && req.skillName) {
                              const xp = fanz.stats[req.skillName] || 0;
                              const level = Math.min(
                                10,
                                Math.floor(xp / 100) + 1,
                              );
                              return level >= req.minLevel;
                            }
                            if (req.type === "ferveur") {
                              return fanz.ferveurLevel >= req.minLevel;
                            }
                            if (req.type === "rank") {
                              return (fanz.rank ?? 0) >= req.minLevel;
                            }
                            return true;
                          });
                        const isUnlocked =
                          userProfile.cards?.includes(card.id) ||
                          metRequirements ||
                          (!hasRequirements && card.rarity === "common");
                        const canAfford =
                          !isUnlocked &&
                          userProfile &&
                          card.price &&
                          (!card.price.money ||
                            (userProfile.money || 0) >= card.price.money) &&
                          (!card.price.gems ||
                            (userProfile.gems || 0) >= card.price.gems) &&
                          (!card.price.boostPoints ||
                            (userProfile.boostPoints || 0) >=
                              card.price.boostPoints);

                        return (
                          <div
                            key={card.id}
                            onClick={() =>
                              setSelectedMuseumCard({
                                card,
                                isUnlocked,
                                requirements,
                                canAfford,
                              })
                            }
                            className={`group relative aspect-[2/3] max-w-[200px] w-full mx-auto bg-gray-800 rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-[1.03] select-none ${
                              isUnlocked
                                ? "border-white/10 hover:border-orange-500/50"
                                : "border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.15)] hover:border-orange-500 hover:shadow-[0_0_12px_rgba(249,115,22,0.3)]"
                            }`}
                          >
                            {card.imageUrl ? (
                              <img
                                src={getImageUrl(card.imageUrl)}
                                alt={card.name}
                                className={`w-full h-full object-cover transition-opacity ${!isUnlocked ? "opacity-30 grayscale" : ""}`}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                <Database className="w-8 h-8 text-gray-500" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3">
                              <div className="flex justify-between items-end gap-2">
                                <div>
                                  <div className="text-xs font-black uppercase text-white leading-tight">
                                    {card.name}
                                  </div>
                                  <div
                                    className={`text-[8px] font-bold uppercase mt-0.5 ${
                                      card.type === "bonus"
                                        ? "text-green-500"
                                        : card.type === "malus"
                                          ? "text-red-500"
                                          : "text-blue-500"
                                    }`}
                                  >
                                    {card.type} • {card.rarity}
                                  </div>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[8px] font-black">
                                    {card.energyCost}
                                  </div>
                                  <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[8px] font-black">
                                    {card.fervorValue}
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-300 mt-2 line-clamp-2 leading-tight">
                                {card.description}
                              </p>
                            </div>

                            {/* Locked overlay info */}
                            {!isUnlocked && (
                              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-2 text-center group-hover:bg-black/30 transition-colors">
                                <Lock className="w-7 h-7 text-orange-400 mb-1 drop-shadow-md animate-pulse" />
                                <div className="text-[8px] font-black uppercase text-orange-400 tracking-wider drop-shadow-md">
                                  Bloqué - Acheter
                                </div>
                                {card.price && (
                                  <div className="mt-1 bg-black/85 px-1.5 py-0.5 rounded border border-white/10 flex flex-wrap justify-center gap-1 shadow-md max-w-full">
                                    {card.price.money > 0 && <div className="flex items-center gap-0.5"><span className="text-[8px] font-black text-green-300">{card.price.money}</span><img src={LOGOS.money} alt="$" className="w-2.5 h-2.5" /></div>}
                                    {card.price.gems > 0 && <div className="flex items-center gap-0.5"><span className="text-[8px] font-black text-blue-300">{card.price.gems}</span><img src={LOGOS.gems} alt="Gemmes" className="w-2.5 h-2.5" /></div>}
                                    {card.price.boostPoints > 0 && <div className="flex items-center gap-0.5"><span className="text-[8px] font-black text-orange-300">{card.price.boostPoints}</span><span className="text-[8px]">🚀</span></div>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Alert Modal */}
      {/* Fullscreen Card Modal */}
      <AnimatePresence>
        {selectedMuseumCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto"
          >
            <div className="min-h-full max-w-sm mx-auto flex flex-col p-4">
              <div className="flex justify-end mb-4 pt-2">
                <button
                  onClick={() => setSelectedMuseumCard(null)}
                  className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col gap-6 my-auto">
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="relative w-full aspect-[3/4] max-h-[50vh] mx-auto flex-shrink-0"
                >
                  {selectedMuseumCard.card.imageUrl ? (
                    <img
                      src={getImageUrl(selectedMuseumCard.card.imageUrl)}
                      alt={selectedMuseumCard.card.name}
                      className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={`w-full h-full rounded-2xl flex flex-col items-center justify-center bg-gradient-to-br ${cardTypeStyles[selectedMuseumCard.card.type]?.bg || "from-gray-800 to-gray-900"} border-4 ${cardTypeStyles[selectedMuseumCard.card.type]?.border || "border-gray-700"}`}
                    >
                      <Zap className="w-24 h-24 mb-6 opacity-50" />
                      <h3 className="text-3xl font-black italic uppercase text-center px-4">
                        {selectedMuseumCard.card.name}
                      </h3>
                    </div>
                  )}

                  {!selectedMuseumCard.isUnlocked && (
                    <div className="absolute top-4 left-4 z-20 bg-gradient-to-r from-orange-600 to-amber-500 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse">
                      <span>À DÉBLOQUER</span>
                      <Lock className="w-3.5 h-3.5" />
                    </div>

                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gray-900/80 backdrop-blur border border-white/10 p-6 rounded-3xl flex-shrink-0 mb-4"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white">
                      {selectedMuseumCard.card.name}
                    </h3>
                    <div
                      className={`${cardTypeStyles[selectedMuseumCard.card.type]?.text === "text-green-500" ? "bg-green-500" : cardTypeStyles[selectedMuseumCard.card.type]?.text === "text-red-500" ? "bg-red-500" : "bg-blue-500"} text-white text-xs font-black px-2 py-1 rounded-full uppercase`}
                    >
                      {cardTypeStyles[selectedMuseumCard.card.type]?.label ||
                        selectedMuseumCard.card.type}
                    </div>
                  </div>

                  <div className="bg-black/50 rounded-xl p-4 mb-6 border border-white/5">
                    <p className="text-sm text-gray-300 mb-4">
                      {selectedMuseumCard.card.description}
                    </p>

                    {selectedMuseumCard.card.effects &&
                      selectedMuseumCard.card.effects.length > 0 && (
                        <div className="space-y-1 mb-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">
                            Effets:
                          </span>
                          {selectedMuseumCard.card.effects.map((effect, i) => (
                            <div
                              key={i}
                              className={`text-sm font-black ${cardTypeStyles[selectedMuseumCard.card.type]?.text || "text-white"} bg-white/5 px-2 py-1 rounded uppercase tracking-wider`}
                            >
                              {effectLabels[effect.type.toLowerCase()] || effect.type.replace(/_/g, ' ')}{" "}
                              {effect.value && effect.value > 0 ? "+" : ""}
                              {effect.value !== undefined && effect.value !== 0 ? effect.value : ""}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  {!selectedMuseumCard.isUnlocked ? (
                    <div className="space-y-4">
                      {selectedMuseumCard.requirements.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                          <h4 className="text-xs font-black text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Lock className="w-4 h-4" /> Conditions requises
                          </h4>
                          <ul className="text-sm text-gray-300 space-y-1">
                            {selectedMuseumCard.requirements.map((req, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1 h-1 bg-red-400 rounded-full" />
                                {req.type === "skill" &&
                                  req.skillName &&
                                  `Compétence ${req.skillName} niv.${req.minLevel}`}
                                {req.type === "ferveur" &&
                                  `Ferveur minimale: niv.${req.minLevel}`}
                                {req.type === "rank" &&
                                  `Rang minimal: ${req.minLevel}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedMuseumCard.card.price ? (
                        <Button
                          onClick={() => {
                            setSelectedMuseumCard(null);
                            setPurchaseConfirm({
                              type: "card",
                              item: selectedMuseumCard.card,
                            });
                          }}
                          disabled={!selectedMuseumCard.canAfford}
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black uppercase py-4 text-base flex flex-col justify-center items-center shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:from-gray-700 disabled:to-gray-800"
                        >
                          <span className="flex items-center gap-1.5 leading-none">
                            {selectedMuseumCard.canAfford ? "DÉBLOQUER POUR :" : "FONDS INSUFFISANTS :"}
                          </span>
                          <span className="flex items-center gap-2 mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
                            {selectedMuseumCard.card.price?.money > 0 && <span className="flex items-center gap-0.5 text-green-300 drop-shadow-md"><span className="text-sm">{selectedMuseumCard.card.price.money}</span> <img src={LOGOS.money} alt="" className="w-3 h-3" /></span>}
                            {selectedMuseumCard.card.price?.gems > 0 && <span className="flex items-center gap-0.5 text-blue-300 drop-shadow-md"><span className="text-sm">{selectedMuseumCard.card.price.gems}</span> <img src={LOGOS.gems} alt="" className="w-3 h-3" /></span>}
                            {selectedMuseumCard.card.price?.boostPoints > 0 && <span className="flex items-center gap-0.5 text-orange-300 drop-shadow-md"><span className="text-sm">{selectedMuseumCard.card.price.boostPoints}</span> 🚀</span>}
                          </span>
                        </Button>
                      ) : (
                        selectedMuseumCard.requirements.length > 0 && (
                          <div className="bg-white/5 text-gray-400 text-center py-3 rounded-lg text-sm font-bold uppercase">
                            Ceci ne s'achète pas
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-black uppercase tracking-widest text-center py-2 rounded-xl flex flex-col items-center justify-center gap-1">
                        <Unlock className="w-4 h-4" />
                        Carte débloquée
                      </div>
                      {fanz.equippedCards?.includes(
                        selectedMuseumCard.card.id,
                      ) ? (
                        <div className="text-center text-xs font-bold text-gray-500 uppercase">
                          Déjà équipée dans votre deck
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedMuseumCard(null);
                            // It will trigger equip when they go back if we had a quick equip. But FanzDetails handles equip via drag&drop. Let's just say it's done.
                          }}
                          className="w-full bg-gray-800 text-white"
                        >
                          Fermer
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Confirmation Modal */}
      <AnimatePresence>
        {purchaseConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
            >
              <button
                onClick={() => setPurchaseConfirm(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-6">
                <h3 className="text-xl font-black italic uppercase text-white mb-4">
                  {purchaseConfirm &&
                  ((purchaseConfirm.type === "skin" &&
                    (fanz.unlockedSkins?.includes(purchaseConfirm.item.id) ||
                      userProfile?.skins?.includes(purchaseConfirm.item.id))) ||
                    (purchaseConfirm.type === "emote" &&
                      (fanz.unlockedEmotes?.includes(purchaseConfirm.item.id) ||
                        userProfile?.emotes?.includes(purchaseConfirm.item.id))) ||
                    (purchaseConfirm.type === "card" &&
                      (purchaseConfirm.item.rarity === "common" ||
                        userProfile?.cards?.includes(purchaseConfirm.item.id) ||
                        (fanz.cardProgress &&
                          fanz.cardProgress[purchaseConfirm.item.id] !==
                            undefined))))
                    ? "DÉTAILS"
                    : "Confirmer l'achat"}
                </h3>

                {/* Large Preview in Modal */}
                <div className="w-full max-w-[280px] aspect-[4/3] mx-auto mb-4 rounded-2xl overflow-hidden bg-gray-800 border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  <OptimizedMedia
                    type={purchaseConfirm.item.videoUrl ? "video" : "image"}
                    src={
                      purchaseConfirm.item.videoUrl ||
                      purchaseConfirm.item.imageUrl ||
                      null
                    }
                    poster={purchaseConfirm.item.imageUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                  />
                </div>

                {purchaseConfirm &&
                  !(
                    (purchaseConfirm.type === "skin" &&
                      (fanz.unlockedSkins?.includes(purchaseConfirm.item.id) ||
                        userProfile?.skins?.includes(purchaseConfirm.item.id))) ||
                    (purchaseConfirm.type === "emote" &&
                      (fanz.unlockedEmotes?.includes(purchaseConfirm.item.id) ||
                        userProfile?.emotes?.includes(purchaseConfirm.item.id))) ||
                    (purchaseConfirm.type === "card" &&
                      (purchaseConfirm.item.rarity === "common" ||
                        userProfile?.cards?.includes(purchaseConfirm.item.id) ||
                        (fanz.cardProgress &&
                          fanz.cardProgress[purchaseConfirm.item.id] !==
                            undefined)))
                  ) && (
                    <p className="text-sm text-gray-400">
                      Êtes-vous sûr de vouloir acheter :
                    </p>
                  )}
                <p className="text-2xl font-black italic text-orange-500 mt-1 uppercase drop-shadow-md">
                  {purchaseConfirm.item.name}
                </p>

                {purchaseConfirm.type === "skin" && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {/* Advantages */}
                    {purchaseConfirm.item.statsBonus &&
                      Object.entries(purchaseConfirm.item.statsBonus).map(
                        ([stat, val]) => {
                          const validStats = [
                            "force",
                            "mental",
                            "intelligence",
                            "creativity",
                            "bluff",
                            "social",
                            "charisma",
                            "endurance",
                          ];
                          if (val === 0 || !validStats.includes(stat))
                            return null;
                          const statMap: Record<string, string> = {
                            force: "FOR",
                            mental: "MEN",
                            intelligence: "INT",
                            creativity: "CRE",
                            bluff: "BLU",
                            social: "SOC",
                            charisma: "CHA",
                            endurance: "END",
                          };
                          return (
                            <span
                              key={stat}
                              className="bg-blue-600/90 shadow-lg border border-blue-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center"
                            >
                              +{Number(val)} {statMap[stat]}
                            </span>
                          );
                        },
                      )}
                    {purchaseConfirm.item.energyBonus ? (
                      <span className="bg-amber-500/90 shadow-lg border border-amber-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center gap-1">
                        <img
                          src={LOGOS.energy}
                          alt=""
                          className="w-3 h-3 drop-shadow-md"
                        />
                        +{purchaseConfirm.item.energyBonus} Max
                      </span>
                    ) : null}
                    {purchaseConfirm.item.fervorBonus ? (
                      <span className="bg-purple-600/90 shadow-lg border border-purple-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded">
                        +{purchaseConfirm.item.fervorBonus}% Ferv
                      </span>
                    ) : null}
                    {purchaseConfirm.item.moneyBonus ? (
                      <span className="bg-yellow-500/90 shadow-lg border border-yellow-300/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center gap-1">
                        <img
                          src={LOGOS.money}
                          alt=""
                          className="w-3 h-3 drop-shadow-md"
                        />
                        +{purchaseConfirm.item.moneyBonus}%
                      </span>
                    ) : null}
                    {purchaseConfirm.item.gemsBonus ? (
                      <span className="bg-pink-500/90 shadow-lg border border-pink-300/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center gap-1">
                        <img
                          src={LOGOS.gems}
                          alt=""
                          className="w-3 h-3 drop-shadow-md"
                        />
                        +{purchaseConfirm.item.gemsBonus}%
                      </span>
                    ) : null}
                    {purchaseConfirm.item.boostBonus ? (
                      <span className="bg-orange-500/90 shadow-lg border border-orange-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center gap-1">
                        <img
                          src={LOGOS.boost}
                          alt=""
                          className="w-3 h-3 drop-shadow-md"
                        />
                        +{purchaseConfirm.item.boostBonus}%
                      </span>
                    ) : null}

                    {/* Reductions */}
                    {purchaseConfirm.item.energyCostReduction ? (
                      <span className="bg-blue-800/90 shadow-lg border border-gray-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center gap-1">
                        -{purchaseConfirm.item.energyCostReduction}% Cout /{" "}
                        <img
                          src={LOGOS.energy}
                          alt=""
                          className="w-3 h-3 drop-shadow-md"
                        />
                      </span>
                    ) : null}
                    {purchaseConfirm.item.moneyCostReduction ? (
                      <span className="bg-yellow-800/90 shadow-lg border border-gray-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center gap-1">
                        -{purchaseConfirm.item.moneyCostReduction}% Cout /{" "}
                        <img
                          src={LOGOS.money}
                          alt=""
                          className="w-3 h-3 drop-shadow-md"
                        />
                      </span>
                    ) : null}
                    {purchaseConfirm.item.gemsCostReduction ? (
                      <span className="bg-pink-800/90 shadow-lg border border-gray-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center gap-1">
                        -{purchaseConfirm.item.gemsCostReduction}% Cout /{" "}
                        <img
                          src={LOGOS.gems}
                          alt=""
                          className="w-3 h-3 drop-shadow-md"
                        />
                      </span>
                    ) : null}
                    {purchaseConfirm.item.boostCostReduction ? (
                      <span className="bg-orange-800/90 shadow-lg border border-gray-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded flex items-center gap-1">
                        -{purchaseConfirm.item.boostCostReduction}% Cout /{" "}
                        <img
                          src={LOGOS.boost}
                          alt=""
                          className="w-3 h-3 drop-shadow-md"
                        />
                      </span>
                    ) : null}

                    {/* Specials */}
                    {purchaseConfirm.item.specialCardId ? (
                      <span className="bg-indigo-500/90 shadow-lg border border-indigo-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded">
                        1 Carte Spé
                      </span>
                    ) : null}
                    {purchaseConfirm.item.specialActionId ? (
                      <span className="bg-emerald-500/90 shadow-lg border border-emerald-400/40 text-white text-[11px] font-black uppercase px-2 py-1 rounded">
                        1 Action Spé
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {purchaseConfirm &&
                ((purchaseConfirm.type === "skin" &&
                  (fanz.unlockedSkins?.includes(purchaseConfirm.item.id) ||
                    userProfile?.skins?.includes(purchaseConfirm.item.id))) ||
                  (purchaseConfirm.type === "emote" &&
                    (fanz.unlockedEmotes?.includes(purchaseConfirm.item.id) ||
                      userProfile?.emotes?.includes(purchaseConfirm.item.id))) ||
                  (purchaseConfirm.type === "card" &&
                    (purchaseConfirm.item.rarity === "common" ||
                      userProfile?.cards?.includes(purchaseConfirm.item.id) ||
                      (fanz.cardProgress &&
                        fanz.cardProgress[purchaseConfirm.item.id] !==
                          undefined)))) ? (
                  <>
                    {purchaseConfirm.type === "skin" &&
                      fanz.equippedSkin !== purchaseConfirm.item.id && (
                        <Button
                          onClick={() => {
                            handleEquipSkin(purchaseConfirm.item.id);
                            setPurchaseConfirm(null);
                          }}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-lg py-5 shadow-lg shadow-orange-900/50"
                        >
                          Équiper
                        </Button>
                      )}
                    <Button
                      onClick={() => setPurchaseConfirm(null)}
                      className="w-full bg-white/10 hover:bg-white/20 text-white font-bold uppercase mt-2"
                    >
                      {purchaseConfirm.type === "skin" &&
                      fanz.equippedSkin === purchaseConfirm.item.id
                        ? "Fermer (Équipé)"
                        : "Fermer"}
                    </Button>
                  </>
                ) : (
                  <>
                    {purchaseConfirm.item.price && (
                      <Button
                        onClick={() =>
                          purchaseConfirm.type === "skin"
                            ? handleBuySkin(purchaseConfirm.item)
                            : purchaseConfirm.type === "emote"
                              ? handleBuyEmote(purchaseConfirm.item)
                              : handleBuyCard(purchaseConfirm.item)
                        }
                        disabled={
                          purchasing ||
                          (purchaseConfirm.item.price?.money > 0 && (userProfile?.money || 0) < purchaseConfirm.item.price.money) ||
                          (purchaseConfirm.item.price?.gems > 0 && (userProfile?.gems || 0) < purchaseConfirm.item.price.gems) ||
                          (purchaseConfirm.item.price?.boostPoints > 0 && (userProfile?.boostPoints || 0) < purchaseConfirm.item.price.boostPoints)
                        }
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black uppercase text-base sm:text-lg py-4 sm:py-5 shadow-lg shadow-green-900/50 flex flex-col items-center justify-center disabled:from-gray-700 disabled:to-gray-800"
                      >
                        {purchasing ? (
                          "ACHAT EN COURS..."
                        ) : (
                          <>
                            <span className="flex items-center gap-1.5 leading-none">
                              ACHETER POUR :
                            </span>
                            <span className="flex items-center justify-center gap-3 mt-1.5 whitespace-nowrap overflow-x-auto no-scrollbar">
                              {purchaseConfirm.item.price?.money > 0 && <span className="flex items-center gap-1 text-green-300 drop-shadow-md"><span className="text-base">{purchaseConfirm.item.price.money}</span> <img src={LOGOS.money} alt="$" className="w-4 h-4" /></span>}
                              {purchaseConfirm.item.price?.gems > 0 && <span className="flex items-center gap-1 text-blue-300 drop-shadow-md"><span className="text-base">{purchaseConfirm.item.price.gems}</span> <img src={LOGOS.gems} alt="Gemmes" className="w-4 h-4" /></span>}
                              {purchaseConfirm.item.price?.boostPoints > 0 && <span className="flex items-center gap-1 text-orange-300 drop-shadow-md"><span className="text-base">{purchaseConfirm.item.price.boostPoints}</span> 🚀</span>}
                            </span>
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      onClick={() => setPurchaseConfirm(null)}
                      disabled={purchasing}
                      className="w-full bg-white/10 hover:bg-white/20 text-white font-bold uppercase mt-2"
                    >
                      Annuler
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {alertModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 border border-white/10 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl"
          >
            <div
              className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                alertModal.type === "success"
                  ? "bg-green-500/20 text-green-500"
                  : alertModal.type === "error"
                    ? "bg-red-500/20 text-red-500"
                    : "bg-blue-500/20 text-blue-500"
              }`}
            >
              {alertModal.type === "success" ? (
                <CheckCircle size={40} />
              ) : alertModal.type === "error" ? (
                <Activity size={40} />
              ) : (
                <Info size={40} />
              )}
            </div>
            <div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">
                {alertModal.title}
              </h3>
              <p className="text-gray-400 font-bold">{alertModal.message}</p>
            </div>
            <Button
              onClick={() => setAlertModal(null)}
              className="w-full py-4 text-lg"
            >
              D'accord
            </Button>
          </motion.div>
        </div>
      )}

      {/* Reward Modal */}
      <AnimatePresence>
        {rewardModal && rewardModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-gray-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl"
            >
              <div className="text-center space-y-1 mb-4 flex-shrink-0">
                <div className="inline-block px-3 py-0.5 bg-orange-500 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full mb-1">
                  {rewardModal.title}
                </div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">
                  {rewardModal.step === "initial"
                    ? "Choisissez votre gain"
                    : rewardModal.step === "skill-selection"
                      ? "Amélioration de stat"
                      : rewardModal.step === "card-selection"
                        ? "Sélectionnez une carte"
                        : rewardModal.step === "skin-selection"
                          ? "Sélectionnez un skin"
                          : rewardModal.step === "emote-selection"
                            ? "Sélectionnez un emote"
                            : rewardModal.step === "action-selection"
                              ? "Sélectionnez une action"
                              : "Récompense obtenue !"}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 space-y-4">
                {rewardModal.step === "initial" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Custom Choices from Admin */}
                    {rewardModal.rewardType === "choice" &&
                    rewardModal.choices &&
                    rewardModal.choices.filter(c => c.type !== "action").length > 0 ? (
                      rewardModal.choices.filter(c => c.type !== "action").map((choice, idx) => {
                        // Render custom choice block
                        let icon = <Trophy size={24} />;
                        let colorClass = "text-green-500 group-hover:scale-110";
                        let bgClass = "bg-green-500/20";
                        let hoverClass =
                          "hover:border-green-500 hover:bg-green-500/5";
                        let title = "Récompense";
                        let subtitle = "";

                        if (choice.type === "card") {
                          icon = <Database size={24} />;
                          colorClass = "text-orange-500 group-hover:scale-110";
                          bgClass = "bg-orange-500/20";
                          hoverClass =
                            "hover:border-orange-500 hover:bg-orange-500/5";
                          title = "Carte Duel";
                          subtitle = "Nouvelle carte pour votre deck";
                        } else if (choice.type === "skin") {
                          icon = <Star size={24} />;
                          colorClass = "text-purple-500 group-hover:scale-110";
                          bgClass = "bg-purple-500/20";
                          hoverClass =
                            "hover:border-purple-500 hover:bg-purple-500/5";
                          title = "Nouveau Skin";
                          subtitle = "Look exclusif pour votre Fanz";
                        } else if (choice.type === "emote") {
                          icon = <MessageCircle size={24} />;
                          colorClass = "text-yellow-500 group-hover:scale-110";
                          bgClass = "bg-yellow-500/20";
                          hoverClass =
                            "hover:border-yellow-500 hover:bg-yellow-500/5";
                          title = "Nouvel Emote";
                          subtitle = "Exprimez-vous en duel";
                        } else if (choice.type === "xp") {
                          icon = (
                            <img
                              src={LOGOS.level}
                              alt="XP"
                              className="w-6 h-6 object-contain"
                            />
                          );
                          colorClass = "text-blue-500 group-hover:scale-110";
                          bgClass = "bg-blue-500/20";
                          hoverClass =
                            "hover:border-blue-500 hover:bg-blue-500/5";
                          title = `+100 XP`;
                          subtitle = "Boostez vos compétences";
                        } else if (choice.type === "money") {
                          icon = (
                            <img
                              src={LOGOS.money}
                              alt="$"
                              className="w-6 h-6 object-contain"
                            />
                          );
                          title = `${choice.amount || 0} Argent`;
                        } else if (choice.type === "gems") {
                          icon = (
                            <img
                              src={LOGOS.gems}
                              alt="Gemmes"
                              className="w-6 h-6 object-contain"
                            />
                          );
                          title = `${choice.amount || 0} Gemmes`;
                        }

                        return (
                          <button
                            key={idx}
                            onClick={async () => {
                              if (
                                [
                                  "card",
                                  "skin",
                                  "emote",
                                  "action",
                                  "xp",
                                ].includes(choice.type)
                              ) {
                                setRewardModal({
                                  ...rewardModal,
                                  step: `${choice.type}-selection` as any,
                                });
                              } else {
                                // Simple reward claim
                                setClaimingReward(rewardModal.slotId);
                                try {
                                  const fanzRef = doc(db, "fanz", fanz.id);
                                  const userRef = doc(
                                    db,
                                    "users",
                                    userProfile.uid,
                                  );
                                  const newClaimed = [
                                    ...(fanz.claimedRewards || []),
                                    rewardModal.slotId,
                                  ];

                                  const updates: any = {
                                    claimedRewards: newClaimed,
                                  };
                                  const userUpdates: any = {};
                                  if (choice.type === "money")
                                    userUpdates.money =
                                      (userProfile.money || 0) +
                                      (choice.amount || 0);
                                  if (choice.type === "gems")
                                    userUpdates.gems =
                                      (userProfile.gems || 0) +
                                      (choice.amount || 0);

                                  await updateDoc(fanzRef, updates);
                                  if (Object.keys(userUpdates).length > 0)
                                    await updateDoc(userRef, userUpdates);

                                  setFanz({
                                    ...fanz,
                                    claimedRewards: newClaimed,
                                  });
                                  setRewardModal({
                                    ...rewardModal,
                                    step: "success",
                                  });
                                } catch (e) {
                                  console.error(e);
                                }
                                setClaimingReward(null);
                              }
                            }}
                            className={`group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 transition-all ${hoverClass}`}
                          >
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform ${bgClass} ${colorClass}`}
                            >
                              {icon}
                            </div>
                            <div>
                              <div className="font-black italic uppercase text-sm">
                                {title}
                              </div>
                              {subtitle && (
                                <div className="text-[10px] text-gray-400 font-bold leading-tight">
                                  {subtitle}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <>
                        {/* Hardcoded Old Logic block */}
                        {(rewardModal.rewardType === "choice" ||
                          rewardModal.rewardType === "card") &&
                          allCards.filter((c) => {
                            const isAllowed =
                              !c.fanzIds ||
                              c.fanzIds.length === 0 ||
                              c.fanzIds.includes(fanz.templateId);
                            const isBlocked =
                              c.blockedFanzIds &&
                              c.blockedFanzIds.includes(fanz.templateId);
                            const isSkinMatch =
                              !c.skinId || c.skinId === fanz.equippedSkin;

                            const requirements = c.unlockRequirements || [];
                            const metRequirements =
                              requirements.length > 0 &&
                              requirements.every((req) => {
                                if (req.type === "skill" && req.skillName) {
                                  const xp = fanz.stats[req.skillName] || 0;
                                  const level = Math.min(
                                    10,
                                    Math.floor(xp / 100) + 1,
                                  );
                                  return level >= req.minLevel;
                                }
                                if (req.type === "ferveur") {
                                  return fanz.ferveurLevel >= req.minLevel;
                                }
                                if (req.type === "rank") {
                                  return (fanz.rank ?? 0) >= req.minLevel;
                                }
                                return true;
                              });

                            const isAlreadyUnlocked =
                              (userProfile.cards || []).includes(c.id) ||
                              c.id.startsWith("base_") ||
                              metRequirements;

                            const rank = rewardModal.rankNum || fanz.rank || 1;
                            const isRarityAllowed = isAllowedByRank(c.rarity, rank);

                            return (
                              isAllowed && !isBlocked && !isAlreadyUnlocked && isRarityAllowed
                            );
                          }).length > 0 && (
                            <button
                              onClick={() =>
                                setRewardModal({
                                  ...rewardModal,
                                  step: "card-selection",
                                })
                              }
                              className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-orange-500 hover:bg-orange-500/5 transition-all"
                            >
                              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                                <Database size={24} />
                              </div>
                              <div>
                                <div className="font-black italic uppercase text-sm">
                                  Carte Duel
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold leading-tight">
                                  Nouvelle carte pour votre deck
                                </div>
                              </div>
                            </button>
                          )}

                        {(rewardModal.rewardType === "choice" ||
                          rewardModal.rewardType === "skin") &&
                          allSkins.filter(
                            (s) => {
                              const isTemplateMatch = s.fanzId === fanz.templateId;
                              const isNotOwned = !(userProfile.skins || []).includes(s.id) &&
                                !(fanz.unlockedSkins || []).includes(s.id);
                              const rank = rewardModal.rankNum || fanz.rank || 1;
                              const isRarityAllowed = isAllowedByRank(s.rarity, rank);
                              return isTemplateMatch && isNotOwned && isRarityAllowed;
                            }
                          ).length > 0 && (
                            <button
                              onClick={() =>
                                setRewardModal({
                                  ...rewardModal,
                                  step: "skin-selection",
                                })
                              }
                              className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-purple-500 hover:bg-purple-500/5 transition-all"
                            >
                              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                                <Star size={24} />
                              </div>
                              <div>
                                <div className="font-black italic uppercase text-sm">
                                  Nouveau Skin
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold leading-tight">
                                  Look exclusif pour votre Fanz
                                </div>
                              </div>
                            </button>
                          )}

                        {(rewardModal.rewardType === "choice" ||
                          rewardModal.rewardType === "emote") &&
                          allEmotes.filter(
                            (e) =>
                              e.fanzId === fanz.templateId &&
                              !(userProfile.emotes || []).includes(e.id) &&
                              !(fanz.unlockedEmotes || []).includes(e.id),
                          ).length > 0 && (
                            <button
                              onClick={() =>
                                setRewardModal({
                                  ...rewardModal,
                                  step: "emote-selection",
                                })
                              }
                              className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-yellow-500 hover:bg-yellow-500/5 transition-all"
                            >
                              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform">
                                <MessageCircle size={24} />
                              </div>
                              <div>
                                <div className="font-black italic uppercase text-sm">
                                  Nouvel Emote
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold leading-tight">
                                  Exprimez-vous en duel
                                </div>
                              </div>
                            </button>
                          )}

                        {(rewardModal.rewardType === "choice" ||
                          rewardModal.rewardType === "xp") && (
                          <button
                            onClick={() =>
                              setRewardModal({
                                ...rewardModal,
                                step: "skill-selection",
                              })
                            }
                            className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-blue-500 hover:bg-blue-500/5 transition-all"
                          >
                            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                              <img
                                src={LOGOS.level}
                                alt="XP"
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                            <div>
                              <div className="font-black italic uppercase text-sm">
                                +100 XP
                              </div>
                              <div className="text-[10px] text-gray-400 font-bold leading-tight">
                                Boostez vos compétences
                              </div>
                            </div>
                          </button>
                        )}

                        {/* Fallback for simple rewards if they somehow end up in the modal */}
                        {![
                          "choice",
                          "card",
                          "skin",
                          "emote",
                          "action",
                          "xp",
                        ].includes(rewardModal.rewardType) && (
                          <button
                            onClick={async () => {
                              setClaimingReward(rewardModal.slotId);
                              try {
                                const fanzRef = doc(db, "fanz", fanz.id);
                                const userRef = doc(
                                  db,
                                  "users",
                                  userProfile.uid,
                                );
                                const newClaimed = [
                                  ...(fanz.claimedRewards || []),
                                  rewardModal.slotId,
                                ];

                                const updates: any = {
                                  claimedRewards: newClaimed,
                                };
                                const userUpdates: any = {};

                                if (rewardModal.rewardType === "money")
                                  userUpdates.money =
                                    (userProfile.money || 0) +
                                    (rewardModal.amount || 0);
                                if (rewardModal.rewardType === "gems")
                                  userUpdates.gems =
                                    (userProfile.gems || 0) +
                                    (rewardModal.amount || 0);
                                if (rewardModal.rewardType === "boost")
                                  userUpdates.boostPoints =
                                    (userProfile.boostPoints || 0) +
                                    (rewardModal.amount || 0);
                                if (rewardModal.rewardType === "energy")
                                  userUpdates.energy = Math.min(
                                    100,
                                    (userProfile.energy || 0) +
                                      (rewardModal.amount || 0),
                                  );
                                if (rewardModal.rewardType === "team_slot")
                                  userUpdates.teamSlots =
                                    (userProfile.teamSlots || 2) + 1;

                                await updateDoc(fanzRef, updates);
                                if (Object.keys(userUpdates).length > 0)
                                  await updateDoc(userRef, userUpdates);

                                if (
                                  rewardModal.rewardType === "money" &&
                                  rewardModal.amount
                                )
                                  await logTransaction(
                                    userProfile.uid,
                                    "money",
                                    rewardModal.amount,
                                    `Récompense ${rewardModal.title}`,
                                  );
                                if (
                                  rewardModal.rewardType === "gems" &&
                                  rewardModal.amount
                                )
                                  await logTransaction(
                                    userProfile.uid,
                                    "gems",
                                    rewardModal.amount,
                                    `Récompense ${rewardModal.title}`,
                                  );
                                if (
                                  rewardModal.rewardType === "boost" &&
                                  rewardModal.amount
                                )
                                  await logTransaction(
                                    userProfile.uid,
                                    "boost",
                                    rewardModal.amount,
                                    `Récompense ${rewardModal.title}`,
                                  );

                                setFanz({
                                  ...fanz,
                                  claimedRewards: newClaimed,
                                });

                                showReward({
                                  type: rewardModal.rewardType as any,
                                  amount: rewardModal.amount || 1,
                                  title: rewardModal.title,
                                });
                                setRewardModal({
                                  ...rewardModal,
                                  step: "success",
                                });
                              } catch (e) {
                                console.error(e);
                              }
                              setClaimingReward(null);
                            }}
                            className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-green-500 hover:bg-green-500/5 transition-all"
                          >
                            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform">
                              <Trophy size={24} />
                            </div>
                            <div>
                              <div className="font-black italic uppercase text-sm">
                                Récupérer
                              </div>
                              <div className="text-[10px] text-gray-400 font-bold leading-tight">
                                {rewardModal.amount}{" "}
                                {rewardModal.rewardType === "money"
                                  ? "$"
                                  : rewardModal.rewardType}
                              </div>
                            </div>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {rewardModal.step === "card-selection" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
                    {allCards
                      .filter((c) => {
                        const isAllowed =
                          !c.fanzIds ||
                          c.fanzIds.length === 0 ||
                          c.fanzIds.includes(fanz.templateId);
                        const isBlocked =
                          c.blockedFanzIds &&
                          c.blockedFanzIds.includes(fanz.templateId);
                        const isSkinMatch =
                          !c.skinId || c.skinId === fanz.equippedSkin;

                        const requirements = c.unlockRequirements || [];
                        const metRequirements =
                          requirements.length > 0 &&
                          requirements.every((req) => {
                            if (req.type === "skill" && req.skillName) {
                              const xp = fanz.stats[req.skillName] || 0;
                              const level = Math.min(
                                10,
                                Math.floor(xp / 100) + 1,
                              );
                              return level >= req.minLevel;
                            }
                            if (req.type === "ferveur") {
                              return fanz.ferveurLevel >= req.minLevel;
                            }
                            if (req.type === "rank") {
                              return (fanz.rank ?? 0) >= req.minLevel;
                            }
                            return true;
                          });

                        const isAlreadyUnlocked =
                          (userProfile.cards || []).includes(c.id) ||
                          c.id.startsWith("base_") ||
                          metRequirements;

                        const rank = rewardModal.rankNum || fanz.rank || 1;
                        const isRarityAllowed = isAllowedByRank(c.rarity, rank);
                        return isAllowed && !isBlocked && !isAlreadyUnlocked && isRarityAllowed;
                      })
                      .map((card) => (
                        <button
                          key={card.id}
                          onClick={async () => {
                            setClaimingReward(rewardModal.slotId);
                            try {
                              const fanzRef = doc(db, "fanz", fanz.id);
                              const userRef = doc(db, "users", userProfile.uid);

                              const newClaimed = [
                                ...(fanz.claimedRewards || []),
                                rewardModal.slotId,
                              ];
                              const newCards = [
                                ...(userProfile.cards || []),
                                card.id,
                              ];
                              const newChoices = {
                                ...(fanz.claimedChoices || {}),
                                [rewardModal.slotId]: {
                                  type: "card",
                                  id: card.id,
                                },
                              };

                              await updateDoc(fanzRef, {
                                claimedRewards: newClaimed,
                                claimedChoices: newChoices,
                              });
                              await updateDoc(userRef, { cards: newCards });

                              setFanz({
                                ...fanz,
                                claimedRewards: newClaimed,
                                claimedChoices: newChoices,
                              });

                              showReward({
                                type: "card",
                                amount: 1,
                                card: card,
                              });
                              setRewardModal({
                                ...rewardModal,
                                step: "success",
                                unlockedCard: card,
                              });
                            } catch (e) {
                              console.error(e);
                            }
                            setClaimingReward(null);
                          }}
                          className="group relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden border border-white/10 hover:border-orange-500 transition-all"
                        >
                          <img
                            src={getImageUrl(card.imageUrl)}
                            alt={card.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                            <div className="text-[8px] font-black uppercase text-white truncate">
                              {card.name}
                            </div>
                            <div className="text-[6px] text-orange-500 font-bold uppercase">
                              {card.type}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                {rewardModal.step === "skin-selection" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
                    {allSkins
                      .filter(
                        (s) => {
                          const isTemplateMatch = s.fanzId === fanz.templateId;
                          const isNotOwned = !(userProfile.skins || []).includes(s.id) &&
                            !(fanz.unlockedSkins || []).includes(s.id);
                          const rank = rewardModal.rankNum || fanz.rank || 1;
                          const isRarityAllowed = isAllowedByRank(s.rarity, rank);
                          return isTemplateMatch && isNotOwned && isRarityAllowed;
                        }
                      )
                      .map((skin, idx) => (
                        <button
                          key={`${skin.id}-${idx}`}
                          onClick={async () => {
                            setClaimingReward(rewardModal.slotId);
                            try {
                              const fanzRef = doc(db, "fanz", fanz.id);
                              const userRef = doc(db, "users", userProfile.uid);
                              const newClaimed = [
                                ...(fanz.claimedRewards || []),
                                rewardModal.slotId,
                              ];
                              const newSkins = [
                                ...(userProfile.skins || []),
                                skin.id,
                              ];
                              const newFanzSkins = [
                                ...(fanz.unlockedSkins || []),
                                skin.id,
                              ];
                              const newChoices = {
                                ...(fanz.claimedChoices || {}),
                                [rewardModal.slotId]: {
                                  type: "skin",
                                  id: skin.id,
                                },
                              };

                              await updateDoc(fanzRef, {
                                claimedRewards: newClaimed,
                                unlockedSkins: newFanzSkins,
                                claimedChoices: newChoices,
                              });
                              await updateDoc(userRef, { skins: newSkins });

                              setFanz({
                                ...fanz,
                                claimedRewards: newClaimed,
                                unlockedSkins: newFanzSkins,
                                claimedChoices: newChoices,
                              });

                              showReward({
                                type: "skin",
                                amount: 1,
                                skin: skin,
                              });
                              setRewardModal({
                                ...rewardModal,
                                step: "success",
                                unlockedSkin: skin,
                              });
                            } catch (e) {
                              console.error(e);
                            }
                            setClaimingReward(null);
                          }}
                          className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-white/10 hover:border-purple-500 transition-all"
                        >
                          <img
                            src={getImageUrl(skin.imageUrl)}
                            alt={skin.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                            <div className="text-[8px] font-black uppercase text-white truncate">
                              {skin.name}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                {rewardModal.step === "emote-selection" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
                    {allEmotes
                      .filter(
                        (e) =>
                          e.fanzId === fanz.templateId &&
                          !(userProfile.emotes || []).includes(e.id) &&
                          !(fanz.unlockedEmotes || []).includes(e.id),
                      )
                      .map((emote, idx) => (
                        <button
                          key={`${emote.id}-${idx}`}
                          onClick={async () => {
                            setClaimingReward(rewardModal.slotId);
                            try {
                              const fanzRef = doc(db, "fanz", fanz.id);
                              const userRef = doc(db, "users", userProfile.uid);
                              const newClaimed = [
                                ...(fanz.claimedRewards || []),
                                rewardModal.slotId,
                              ];
                              const newEmotes = [
                                ...(userProfile.emotes || []),
                                emote.id,
                              ];
                              const newFanzEmotes = [
                                ...(fanz.unlockedEmotes || []),
                                emote.id,
                              ];
                              const newChoices = {
                                ...(fanz.claimedChoices || {}),
                                [rewardModal.slotId]: {
                                  type: "emote",
                                  id: emote.id,
                                },
                              };

                              await updateDoc(fanzRef, {
                                claimedRewards: newClaimed,
                                unlockedEmotes: newFanzEmotes,
                                claimedChoices: newChoices,
                              });
                              await updateDoc(userRef, { emotes: newEmotes });

                              setFanz({
                                ...fanz,
                                claimedRewards: newClaimed,
                                unlockedEmotes: newFanzEmotes,
                                claimedChoices: newChoices,
                              });

                              showReward({
                                type: "emote",
                                amount: 1,
                                emote: emote,
                              });
                              setRewardModal({
                                ...rewardModal,
                                step: "success",
                                unlockedEmote: emote,
                              });
                            } catch (e) {
                              console.error(e);
                            }
                            setClaimingReward(null);
                          }}
                          className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-white/10 hover:border-yellow-500 transition-all"
                        >
                          <img
                            src={getImageUrl(emote.imageUrl)}
                            alt={emote.name}
                            className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                            <div className="text-[8px] font-black uppercase text-white truncate">
                              {emote.name}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                {rewardModal.step === "action-selection" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
                    {lifeActions
                      .filter((a) => {
                        if (a.fanzTemplateId && a.fanzTemplateId !== fanz.templateId) return false;
                        if (a.skinId && a.skinId !== fanz.equippedSkin) return false;
                        
                        const skinSpecificId = a.id + '-' + (a.skinId || '000');
                        const isBase = !a.skinId || a.skinId === '000';
                        const fanzUnlocked = fanz.unlockedActions || [];
                        const userUnlocked = userProfile.unlockedActions || [];
                        
                        const isUnlocked = fanzUnlocked.includes(skinSpecificId) || 
                                           userUnlocked.includes(skinSpecificId) || 
                                           (isBase && (fanzUnlocked.includes(a.id) || userUnlocked.includes(a.id)));
                        return !isUnlocked;
                      })
                      .reduce((acc, action) => {
                        const existingIdx = acc.findIndex(
                          (a) => a.name === action.name,
                        );
                        if (existingIdx !== -1) {
                          if (action.skinId && !acc[existingIdx].skinId)
                            acc[existingIdx] = action;
                        } else acc.push(action);
                        return acc;
                      }, [] as LifeAction[])
                      .map((action) => (
                        <button
                          key={action.id}
                          onClick={async () => {
                            setClaimingReward(rewardModal.slotId);
                            try {
                              const fanzRef = doc(db, "fanz", fanz.id);
                              const userRef = doc(db, "users", userProfile.uid);
                              const newClaimed = [
                                ...(fanz.claimedRewards || []),
                                rewardModal.slotId,
                              ];
                              const newActions = [
                                ...(fanz.unlockedActions || []),
                                action.id,
                              ];
                              const newUserActions = [
                                ...(userProfile.unlockedActions || []),
                                action.id,
                              ];
                              const newChoices = {
                                ...(fanz.claimedChoices || {}),
                                [rewardModal.slotId]: {
                                  type: "action",
                                  id: action.id,
                                },
                              };

                              await updateDoc(fanzRef, {
                                claimedRewards: newClaimed,
                                unlockedActions: newActions,
                                claimedChoices: newChoices,
                              });
                              await updateDoc(userRef, {
                                unlockedActions: newUserActions,
                              });

                              setFanz({
                                ...fanz,
                                claimedRewards: newClaimed,
                                unlockedActions: newActions,
                                claimedChoices: newChoices,
                              });

                              showReward({
                                type: "action",
                                amount: 1,
                                action: action,
                              });
                              setRewardModal({
                                ...rewardModal,
                                step: "success",
                                unlockedAction: action,
                              });
                            } catch (e) {
                              console.error(e);
                            }
                            setClaimingReward(null);
                          }}
                          className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-white/10 hover:border-cyan-500 transition-all"
                        >
                          {(() => {
                            let resolvedImg = action.image;
                            if (
                              fanz.equippedSkin &&
                              action.skinOverrides &&
                              action.skinOverrides[fanz.equippedSkin]?.image
                            ) {
                              resolvedImg =
                                action.skinOverrides[fanz.equippedSkin].image;
                            }
                            return (
                              resolvedImg && (
                                <img
                                  src={getImageUrl(resolvedImg)}
                                  alt={action.name}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                              )
                            );
                          })()}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-2">
                            <div className="text-[10px] font-black uppercase text-white truncate">
                              {action.name}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                {rewardModal.step === "skill-selection" && (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(statLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={async () => {
                          setClaimingReward(rewardModal.slotId);
                          try {
                            const fanzRef = doc(db, "fanz", fanz.id);
                            const newClaimed = [
                              ...(fanz.claimedRewards || []),
                              rewardModal.slotId,
                            ];
                            const newStats = { ...fanz.stats };
                            const amount = 100;
                            const currentStat = newStats[key as keyof typeof statLabels] || 0;
                            newStats[key as keyof typeof statLabels] = Math.min(900, currentStat + amount);
                            const newChoices = {
                              ...(fanz.claimedChoices || {}),
                              [rewardModal.slotId]: {
                                type: "skill",
                                stat: key,
                                amount,
                              },
                            };

                            await updateDoc(fanzRef, {
                              claimedRewards: newClaimed,
                              stats: newStats,
                              claimedChoices: newChoices,
                            });

                            setFanz({
                              ...fanz,
                              claimedRewards: newClaimed,
                              stats: newStats,
                              claimedChoices: newChoices,
                            });

                            showReward({
                              type: "xp", // Using XP type for stat gains as it's similar
                              amount: amount,
                              title: `+${amount} ${statLabels[key as keyof typeof statLabels]}`,
                            });
                            setRewardModal({ ...rewardModal, step: "success" });
                          } catch (e) {
                            console.error(e);
                          }
                          setClaimingReward(null);
                        }}
                        className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col items-start gap-2 hover:border-white/30 hover:bg-white/10 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          {statIcons[key as keyof typeof statIcons]}
                          <span className="font-black text-sm uppercase italic tracking-wider">{label}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 leading-normal group-hover:text-white/80 transition-colors">
                          {statDuelDescriptions[key as keyof typeof statDuelDescriptions]}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {rewardModal.step === "success" && (
                  <div className="text-center space-y-4 py-2">
                    <div className="w-20 h-20 mx-auto bg-green-500/20 text-green-500 rounded-full flex items-center justify-center animate-bounce">
                      <Trophy size={40} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black italic uppercase mb-1">
                        Récompense validée !
                      </h4>
                      {rewardModal.unlockedCard ? (
                        <p className="text-gray-400 font-bold text-sm">
                          Vous avez débloqué la carte{" "}
                          <span className="text-white">
                            {rewardModal.unlockedCard.name}
                          </span>
                        </p>
                      ) : rewardModal.unlockedSkin ? (
                        <p className="text-gray-400 font-bold text-sm">
                          Vous avez débloqué le skin{" "}
                          <span className="text-white">
                            {rewardModal.unlockedSkin.name}
                          </span>
                        </p>
                      ) : rewardModal.unlockedEmote ? (
                        <p className="text-gray-400 font-bold text-sm">
                          Vous avez débloqué l'emote{" "}
                          <span className="text-white">
                            {rewardModal.unlockedEmote.name}
                          </span>
                        </p>
                      ) : rewardModal.unlockedAction ? (
                        <p className="text-gray-400 font-bold text-sm">
                          Vous avez débloqué l'action{" "}
                          <span className="text-white">
                            {rewardModal.unlockedAction.name}
                          </span>
                        </p>
                      ) : (
                        <p className="text-gray-400 font-bold text-sm">
                          Vos statistiques ont été mises à jour avec succès.
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => setRewardModal(null)}
                      className="w-full py-3"
                    >
                      Génial !
                    </Button>
                  </div>
                )}
              </div>

              {rewardModal.step !== "success" && (
                <div className="pt-4 flex-shrink-0">
                  <button
                    onClick={() => setRewardModal(null)}
                    className="w-full text-gray-500 font-black italic uppercase text-xs tracking-widest hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
  hasAlert,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  hasAlert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg transition-all font-bold uppercase italic text-[8px] tracking-tighter whitespace-nowrap flex-1 min-w-0 ${
        active
          ? "bg-white/10 text-white"
          : "text-gray-500 hover:text-white hover:bg-white/5"
      }`}
    >
      {hasAlert && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-black animate-pulse" />
      )}
      <div className="shrink-0">{icon}</div>
      <span className="truncate w-full text-center">{label}</span>
    </button>
  );
}
