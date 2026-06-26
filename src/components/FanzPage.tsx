import React, { useState, useEffect } from "react";
import { getImageUrl, cn } from "../lib/utils";
import { useLanguage } from "../context/LanguageContext";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { Card, Button } from "./Layout";
import { FanzTemplate, Fanz, UserProfile, GlobalFervorConfig } from "../types";
import {
  Trophy,
  Lock,
  Star,
  Info,
  Medal,
  Users,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { OptimizedMedia } from "./OptimizedMedia";
import { generateFervorPath } from "../utils/fervorPath";
import { MrFanzHelp } from "./MrFanzHelp";

interface FanzPageProps {
  userProfile: UserProfile;
  onFanzClick?: (fanzId: string) => void;
  onNavigate?: (view: any) => void;
}

export function FanzPage({ userProfile, onFanzClick, onNavigate }: FanzPageProps) {
  const { t } = useLanguage();
  const [ownedFanz, setOwnedFanz] = useState<Map<string, Fanz>>(new Map()); // templateId -> Fanz object
  const [fanzTemplates, setFanzTemplates] = useState<FanzTemplate[]>([]);
  const [fanzFervorConfig, setFanzFervorConfig] = useState<
    GlobalFervorConfig | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "owned" | "missing">("all");

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "fanz_templates"));
        const templates = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as FanzTemplate,
        );
        setFanzTemplates(templates);

        const configDoc = await getDoc(
          doc(db, "global_configs", "fanz_fervor"),
        );
        if (configDoc.exists()) {
          setFanzFervorConfig(configDoc.data() as GlobalFervorConfig);
        }
      } catch (err) {
        console.error("Error fetching fanz templates", err);
      }
    };
    fetchTemplates();

    const q = query(
      collection(db, "fanz"),
      where("ownerUid", "==", userProfile.uid),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fanzMap = new Map<string, Fanz>();
        snapshot.forEach((doc) => {
          const data = doc.data() as Fanz;
          if (data.templateId) {
            fanzMap.set(data.templateId, data);
          }
        });
        setOwnedFanz(fanzMap);
        setLoading(false);
      },
      (error) => {
        console.error("Error in FanzPage fanz listener:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userProfile.uid]);

  const globalFerveurPath = React.useMemo(() => {
    let calculatedMax = 0;
    fanzTemplates.forEach((f) => {
      const fMax =
        f.ferveurConfig?.ranges?.[f.ferveurConfig.ranges.length - 1]?.max ||
        150000;
      calculatedMax += fMax;
    });
    const maxPoints = calculatedMax > 0 ? calculatedMax : 150000;

    if (fanzFervorConfig) {
      return generateFervorPath(maxPoints, fanzFervorConfig);
    }
    return [];
  }, [fanzFervorConfig, fanzTemplates]);

  const filteredFanz = fanzTemplates.filter((f) => {
    if (filter === "owned") return ownedFanz.has(f.id);
    if (filter === "missing") return !ownedFanz.has(f.id);
    return true;
  });

  const ownedCount = ownedFanz.size;
  const totalCount = fanzTemplates.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">
          {t("fanz.loading_museum", "Chargement de votre musée...")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-black italic uppercase tracking-tighter flex items-center">
            FANZ
            <MrFanzHelp contextId="fanz" />
          </h1>
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 flex items-center justify-center gap-3">
              <button
                onClick={() => setFilter(filter === "owned" ? "all" : "owned")}
                className={cn(
                  "text-center transition-all",
                  filter === "owned"
                    ? "opacity-100 scale-110"
                    : "opacity-50 hover:opacity-100",
                )}
              >
                <div className="text-sm font-black text-orange-500 leading-none">
                  {ownedCount}
                </div>
                <div className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">
                  {t("fanz.earned", "Gagnés")}
                </div>
              </button>
              <div className="h-4 w-px bg-white/10"></div>
              <button
                onClick={() =>
                  setFilter(filter === "missing" ? "all" : "missing")
                }
                className={cn(
                  "text-center transition-all",
                  filter === "missing"
                    ? "opacity-100 scale-110"
                    : "opacity-50 hover:opacity-100",
                )}
              >
                <div className="text-sm font-black text-gray-400 leading-none">
                  {totalCount - ownedCount}
                </div>
                <div className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">
                  {t("fanz.to_earn_or_buy", "À Gagner ou Acheter")}
                </div>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div
                className="absolute inset-y-0 left-0 bg-orange-500 transition-all duration-1000 flex items-center justify-center"
                style={{
                  width: `${Math.max(8, (ownedCount / totalCount) * 100)}%`,
                }}
              >
                <span className="text-[7px] font-black text-white px-1">
                  {Math.round((ownedCount / totalCount) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key="collection"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-12"
        >
          {/* Owned Section */}
          {(filter === "all" || filter === "owned") && ownedCount > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                <h2 className="text-xl font-black italic uppercase tracking-wider">
                  {t("fanz.earned_title", "FANZ Gagnés")}
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 bg-orange-500/20 text-orange-500 rounded-full">
                  {ownedCount}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {fanzTemplates
                  .filter((f) => ownedFanz.has(f.id))
                  .sort((a, b) => {
                    const fanzA = ownedFanz.get(a.id);
                    const fanzB = ownedFanz.get(b.id);
                    const isActA = fanzA ? userProfile.activeFanzId === fanzA.id : false;
                    const isActB = fanzB ? userProfile.activeFanzId === fanzB.id : false;
                    
                    if (isActA && !isActB) return -1;
                    if (!isActA && isActB) return 1;
                    
                    return (a.name || "").localeCompare(b.name || "", "fr");
                  })
                  .map((template) => (
                    <FanzCard
                      key={template.id}
                      template={template}
                      fanz={ownedFanz.get(template.id)}
                      isOwned={true}
                      isActive={
                        userProfile.activeFanzId ===
                        ownedFanz.get(template.id)?.id
                      }
                      onClick={() =>
                        onFanzClick &&
                        onFanzClick(ownedFanz.get(template.id)!.id)
                      }
                      userProfile={userProfile}
                      globalFerveurPath={globalFerveurPath}
                      onSetActive={async (e) => {
                        e.stopPropagation();
                        try {
                          const fanzToSet = ownedFanz.get(template.id);
                          if (fanzToSet) {
                            await updateDoc(doc(db, "users", userProfile.uid), {
                              activeFanzId: fanzToSet.id,
                            });
                          }
                        } catch (error) {
                          console.error("Error setting active FANZ:", error);
                        }
                      }}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Missing Section */}
          {(filter === "all" || filter === "missing") &&
            totalCount - ownedCount > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                  <Lock className="w-5 h-5 text-gray-500" />
                  <h2 className="text-xl font-black italic uppercase tracking-wider text-gray-500">
                    {t("fanz.to_earn_or_buy_title", "FANZ à Gagner ou Acheter")}
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 bg-white/10 text-gray-500 rounded-full">
                    {totalCount - ownedCount}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {fanzTemplates
                    .filter((f) => !ownedFanz.has(f.id))
                    .sort((a, b) => {
                      const isActiveA = a.isActive !== false;
                      const isActiveB = b.isActive !== false;
                      
                      if (isActiveA && !isActiveB) return -1;
                      if (!isActiveA && isActiveB) return 1;
                      
                      return (a.name || "").localeCompare(b.name || "", "fr");
                    })
                    .map((template) => (
                      <FanzCard
                        key={template.id}
                        template={template}
                        isOwned={false}
                        userProfile={userProfile}
                        globalFerveurPath={globalFerveurPath}
                        onClick={() => {
                          if (template.isActive !== false && onNavigate) {
                            onNavigate("shop");
                          }
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FanzCard({
  template,
  fanz,
  isOwned,
  isActive,
  onClick,
  onSetActive,
  onUnlock,
  userProfile,
  globalFerveurPath = [],
}: {
  template: FanzTemplate;
  fanz?: Fanz;
  isOwned: boolean;
  isActive?: boolean;
  onClick?: () => void;
  onSetActive?: (e: React.MouseEvent) => void;
  onUnlock?: () => void;
  userProfile?: UserProfile;
  globalFerveurPath?: any[];
}) {
  const { t, tDb } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);

  const equippedSkinData = template.skins?.find(
    (s) => s.id === fanz?.equippedSkin,
  );

  let currentImageUrl = template.image;
  let currentVideoUrl = template.video;

  if (fanz?.imageUrl) currentImageUrl = fanz.imageUrl;
  if (fanz?.videoUrl) currentVideoUrl = fanz.videoUrl;

  if (equippedSkinData) {
    currentImageUrl = equippedSkinData.imageUrl || currentImageUrl;
    currentVideoUrl = equippedSkinData.videoUrl || null;
  }

  const finalVideoUrl = getImageUrl(currentVideoUrl);
  if (!finalVideoUrl) {
    currentVideoUrl = null;
  }

  const hasClaimableFerveur = React.useMemo(() => {
    if (!isOwned || !fanz) return false;
    const fPath = template.ferveurPath?.length
      ? template.ferveurPath
      : fanz.ferveurPath?.length
        ? fanz.ferveurPath
        : globalFerveurPath;
    if (!fPath) return false;
    return fPath.some((step) => {
      const slotId = step.isIntermediate
        ? `ferveur-inter-${step.id || step.pointsRequired}`
        : `ferveur-level-${step.level}`;
      return (
        (fanz.ferveurPoints || 0) >= step.pointsRequired &&
        !fanz.claimedRewards?.includes(slotId)
      );
    });
  }, [isOwned, fanz, template.ferveurPath, globalFerveurPath]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`relative group ${(!isOwned && template.isActive === false) ? "" : "cursor-pointer"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(!isOwned && template.isActive === false) ? undefined : onClick}
    >
      <Card
        className={`overflow-hidden p-0 border transition-all duration-500 ${
          isOwned
            ? "border-orange-500/30 hover:border-orange-500 shadow-lg hover:shadow-orange-500/20"
            : "border-white/5 grayscale hover:grayscale-0 hover:border-orange-500/50"
        }`}
      >
        <div className="aspect-[3/4] relative overflow-hidden">
          {hasClaimableFerveur && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)] z-20" />
          )}
          
          {/* Image de fond permanente pour éviter tout clignotement ou déchargement d'image */}
          <OptimizedMedia
            type="image"
            src={currentImageUrl || ""}
            alt={tDb(equippedSkinData?.name || template.name)}
            className="w-full h-full object-cover"
          />

          {/* Vidéo superposée au survol fluide */}
          {currentVideoUrl && !userProfile?.dataSaver && (
            <div
              className={`absolute inset-0 w-full h-full transition-opacity duration-300 z-10 ${
                isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <OptimizedMedia
                type="video"
                src={currentVideoUrl}
                dataSaver={userProfile?.dataSaver}
                className="w-full h-full object-cover"
                forceUnmuted={true}
                autoPlay={isHovered}
              />
            </div>
          )}

          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Rarity Badge */}
          <div
            className={`absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[7px] sm:text-[9px] font-black uppercase tracking-tighter z-10 ${
              template.rarity === "legendary"
                ? "bg-yellow-500 text-black"
                : template.rarity === "epic"
                  ? "bg-purple-500 text-white"
                  : template.rarity === "rare"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-500 text-white"
            }`}
          >
            {template.rarity === "legendary" ? t("rarity.legendary", "Légendaire") :
             template.rarity === "epic" ? t("rarity.epic", "Épique") :
             template.rarity === "rare" ? t("rarity.rare", "Rare") :
             t("rarity.common", "Commun")}
          </div>

          {/* Rank Badge (Owned only) */}
          {isOwned && fanz && (
            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-orange-600 text-white text-[7px] sm:text-[9px] font-black uppercase z-10 shadow-lg">
              {t("fanz.rank_level", "Rang {rank}").replace("{rank}", fanz.rank.toString())}
            </div>
          )}

          {/* Active Badge or Set Active Button */}
          {isActive ? (
            <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-green-500 text-white text-[7px] sm:text-[9px] font-black uppercase z-10 shadow-lg flex items-center gap-1">
              <CheckCircle className="w-2 h-2 sm:w-3 sm:h-3" />
              {t("fanz.active_status", "Actif")}
            </div>
          ) : isOwned && fanz && onSetActive && template.isActive !== false ? (
            <button
              onClick={onSetActive}
              className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-orange-500/80 hover:bg-orange-500 text-white text-[7px] sm:text-[9px] font-black uppercase z-10 shadow-lg transition-colors opacity-0 group-hover:opacity-100"
            >
              {t("fanz.set_active", "Définir Actif")}
            </button>
          ) : null}

          {!isOwned && template.isActive !== false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white/50" />
              <span className="text-[8px] sm:text-[10px] font-black uppercase italic text-white/50 mt-1 text-center px-2">
                {t("fanz.to_earn_or_buy_uppercase", "À GAGNER OU ACHETER")}
              </span>
            </div>
          )}

          {template.isActive === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
              <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white/50 mb-2" />
              <div className="bg-orange-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                {t("fanz.soon_available", "Bientôt dispo")}
              </div>
            </div>
          )}

          {/* Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 space-y-1 z-10">
            {isOwned && fanz && (
              <div className="space-y-1 mb-1 sm:mb-2">
                <div className="flex items-center justify-between text-[6px] sm:text-[8px] font-black uppercase text-orange-400">
                  <span>{t("home.fervor", "Ferveur")}</span>
                  <span>{fanz.ferveurPoints} pts</span>
                </div>
                <div className="h-1 sm:h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                    style={{
                      width: `${Math.min(100, (fanz.ferveurPoints / ((globalFerveurPath.length > 0 ? globalFerveurPath : template.ferveurPath || []).find((l) => l.level === fanz.ferveurLevel + 1)?.pointsRequired || 100)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            <h3 className="font-black italic uppercase text-[10px] sm:text-xs leading-tight truncate text-white">
              {tDb(equippedSkinData?.name || template.name)}
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-[7px] sm:text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                {isOwned ? t("fanz.collected", "Collectionné") : t("fanz.locked", "Verrouillé")}
              </span>
              <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400 cursor-help" />
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
