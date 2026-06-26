import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, Gift, ChevronLeft, Target } from "lucide-react";
import { Card, Button } from "./Layout";
import { UserProfile, Mission } from "../types";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../firebase";
import { useAlert } from "../context/AlertContext";
import { useReward } from "../context/RewardContext";
import { logTransaction } from "../services/transactionService";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext";

interface MissionsPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function MissionsPage({ profile, onBack }: MissionsPageProps) {
  const { t, tDb } = useLanguage();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();
  const { showReward } = useReward();

  const [timeLeftDaily, setTimeLeftDaily] = useState("");
  const [timeLeftWeekly, setTimeLeftWeekly] = useState("");

  useEffect(() => {
    const updateTimers = () => {
      const now = new Date();

      // Daily Reset (Midnight)
      const nextDaily = new Date();
      nextDaily.setHours(24, 0, 0, 0);
      const dailyDiff = nextDaily.getTime() - now.getTime();
      const dailyHours = Math.floor(dailyDiff / (1000 * 60 * 60));
      const dailyMinutes = Math.floor(
        (dailyDiff % (1000 * 60 * 60)) / (1000 * 60),
      );
      setTimeLeftDaily(`${dailyHours}${t("time.hours_short", "h")} ${dailyMinutes}${t("time.minutes_short", "m")}`);

      // Weekly Reset (Next Monday 00:00)
      const nextWeekly = new Date();
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      nextWeekly.setDate(now.getDate() + daysUntilMonday);
      nextWeekly.setHours(0, 0, 0, 0);
      const weeklyDiff = nextWeekly.getTime() - now.getTime();
      const weeklyDays = Math.floor(weeklyDiff / (1000 * 60 * 60 * 24));
      const weeklyHours = Math.floor(
        (weeklyDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      setTimeLeftWeekly(`${weeklyDays}${t("time.days_short", "j")} ${weeklyHours}${t("time.hours_short", "h")}`);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "missions"),
      (snapshot) => {
        const missionsData = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Mission,
        );
        setMissions(missionsData.filter((m) => m.isActive));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "missions");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleClaimReward = async (mission: Mission) => {
    if (!profile.uid) return;

    const progress = profile.missionsProgress?.[mission.id];
    if (!progress || !progress.isCompleted || progress.isClaimed) return;

    try {
      const userRef = doc(db, "users", profile.uid);
      const updates: any = {
        [`missionsProgress.${mission.id}.isClaimed`]: true,
      };

      if (mission.reward?.type === "money")
        updates.money = increment(mission.reward.amount || 0);
      if (mission.reward?.type === "gems")
        updates.gems = increment(mission.reward.amount || 0);
      if (mission.reward?.type === "boost")
        updates.boostPoints = increment(mission.reward.amount || 0);
      if (mission.reward?.type === "energy")
        updates.energy = increment(mission.reward.amount || 0);
      if (mission.reward?.type === "team_slot")
        updates.teamSlots = increment(1);
      if (mission.reward?.type === "skin" && mission.reward.skinId)
        updates.skins = arrayUnion(mission.reward.skinId);

      await updateDoc(userRef, updates);

      if (mission.reward?.type === "fanz" && mission.reward.fanzId) {
        const fanzRef = doc(
          db,
          "fanz",
          `${profile.uid}_${mission.reward.fanzId}`,
        );
        const fanzDoc = await getDoc(fanzRef);
        if (!fanzDoc.exists()) {
          const templateDoc = await getDoc(
            doc(db, "fanz_templates", mission.reward.fanzId),
          );
          if (templateDoc.exists()) {
            const templateData = templateDoc.data();
            await setDoc(fanzRef, {
              id: `${profile.uid}_${mission.reward.fanzId}`,
              templateId: mission.reward.fanzId,
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

      if (mission.reward?.type === "money" && mission.reward.amount)
        await logTransaction(
          profile.uid,
          "money",
          mission.reward.amount,
          t("missions.reward_transaction", "Récompense mission: {title}").replace("{title}", tDb(mission.title)),
        );
      if (mission.reward?.type === "gems" && mission.reward.amount)
        await logTransaction(
          profile.uid,
          "gems",
          mission.reward.amount,
          t("missions.reward_transaction", "Récompense mission: {title}").replace("{title}", tDb(mission.title)),
        );

      if (mission.reward) {
        showReward({
          type: mission.reward.type as any,
          amount: mission.reward.amount,
          title: t("missions.mission_accomplished", "Mission Accomplie !"),
          subtitle: tDb(mission.title),
          card:
            mission.reward.type === "card" && mission.reward.cardId
              ? { name: t("missions.card_unlocked", "Carte Débloquée") }
              : undefined,
          skin:
            mission.reward.type === "skin" && mission.reward.skinId
              ? { name: t("missions.skin_unlocked", "Skin Débloqué") }
              : undefined,
          emote:
            mission.reward.type === "emote" && mission.reward.emoteId
              ? { name: t("missions.emote_unlocked", "Emote Débloqué") }
              : undefined,
          action:
            mission.reward.type === "action" && mission.reward.actionId
              ? { name: t("missions.action_unlocked", "Action Débloquée") }
              : undefined,
        });
      } else {
        showAlert({ title: t("missions.reward_claim_success", "Récompense récupérée !"), type: "success" });
      }
    } catch (err) {
      console.error("Error claiming mission reward", err);
      showAlert({
        title: t("missions.error", "Erreur"),
        subtitle: t("missions.error_claim", "Impossible de récupérer la récompense"),
        type: "error",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-white">
        {t("missions.loading", "Chargement...")}
      </div>
    );
  }

  const totalSuccess = Object.values(profile.missionsProgress || {}).filter(
    (m) => m.isClaimed,
  ).length;

  const displayDailyMissions = missions.filter(
    (m) =>
      (!m.period || m.period === "daily") &&
      !profile.missionsProgress?.[m.id]?.isClaimed,
  );
  const displayWeeklyMissions = missions.filter(
    (m) =>
      m.period === "weekly" && !profile.missionsProgress?.[m.id]?.isClaimed,
  );
  const displayOneShotMissions = missions.filter(
    (m) =>
      m.period === "one_shot" && !profile.missionsProgress?.[m.id]?.isClaimed,
  );

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          {t("missions.title", "Missions")}
        </h1>
        <div className="text-xs font-bold text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-widest">
          {t("missions.success_count", "{count} réussies").split("{count}").map((part, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="text-orange-500">{totalSuccess}</span>}
              {part}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        {/* Daily Missions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">
              {t("missions.daily_quests", "Quêtes Quotidiennes")}
            </h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
              {t("missions.renew_in", "Renouvellement dans {time}").replace("{time}", timeLeftDaily)}
            </span>
          </div>

          <div className="space-y-3">
            {displayDailyMissions.map((mission, idx) => {
              const progress = profile.missionsProgress?.[mission.id];
              const currentValue = progress?.currentValue || 0;
              const isCompleted = progress?.isCompleted || false;
              const isClaimed = progress?.isClaimed || false;

              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <Card
                    className={`p-4 border ${isCompleted ? "border-green-500/30 bg-green-500/5" : "border-white/5"} hover:border-white/20 transition-colors`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                          >
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                          </motion.div>
                        ) : (
                          <Circle className="w-8 h-8 text-gray-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h3
                          className={`text-sm font-black uppercase tracking-tight mb-1 ${isCompleted ? "text-green-400" : "text-white"}`}
                        >
                          {tDb(mission.title)}
                        </h3>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-black rounded-full overflow-hidden border border-white/10">
                            <div
                              className={`h-full transition-all duration-500 ${isCompleted ? "bg-green-500" : "bg-blue-500"}`}
                              style={{
                                width: `${Math.min(100, (currentValue / mission.target) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400">
                            {Math.min(currentValue, mission.target)}/
                            {mission.target}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                        {mission.reward?.type === "money" && (
                          <span className="text-green-500 font-black text-sm">
                            $
                          </span>
                        )}
                        {mission.reward?.type === "gems" && (
                          <span className="text-blue-500 font-black text-sm">
                            💎
                          </span>
                        )}
                        {mission.reward?.type === "boost" && (
                          <span className="text-purple-500 font-black text-sm">
                            ⚡
                          </span>
                        )}
                        {mission.reward?.type === "energy" && (
                          <span className="text-yellow-500 font-black text-sm">
                            ⚡
                          </span>
                        )}
                        {mission.reward?.type === "team_slot" && (
                          <span className="text-orange-500 font-black text-sm">
                            🛡️
                          </span>
                        )}
                        {mission.reward?.type === "fanz" && (
                          <span className="text-pink-500 font-black text-sm">
                            👤
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-white mt-1">
                          {mission.reward?.type === "team_slot" ||
                          mission.reward?.type === "fanz"
                            ? "+1"
                            : `+${mission.reward?.amount || 0}`}
                        </span>
                      </div>
                    </div>

                    {isCompleted && !isClaimed && (
                      <Button
                        className="w-full mt-3 bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs h-8"
                        onClick={() => handleClaimReward(mission)}
                      >
                        {t("missions.claim", "Récupérer")}
                      </Button>
                    )}
                    {isClaimed && (
                      <div className="w-full mt-3 py-1.5 bg-green-500/10 text-green-500 text-center font-black uppercase text-xs rounded-lg border border-green-500/20">
                        {t("missions.claimed", "Récupéré")}
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
            {displayDailyMissions.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm italic">
                {t("missions.no_daily", "Aucune quête quotidienne disponible.")}
              </div>
            )}
          </div>
        </section>

        {/* Weekly Missions */}
        <section>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">
              {t("missions.weekly_quests", "Quêtes Hebdomadaires")}
            </h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
              {t("missions.renew_in", "Renouvellement dans {time}").replace("{time}", timeLeftWeekly)}
            </span>
          </div>

          <div className="space-y-3">
            {displayWeeklyMissions.map((mission, idx) => {
              const progress = profile.missionsProgress?.[mission.id];
              const currentValue = progress?.currentValue || 0;
              const isCompleted = progress?.isCompleted || false;
              const isClaimed = progress?.isClaimed || false;

              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <Card
                    className={`p-4 border ${isCompleted ? "border-green-500/30 bg-green-500/5" : "border-white/5"} hover:border-white/20 transition-colors`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                          >
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                          </motion.div>
                        ) : (
                          <Circle className="w-8 h-8 text-gray-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h3
                          className={`text-sm font-black uppercase tracking-tight mb-1 ${isCompleted ? "text-green-400" : "text-white"}`}
                        >
                          {tDb(mission.title)}
                        </h3>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-black rounded-full overflow-hidden border border-white/10">
                            <div
                              className={`h-full transition-all duration-500 ${isCompleted ? "bg-green-500" : "bg-blue-500"}`}
                              style={{
                                width: `${Math.min(100, (currentValue / mission.target) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400">
                            {Math.min(currentValue, mission.target)}/
                            {mission.target}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                        {mission.reward?.type === "money" && (
                          <span className="text-green-500 font-black text-sm">
                            $
                          </span>
                        )}
                        {mission.reward?.type === "gems" && (
                          <span className="text-blue-500 font-black text-sm">
                            💎
                          </span>
                        )}
                        {mission.reward?.type === "boost" && (
                          <span className="text-purple-500 font-black text-sm">
                            ⚡
                          </span>
                        )}
                        {mission.reward?.type === "energy" && (
                          <span className="text-yellow-500 font-black text-sm">
                            ⚡
                          </span>
                        )}
                        {mission.reward?.type === "team_slot" && (
                          <span className="text-orange-500 font-black text-sm">
                            🛡️
                          </span>
                        )}
                        {mission.reward?.type === "fanz" && (
                          <span className="text-pink-500 font-black text-sm">
                            👤
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-white mt-1">
                          {mission.reward?.type === "team_slot" ||
                          mission.reward?.type === "fanz"
                            ? "+1"
                            : `+${mission.reward?.amount || 0}`}
                        </span>
                      </div>
                    </div>

                    {isCompleted && !isClaimed && (
                      <Button
                        className="w-full mt-3 bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs h-8"
                        onClick={() => handleClaimReward(mission)}
                      >
                        {t("missions.claim", "Récupérer")}
                      </Button>
                    )}
                    {isClaimed && (
                      <div className="w-full mt-3 py-1.5 bg-green-500/10 text-green-500 text-center font-black uppercase text-xs rounded-lg border border-green-500/20">
                        {t("missions.claimed", "Récupéré")}
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
            {displayWeeklyMissions.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm italic">
                {t("missions.no_weekly", "Aucune quête hebdomadaire disponible.")}
              </div>
            )}
          </div>
        </section>

        {/* One Shot Missions */}
        <section>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">
              {t("missions.one_shot_quests", "Quêtes Uniques")}
            </h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {t("missions.one_shot_desc", "Une seule fois")}
            </span>
          </div>

          <div className="space-y-3">
            {displayOneShotMissions.map((mission, idx) => {
              const progress = profile.missionsProgress?.[mission.id];
              const currentValue = progress?.currentValue || 0;
              const isCompleted = progress?.isCompleted || false;
              const isClaimed = progress?.isClaimed || false;

              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <Card
                    className={`p-4 border ${isCompleted ? "border-green-500/30 bg-green-500/5" : "border-white/5"} hover:border-white/20 transition-colors`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                          >
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                          </motion.div>
                        ) : (
                          <Circle className="w-8 h-8 text-gray-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h3
                          className={`text-sm font-black uppercase tracking-tight mb-1 ${isCompleted ? "text-green-400" : "text-white"}`}
                        >
                          {tDb(mission.title)}
                        </h3>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-black rounded-full overflow-hidden border border-white/10">
                            <div
                              className={`h-full transition-all duration-500 ${isCompleted ? "bg-green-500" : "bg-blue-500"}`}
                              style={{
                                width: `${Math.min(100, (currentValue / mission.target) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400">
                            {Math.min(currentValue, mission.target)}/
                            {mission.target}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                        {mission.reward?.type === "money" && (
                          <span className="text-green-500 font-black text-sm">
                            $
                          </span>
                        )}
                        {mission.reward?.type === "gems" && (
                          <span className="text-blue-500 font-black text-sm">
                            💎
                          </span>
                        )}
                        {mission.reward?.type === "boost" && (
                          <span className="text-purple-500 font-black text-sm">
                            ⚡
                          </span>
                        )}
                        {mission.reward?.type === "energy" && (
                          <span className="text-yellow-500 font-black text-sm">
                            ⚡
                          </span>
                        )}
                        {mission.reward?.type === "team_slot" && (
                          <span className="text-orange-500 font-black text-sm">
                            🛡️
                          </span>
                        )}
                        {mission.reward?.type === "fanz" && (
                          <span className="text-pink-500 font-black text-sm">
                            👤
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-white mt-1">
                          {mission.reward?.type === "team_slot" ||
                          mission.reward?.type === "fanz"
                            ? "+1"
                            : `+${mission.reward?.amount || 0}`}
                        </span>
                      </div>
                    </div>

                    {isCompleted && !isClaimed && (
                      <Button
                        className="w-full mt-3 bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs h-8"
                        onClick={() => handleClaimReward(mission)}
                      >
                        {t("missions.claim", "Récupérer")}
                      </Button>
                    )}
                    {isClaimed && (
                      <div className="w-full mt-3 py-1.5 bg-green-500/10 text-green-500 text-center font-black uppercase text-xs rounded-lg border border-green-500/20">
                        {t("missions.claimed", "Récupéré")}
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
            {displayOneShotMissions.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm italic">
                {t("missions.no_one_shot", "Aucune quête unique disponible.")}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
