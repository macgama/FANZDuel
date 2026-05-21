import React, { useState, useEffect } from "react";
import {
  Ticket,
  ArrowLeft,
  Lock,
  Star,
  Check,
  ChevronLeft,
} from "lucide-react";
import { Card, Button } from "./Layout";
import { UserProfile, Pass, FanzSkin } from "../types";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  increment,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { useAlert } from "../context/AlertContext";
import { useReward } from "../context/RewardContext";
import { logTransaction } from "../services/transactionService";
import { getImageUrl } from "../lib/utils";
import { LOGOS } from "../constants";
import { OptimizedMedia } from "./OptimizedMedia";

interface PassPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function PassPage({ profile, onBack }: PassPageProps) {
  const [allPasses, setAllPasses] = useState<Pass[]>([]);
  const [selectedPass, setSelectedPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [skins, setSkins] = useState<Record<string, FanzSkin>>({});
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const { showAlert } = useAlert();
  const { showReward } = useReward();

  useEffect(() => {
    const fetchPasses = async () => {
      try {
        const q = query(
          collection(db, "passes"),
          where("isActive", "==", true),
        );
        const snap = await getDocs(q);
        const passesData = await Promise.all(
          snap.docs.map(async (docSnap) => {
            const pass = { id: docSnap.id, ...docSnap.data() } as Pass;
            if (pass.skinRewardId && !pass.skinReward) {
              const skinDoc = await getDoc(doc(db, "skins", pass.skinRewardId));
              if (skinDoc.exists()) {
                pass.skinReward = {
                  id: skinDoc.id,
                  ...skinDoc.data(),
                } as FanzSkin;
              }
            }
            return pass;
          }),
        );
        setAllPasses(passesData);

        // Fetch skins for all passes to have them ready
        const allSkinIds = passesData.flatMap((p) =>
          (p.levels || []).map((l) => l.premiumReward?.skinId).filter(Boolean),
        ) as string[];

        if (allSkinIds.length > 0) {
          const allSkins: Record<string, FanzSkin> = {};

          const fanzSnap = await getDocs(collection(db, "fanz_templates"));
          fanzSnap.forEach((doc) => {
            const data = doc.data();
            if (data.skins && Array.isArray(data.skins)) {
              data.skins.forEach((s: FanzSkin) => {
                if (s.id) allSkins[s.id] = s;
              });
            }
          });

          const skinsSnap = await getDocs(collection(db, "skins"));
          skinsSnap.forEach((doc) => {
            const data = doc.data() as FanzSkin;
            const id = data.id || doc.id;
            if (id) allSkins[id] = { ...data, id };
          });

          setSkins(allSkins);
        }
      } catch (err) {
        console.error("Error fetching passes", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPasses();
  }, []);

  const handleBuyPass = async (pass: Pass) => {
    const costMoney = pass.premiumPrice?.money || 0;
    const costGems = pass.premiumPrice?.gems || 0;

    if (profile.money < costMoney || profile.gems < costGems) {
      showAlert({ title: "Fonds insuffisants", type: "error" });
      return;
    }

    try {
      const userRef = doc(db, "users", profile.uid);
      await updateDoc(userRef, {
        purchasedPasses: arrayUnion(pass.id),
        // For backward compatibility or if this is the "active" one
        isPassPremium: true,
        passId: pass.id,
        money: increment(-costMoney),
        gems: increment(-costGems),
      });

      if (costMoney > 0)
        await logTransaction(
          profile.uid,
          "money",
          -costMoney,
          `Achat Pass ${pass.name}`,
        );
      if (costGems > 0)
        await logTransaction(
          profile.uid,
          "gems",
          -costGems,
          `Achat Pass ${pass.name}`,
        );

      showAlert({ title: "Pass activé !", type: "success" });
    } catch (err) {
      console.error("Error buying pass", err);
      showAlert({ title: "Erreur lors de l'achat", type: "error" });
    }
  };

  const handleClaimReward = async (level: number, type: "free" | "premium") => {
    if (!selectedPass) return;

    if (
      type === "premium" &&
      !profile.purchasedPasses?.includes(selectedPass.id)
    ) {
      showAlert({
        title: "Pass Premium Requis",
        subtitle:
          "Vous devez activer le pass premium pour récupérer ces récompenses.",
        type: "error",
      });
      return;
    }

    const rewardId = `${selectedPass.id}-level-${level}-${type}`;
    if (profile.claimedPassRewards?.includes(rewardId)) return;

    const levelData = selectedPass.levels.find((l) => l.level === level);
    if (!levelData) return;

    const reward =
      type === "free" ? levelData.freeReward : levelData.premiumReward;
    if (!reward) return;

    try {
      const userRef = doc(db, "users", profile.uid);
      const updates: any = {
        claimedPassRewards: arrayUnion(rewardId),
      };

      if (reward.type === "money")
        updates.money = increment(reward.amount || 0);
      if (reward.type === "gems") updates.gems = increment(reward.amount || 0);
      if (reward.type === "boost")
        updates.boostPoints = increment(reward.amount || 0);
      if (reward.type === "energy")
        updates.energy = increment(reward.amount || 0);
      if (reward.type === "skin" && reward.skinId)
        updates.skins = arrayUnion(reward.skinId);
      if (reward.type === "team_slot") updates.teamSlots = increment(1);

      await updateDoc(userRef, updates);

      if (reward.type === "fanz" && reward.fanzId) {
        const fanzRef = doc(db, "fanz", `${profile.uid}_${reward.fanzId}`);
        const fanzDoc = await getDoc(fanzRef);
        if (!fanzDoc.exists()) {
          const templateDoc = await getDoc(
            doc(db, "fanz_templates", reward.fanzId),
          );
          if (templateDoc.exists()) {
            const templateData = templateDoc.data();
            await setDoc(fanzRef, {
              id: `${profile.uid}_${reward.fanzId}`,
              templateId: reward.fanzId,
              ownerUid: profile.uid,
              name: templateData.name || "Unknown Fanz",
              sport: templateData.sport || "Football",
              imageUrl: templateData.image || null,
              videoUrl: templateData.video || null,
              baseExcitement: templateData.baseExcitement || 5,
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
              stats: templateData.baseStats || {
                force: 10,
                endurance: 10,
                mental: 10,
                bluff: 10,
                creativity: 10,
                social: 10,
                intelligence: 10,
                charisma: 10,
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      if (reward.type === "money" && reward.amount)
        await logTransaction(
          profile.uid,
          "money",
          reward.amount,
          `Récompense Pass Niveau ${level}`,
        );
      if (reward.type === "gems" && reward.amount)
        await logTransaction(
          profile.uid,
          "gems",
          reward.amount,
          `Récompense Pass Niveau ${level}`,
        );

      showReward({
        type: reward.type as any,
        amount: reward.amount,
        title: `Récompense Palier ${level} !`,
        card:
          reward.type === "card" && reward.cardId
            ? { name: "Carte Débloquée", imageUrl: "placeholder" }
            : undefined, // Assuming card exists if cardId
        skin:
          reward.type === "skin" && reward.skinId
            ? { name: "Skin Débloqué" }
            : undefined,
        emote:
          reward.type === "emote" && reward.emoteId
            ? { name: "Emote Débloqué" }
            : undefined,
        action:
          reward.type === "action" && reward.actionId
            ? { name: "Action Débloquée" }
            : undefined,
      });
    } catch (err) {
      console.error("Error claiming reward", err);
      showAlert({ title: "Erreur lors de la récupération", type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-white">
        Chargement...
      </div>
    );
  }

  const isPassCompletedByUser = (pass: Pass) => {
    const userPoints = profile.passProgress?.[pass.id] || 0;
    const isOwned = profile.purchasedPasses?.includes(pass.id);
    const maxLevel = pass.levels[pass.levels.length - 1];

    if (!maxLevel || userPoints < maxLevel.pointsRequired) return false;
    for (const l of pass.levels) {
      if (
        l.freeReward &&
        !profile.claimedPassRewards?.includes(
          `${pass.id}-level-${l.level}-free`,
        )
      )
        return false;
      if (
        isOwned &&
        l.premiumReward &&
        !profile.claimedPassRewards?.includes(
          `${pass.id}-level-${l.level}-premium`,
        )
      )
        return false;
    }
    return true;
  };

  const now = new Date();

  const activePasses = allPasses.filter((pass) => {
    // Pass is active if endDate > now AND has not been fully completed by the user
    // OR if it's currently marked active and not completed
    const isActiveDate = new Date(pass.endDate) > now && pass.isActive;
    return isActiveDate && !isPassCompletedByUser(pass);
  });

  const archivedPasses = allPasses.filter((pass) => {
    // Pass is archived if it has been fully completed by the user
    // OR if it's expired and the user had some progress or purchased it
    const isExpired = new Date(pass.endDate) <= now || !pass.isActive;
    const hasProgress =
      (profile.passProgress?.[pass.id] || 0) > 0 ||
      profile.purchasedPasses?.includes(pass.id);
    return isPassCompletedByUser(pass) || (isExpired && hasProgress);
  });

  const displayPasses = activeTab === "active" ? activePasses : archivedPasses;

  if (!selectedPass) {
    return (
      <div className="flex flex-col h-full bg-transparent">
        <div className="flex items-center justify-between px-4">
          <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
            Pass
          </h1>
          <div className="flex gap-2">
            <Button
              variant={activeTab === "active" ? "primary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("active")}
              className={`text-xs font-bold uppercase ${activeTab === "active" ? "bg-white text-black" : "border-white/10 text-gray-400"}`}
            >
              Actifs
            </Button>
            <Button
              variant={activeTab === "archive" ? "primary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("archive")}
              className={`text-xs font-bold uppercase ${activeTab === "archive" ? "bg-white text-black" : "border-white/10 text-gray-400"}`}
            >
              Archives
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displayPasses.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 font-bold">
              Aucun Pass {activeTab === "active" ? "disponible" : "archivé"}.
            </div>
          ) : (
            displayPasses.map((pass) => {
              const isOwned = profile.purchasedPasses?.includes(pass.id);
              const sampleSkins = (pass.levels || [])
                .map((l) =>
                  l.premiumReward?.skinId
                    ? skins[l.premiumReward.skinId]?.imageUrl
                    : null,
                )
                .filter(Boolean)
                .slice(0, 4);

              return (
                <Card
                  key={pass.id}
                  onClick={() => setSelectedPass(pass)}
                  className={`relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[180px] flex flex-col justify-end p-0 border-2 ${isOwned ? "border-purple-500 shadow-[0_0_30px_rgba(147,51,234,0.2)]" : "border-gray-800 hover:border-purple-500/50"}`}
                >
                  <div className="absolute inset-0 z-0 bg-[#0a0a0c]">
                    {sampleSkins.length > 0 ? (
                      <div className="absolute inset-0 flex justify-end items-center opacity-60 mix-blend-screen overflow-hidden pointer-events-none pr-8">
                        {sampleSkins.map((skinUrl, idx) => (
                          <div
                            key={idx}
                            className="w-40 h-40 md:w-56 md:h-56 shrink-0 saturate-150 contrast-125 transition-transform duration-700 ease-out group-hover:scale-110"
                            style={{
                              transform: `translateX(${idx * -40}px) translateY(${idx % 2 === 0 ? "-10px" : "10px"}) rotate(${idx * 10 - 15}deg)`,
                              zIndex: 10 - idx,
                            }}
                          >
                            <img
                              src={getImageUrl(skinUrl)}
                              alt="Skin"
                              className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`absolute inset-0 bg-gradient-to-r ${isOwned ? "from-purple-900/40 to-purple-500/10" : "from-gray-900 to-gray-800/50"}`}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                    <div className="absolute top-0 bottom-0 left-0 w-3/4 bg-gradient-to-r from-black via-black/90 to-transparent" />
                  </div>

                  <div className="relative z-10 p-5 md:p-6 flex items-end justify-between w-full h-full mt-auto">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2.5 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest ${
                            !pass.conditionType ||
                            pass.conditionType === "global"
                              ? "bg-blue-600 text-white"
                              : "bg-orange-600 text-white"
                          } shadow-lg`}
                        >
                          {!pass.conditionType ||
                          pass.conditionType === "global"
                            ? "Pass Général"
                            : pass.conditionType === "league"
                              ? "Pass Compétition"
                              : pass.conditionType === "country"
                                ? "Pass Pays"
                                : pass.conditionType === "team"
                                  ? "Pass Équipe"
                                  : pass.conditionType === "season"
                                    ? "Pass Saison"
                                    : "Pass Spécial"}
                          {pass.conditionSeason
                            ? ` - ${pass.conditionSeason}`
                            : ""}
                        </span>
                      </div>
                      <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-md mb-2">
                        {pass.name}
                      </h2>
                      <p className="text-xs md:text-sm text-gray-300 font-bold max-w-md line-clamp-2 drop-shadow-md">
                        {pass.description}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {isOwned ? (
                        <div className="px-5 py-2.5 bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] rounded-lg text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2">
                          <Check className="w-4 h-4" /> Actif
                        </div>
                      ) : (
                        <div className="px-6 py-2.5 bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] rounded-lg text-xs md:text-sm font-black uppercase tracking-widest hover:bg-purple-500 transition-colors">
                          Découvrir
                        </div>
                      )}
                      <div className="text-[11px] md:text-xs font-black tracking-widest text-purple-400 uppercase drop-shadow-md bg-black/50 border border-purple-500/30 px-3 py-1 rounded">
                        {pass.levels.length} Niveaux
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const userPoints =
    !selectedPass.conditionType || selectedPass.conditionType === "global"
      ? profile.passPoints || 0
      : profile.passProgress?.[selectedPass.id] || 0;
  const isOwned = profile.purchasedPasses?.includes(selectedPass.id);
  const maxPoints =
    selectedPass.levels[selectedPass.levels.length - 1]?.pointsRequired || 100;
  const progressPercent = Math.min(
    100,
    Math.max(0, (userPoints / maxPoints) * 100),
  );

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {/* Tiny back button replacing big header */}
        <button
          onClick={() => setSelectedPass(null)}
          className="text-gray-500 hover:text-white flex items-center gap-1 text-xs font-bold uppercase tracking-wider mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Retour aux passes
        </button>

        {/* Progress Tracker */}
        <div className="mb-6">
          <div className="flex justify-between items-end mb-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Ma progression
            </h3>
            <span className="text-sm font-black text-purple-400">
              {userPoints}{" "}
              <span className="text-xs text-purple-500/50">
                / {maxPoints} PTS
              </span>
            </span>
          </div>
          <div className="h-4 w-full bg-gray-900/80 rounded-full overflow-hidden border border-gray-800 relative">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-700 via-purple-500 to-blue-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Pattern overlay on progress */}
            <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
          </div>
        </div>

        {/* Pass Banner */}
        <Card
          className={`relative overflow-hidden mb-8 min-h-[220px] md:min-h-[250px] flex flex-col justify-end p-0 border-2 ${isOwned ? "border-purple-500 shadow-[0_0_30px_rgba(147,51,234,0.3)]" : "border-gray-800"}`}
        >
          <div className="absolute inset-0 z-0 bg-[#0a0a0c]">
            {(() => {
              const sampleSkins = (selectedPass.levels || [])
                .map((l) =>
                  l.premiumReward?.skinId
                    ? skins[l.premiumReward.skinId]?.imageUrl
                    : null,
                )
                .filter(Boolean)
                .slice(0, 3); // Top 3 skins for display

              return sampleSkins.length > 0 ? (
                <div className="absolute inset-0 flex justify-end items-center pointer-events-none pr-2 sm:pr-8 opacity-90">
                  {sampleSkins.map((skinUrl, idx) => (
                    <div
                      key={idx}
                      className={`relative shrink-0 saturate-150 contrast-125 z-[${10 - idx}] ${idx === 0 ? "w-40 h-40 md:w-56 md:h-56" : "w-24 h-24 md:w-40 md:h-40 blur-[1px]"}`}
                      style={{
                        transform: `translateX(${idx * -40}px) translateY(${idx * 15}px) rotate(${idx * 10 - 15}deg)`,
                      }}
                    >
                      <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full" />
                      <img
                        src={getImageUrl(skinUrl)}
                        alt="Skin"
                        className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(147,51,234,0.5)] relative z-10"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${isOwned ? "from-purple-900/40 to-purple-500/10" : "from-gray-900 to-gray-800/50"}`}
                />
              );
            })()}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent" />
            <div className="absolute top-0 bottom-0 left-0 w-full sm:w-2/3 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/90 to-transparent" />
          </div>

          <div className="relative z-10 p-6 flex flex-col sm:flex-row items-center sm:items-end text-center sm:text-left justify-between w-full h-full mt-auto">
            <div className="mb-6 sm:mb-0 max-w-md">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                <span
                  className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest ${
                    !selectedPass.conditionType ||
                    selectedPass.conditionType === "global"
                      ? "bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] text-white"
                      : "bg-orange-600 shadow-[0_0_10px_rgba(234,88,12,0.5)] text-white"
                  }`}
                >
                  {!selectedPass.conditionType ||
                  selectedPass.conditionType === "global"
                    ? "Pass Général"
                    : selectedPass.conditionType === "league"
                      ? "Pass Compétition"
                      : selectedPass.conditionType === "country"
                        ? "Pass Pays"
                        : selectedPass.conditionType === "team"
                          ? "Pass Équipe"
                          : selectedPass.conditionType === "season"
                            ? "Pass Saison"
                            : "Pass Spécial"}
                  {selectedPass.conditionSeason
                    ? ` - ${selectedPass.conditionSeason}`
                    : ""}
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-2 leading-none">
                {selectedPass.name}
              </h2>
              <p className="text-sm text-gray-300 font-bold drop-shadow-md leading-snug">
                {selectedPass.description}
              </p>
            </div>
            {!isOwned ? (
              <Button
                onClick={() => handleBuyPass(selectedPass)}
                className="w-[85%] sm:w-[220px] bg-purple-500 hover:bg-purple-600 text-white font-black uppercase shadow-[0_0_25px_rgba(147,51,234,0.6)] flex flex-col gap-1 h-auto py-3 shrink-0 rounded-xl"
              >
                <span className="text-sm">Activer le Pass Premium</span>
                <span className="text-[11px] opacity-90 bg-black/20 px-3 py-0.5 rounded-full">
                  {selectedPass.premiumPrice?.money
                    ? `${selectedPass.premiumPrice.money} 💰 `
                    : ""}
                  {selectedPass.premiumPrice?.money &&
                  selectedPass.premiumPrice?.gems
                    ? "+ "
                    : ""}
                  {selectedPass.premiumPrice?.gems
                    ? `${selectedPass.premiumPrice.gems} 💎`
                    : ""}
                  {!selectedPass.premiumPrice?.money &&
                    !selectedPass.premiumPrice?.gems &&
                    `${selectedPass.priceGems || 0} 💎`}
                </span>
              </Button>
            ) : (
              <div className="w-[85%] sm:w-[250px] py-3.5 bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] rounded-xl font-black uppercase flex items-center justify-center gap-2 shrink-0 text-sm">
                <Check className="w-5 h-5" /> Pass Premium Actif
              </div>
            )}
          </div>
        </Card>

        {/* Pass Track */}
        <div className="space-y-12 sm:space-y-16 relative mt-12">
          {/* Central Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-4 sm:w-6 bg-gray-900 border-x border-white/10 -translate-x-1/2 rounded-full overflow-hidden shadow-inner">
            {/* Progress active bar inside tracking line */}
            <div
              className="w-full bg-gradient-to-b from-purple-400 to-purple-600 shadow-[0_0_20px_rgba(168,85,247,1)] rounded-full transition-all duration-1000 relative"
              style={{ height: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
            </div>
            {/* Pattern for empty part */}
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
          </div>

          {(selectedPass.levels || []).map((level) => {
            const unlocked = userPoints >= level.pointsRequired;
            const claimedFree = profile.claimedPassRewards?.includes(
              `${selectedPass.id}-level-${level.level}-free`,
            );
            const claimedPremium = profile.claimedPassRewards?.includes(
              `${selectedPass.id}-level-${level.level}-premium`,
            );

            return (
              <div
                key={level.level}
                className="relative flex items-center gap-2 sm:gap-6"
              >
                {/* Free Reward (Left) */}
                <div className="flex-1 flex justify-end">
                  {level.freeReward ? (
                    <Card
                      className={`p-2 sm:p-4 w-[110px] sm:w-[160px] flex flex-col items-center text-center border transition-all duration-500 shadow-xl ${unlocked ? (claimedFree ? "border-white/10 bg-black/60 opacity-60" : "border-green-500/50 bg-gradient-to-br from-green-900/30 to-black/60 shadow-[0_0_20px_rgba(34,197,94,0.15)]") : "border-white/5 bg-black/60 opacity-50"}`}
                    >
                      <div className="text-[10px] sm:text-xs font-black text-gray-400 uppercase mb-2">
                        Gratuit
                      </div>
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500 font-black mb-2 border border-green-500/20 overflow-hidden">
                        {level.freeReward.type === "money" ? (
                          <img
                            src={LOGOS.money}
                            alt="Money"
                            className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-md"
                          />
                        ) : level.freeReward.type === "gems" ? (
                          <img
                            src={LOGOS.gems}
                            alt="Gems"
                            className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-md"
                          />
                        ) : (
                          "⚡"
                        )}
                      </div>
                      <div className="text-sm sm:text-base font-black text-white mb-2">
                        {["money", "gems", "boost", "energy", "xp"].includes(
                          level.freeReward.type,
                        )
                          ? `+${level.freeReward.amount}`
                          : level.freeReward.type}
                      </div>
                      {unlocked && !claimedFree && (
                        <Button
                          onClick={() => handleClaimReward(level.level, "free")}
                          size="sm"
                          className="w-full h-8 sm:h-10 text-[10px] sm:text-xs bg-green-500 hover:bg-green-600 text-white font-black uppercase shadow-lg shadow-green-500/20 border border-green-400/50"
                        >
                          Récupérer
                        </Button>
                      )}
                      {claimedFree && (
                        <div className="text-[10px] sm:text-xs text-green-500 font-black uppercase flex items-center gap-1 justify-center">
                          <Check className="w-3 h-3 sm:w-4 sm:h-4" /> Récupéré
                        </div>
                      )}
                    </Card>
                  ) : (
                    <div className="w-[110px] sm:w-[160px]" />
                  )}
                </div>

                {/* Level Node */}
                <div
                  className={`relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center border-2 shrink-0 transition-colors duration-500 ${unlocked ? "bg-purple-600 border-purple-300 text-white shadow-[0_0_30px_rgba(168,85,247,0.7)]" : "bg-[#111] border-white/10 text-gray-400"}`}
                >
                  <span className="font-black italic leading-none text-2xl sm:text-3xl drop-shadow-md">
                    {level.level}
                  </span>
                  <span className="text-[10px] font-bold opacity-70 bg-black/30 px-2 py-0.5 rounded-full mt-1 border border-white/10">
                    {level.pointsRequired}
                  </span>
                </div>

                {/* Premium Reward (Right) */}
                <div className="flex-1 flex justify-start">
                  {level.premiumReward ? (
                    <Card
                      className={`p-2 sm:p-4 w-[120px] sm:w-[180px] flex flex-col items-center text-center border transition-all duration-500 shadow-xl ${unlocked && isOwned ? (claimedPremium ? "border-white/10 bg-black/60 opacity-60" : "border-purple-500/50 bg-gradient-to-br from-purple-900/60 to-black/80 shadow-[0_0_25px_rgba(168,85,247,0.3)] scale-[1.02]") : "border-white/5 bg-black/60 opacity-50"}`}
                    >
                      <div className="text-[10px] sm:text-xs font-black text-purple-400 uppercase mb-2 flex items-center justify-center gap-1 w-full bg-purple-500/10 rounded py-1 border border-purple-500/20">
                        <Lock className="w-3 h-3" /> Premium
                      </div>

                      {level.premiumReward.type === "skin" &&
                      level.premiumReward.skinId ? (
                        <>
                          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mb-2 overflow-hidden shadow-inner">
                            {skins[level.premiumReward.skinId] ? (
                              <OptimizedMedia
                                type={
                                  skins[level.premiumReward.skinId].videoUrl
                                    ? "video"
                                    : "image"
                                }
                                src={
                                  skins[level.premiumReward.skinId].videoUrl ||
                                  skins[level.premiumReward.skinId].imageUrl ||
                                  null
                                }
                                poster={
                                  skins[level.premiumReward.skinId].imageUrl
                                }
                                className="w-full h-full object-cover scale-[1.2]"
                                autoPlay
                                loop
                              />
                            ) : (
                              <img
                                src={LOGOS.gems}
                                alt="Gems"
                                className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-lg"
                              />
                            )}
                          </div>
                          <div className="text-[10px] sm:text-xs font-black italic text-white mb-2 leading-tight h-8 sm:h-auto overflow-hidden text-ellipsis drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            {skins[level.premiumReward.skinId]?.name ||
                              "Skin Exclusif"}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-blue-500 font-black mb-2 overflow-hidden shadow-inner">
                            {level.premiumReward.type === "money" ? (
                              <img
                                src={LOGOS.money}
                                alt="Money"
                                className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-md"
                              />
                            ) : level.premiumReward.type === "gems" ? (
                              <img
                                src={LOGOS.gems}
                                alt="Gems"
                                className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-md"
                              />
                            ) : (
                              "💎"
                            )}
                          </div>
                          <div className="text-sm sm:text-base font-black italic text-white mb-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            {[
                              "money",
                              "gems",
                              "boost",
                              "energy",
                              "xp",
                            ].includes(level.premiumReward.type)
                              ? `+${level.premiumReward.amount}`
                              : level.premiumReward.type}
                          </div>
                        </>
                      )}

                      {unlocked && isOwned && !claimedPremium && (
                        <Button
                          onClick={() =>
                            handleClaimReward(level.level, "premium")
                          }
                          size="sm"
                          className="w-full h-8 sm:h-10 text-[10px] sm:text-xs bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-black uppercase shadow-lg shadow-purple-500/30 border border-purple-400/50"
                        >
                          Récupérer
                        </Button>
                      )}
                      {claimedPremium && (
                        <div className="text-[10px] sm:text-xs text-purple-500 font-black uppercase flex items-center justify-center gap-1">
                          <Check className="w-3 h-3 sm:w-4 sm:h-4" /> Récupéré
                        </div>
                      )}
                      {(!unlocked || !isOwned) && (
                        <div className="text-[10px] sm:text-xs text-gray-500 font-black uppercase flex items-center justify-center gap-1 bg-black/50 py-1 rounded w-full border border-white/5">
                          <Lock className="w-3 h-3 sm:w-4 sm:h-4" /> Bloqué
                        </div>
                      )}
                    </Card>
                  ) : (
                    <div className="w-[120px] sm:w-[180px]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
