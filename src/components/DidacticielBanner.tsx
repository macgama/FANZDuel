import React, { useEffect, useState } from "react";
import { UserProfile } from "../types";
import { db } from "../firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { ChevronRight, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { footballApi } from "../services/footballApi";

interface DidacticielBannerProps {
  profile: UserProfile;
  onClickStep1: (fanzId?: string) => void;
  onClickStep2: (fanzId: string) => void;
  onClickStep3: (matchId: number) => void;
  onClickStep4: () => void;
  onClickStep5: (fanzId: string) => void;
  onClickStep6: () => void;
  onClickStep7: () => void;
  onClickStep8: () => void;
}

export function DidacticielBanner({ 
  profile, 
  onClickStep1, 
  onClickStep2, 
  onClickStep3,
  onClickStep4,
  onClickStep5,
  onClickStep6,
  onClickStep7,
  onClickStep8
}: DidacticielBannerProps) {
  const [firstFanzId, setFirstFanzId] = useState<string | null>(null);
  const [activeFanz, setActiveFanz] = useState<any>(null);
  const [upcomingMatch, setUpcomingMatch] = useState<any>(null);
  const [theBestFanInvited, setTheBestFanInvited] = useState<boolean>(false);
  const [theBestFanUid, setTheBestFanUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Step logic
  const hasActiveFanz = !!profile.activeFanzId;
  const hasDeck = hasActiveFanz && activeFanz?.equippedCards && activeFanz.equippedCards.length > 0;
  const hasPlayedDuel = (profile.matchesParticipated || 0) > 0 || (profile.duels_training_count || 0) > 0;
  const hasSecondTeam = (profile.favoriteTeams?.length || 0) >= 2;
  const hasDoneLifeAction = hasActiveFanz && ((activeFanz?.xp || 0) > 0 || !!profile.activeAction || Object.keys(activeFanz?.lifeActionProgress || {}).length > 0);
  
  // They have invited TheBestFan if the UID is in friendRequests or friends
  const hasInvitedBestFan = theBestFanInvited || (theBestFanUid ? (profile.friends?.includes(theBestFanUid)) : false);
  
  const hasEmote = (profile.emotes?.length || 0) > 0 || (activeFanz?.unlockedEmotes?.length || 0) > 0;
  const hasFinishedDidacticiel = profile.hasCompletedDidacticiel === true;

  useEffect(() => {
    let isMounted = true;
    
    const loadTutorialData = async () => {
      try {
        if (!profile.activeFanzId) {
          // Need to load their first fanz for step 1
          const q = query(collection(db, "fanz"), where("ownerUid", "==", profile.uid));
          const snap = await getDocs(q);
          if (!snap.empty && isMounted) {
            setFirstFanzId(snap.docs[0].id);
          }
        } else {
          // Need to load their active fanz for step 2 & 5
          const fanzDoc = await getDoc(doc(db, "fanz", profile.activeFanzId));
          if (fanzDoc.exists() && isMounted) {
            setActiveFanz({ id: fanzDoc.id, ...fanzDoc.data() });
          }
        }

        // Upcoming match for Step 3
        const today = new Date().toISOString().split('T')[0];
        const fixtures = await footballApi.getFixturesByDate(today);
        if (isMounted) {
          const upcoming = fixtures.find((f: any) => ['NS', 'TBD'].includes(f.fixture.status.short));
          if (upcoming) {
            setUpcomingMatch(upcoming);
          } else if (fixtures.length > 0) {
            setUpcomingMatch(fixtures[0]);
          }
        }

        // Check for TheBestFan user for Step 6
        const fbQuery = query(collection(db, "users"), where("pseudo", "==", "TheBestFan"));
        const fbSnap = await getDocs(fbQuery);
        if (!fbSnap.empty && isMounted) {
          const theBestFanData = fbSnap.docs[0].data();
          setTheBestFanUid(fbSnap.docs[0].id);
          if (theBestFanData.friendRequests?.includes(profile.uid) || theBestFanData.friends?.includes(profile.uid)) {
            setTheBestFanInvited(true);
          }
        } else if (isMounted) {
          // Fallback if TheBestFan doesn't exist, we just skip it logically or assume empty check
          setTheBestFanUid("fallback_uid");
        }

      } catch (err) {
        console.error("Error loading didacticiel data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (!hasFinishedDidacticiel) {
      loadTutorialData();
    } else {
      setLoading(false);
    }
    
    return () => {
      isMounted = false;
    };
  }, [profile.activeFanzId, profile.uid, hasFinishedDidacticiel]);

  if (loading || hasFinishedDidacticiel) return null;

  let stepTitle = "";
  let stepSub = "";
  let stepCount = "";
  let onClickHandler = () => {};

  if (!hasActiveFanz) {
    stepTitle = "Active ton premier FANZ";
    stepCount = "1/8";
    onClickHandler = () => { onClickStep1(firstFanzId || undefined); };
  } else if (!hasDeck) {
    stepTitle = "Crée ton deck";
    stepCount = "2/8";
    onClickHandler = () => { onClickStep2(profile.activeFanzId!); };
  } else if (!hasPlayedDuel) {
    stepTitle = "Crée ton premier duel d'entraînement";
    stepSub = "Uniquement sur les matchs À Venir ! Les modes ranked se font sur les matchs Live.";
    stepCount = "3/8";
    onClickHandler = () => { if (upcomingMatch) onClickStep3(upcomingMatch.fixture.id); };
  } else if (!hasSecondTeam) {
    stepTitle = "Choisis une 2ème équipe favorite";
    stepCount = "4/8";
    onClickHandler = () => { onClickStep4(); };
  } else if (!hasDoneLifeAction) {
    stepTitle = "Choisis une action LIFE";
    stepSub = "Augmente les stats de ton FANZ !";
    stepCount = "5/8";
    onClickHandler = () => { onClickStep5(profile.activeFanzId!); };
  } else if (theBestFanUid && !hasInvitedBestFan) {
    stepTitle = "Invite TheBestFan à être ton ami";
    stepCount = "6/8";
    onClickHandler = () => { onClickStep6(); };
  } else if (!hasEmote) {
    stepTitle = "Achète ton premier Emote dans le Shop";
    stepCount = "7/8";
    onClickHandler = () => { onClickStep7(); };
  } else {
    stepTitle = "Deviens le meilleur Fan Online !";
    stepSub = "Suis tes équipes, joue des entraînements (À Venir) ou matchs classés (Lives) !";
    stepCount = "8/8";
    onClickHandler = async () => { 
      try {
        await updateDoc(doc(db, "users", profile.uid), {
          hasCompletedDidacticiel: true
        });
        onClickStep8(); 
      } catch (e) {
        console.error(e);
      }
    };
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full px-4 sm:px-8 mb-4 flex justify-center z-[40]"
      >
        <button
          onClick={onClickHandler}
          className="w-full relative flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-orange-600 to-orange-500 border border-orange-400 rounded-xl hover:from-orange-500 hover:to-orange-400 text-left shadow-lg shadow-orange-500/20 group overflow-hidden"
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
          
          <div className="flex flex-col items-start gap-1 z-10 w-full pr-8">
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-200">
              Didacticiel ({stepCount})
            </span>
            <span className="text-sm font-bold text-white text-left leading-tight">
              {stepTitle}
            </span>
            {stepSub && (
              <span className="text-[10px] font-medium text-orange-100 text-left leading-tight line-clamp-2">
                {stepSub}
              </span>
            )}
          </div>
          
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center z-10 shrink-0 group-hover:scale-110 transition-transform">
            <ArrowRight className="w-5 h-5 text-white" />
          </div>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

