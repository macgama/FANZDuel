import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { 
  Trophy, 
  Swords, 
  Sparkles, 
  Layers, 
  ChevronRight,
  Flame,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingTutorialProps {
  profile: UserProfile;
  onComplete: () => void;
}

const STEPS = [
  {
    title: "Bienvenue dans The Best Fan",
    description: "Le premier jeu de duel en direct pour les supporters de football. Défends tes couleurs pendant les vrais matchs de ton équipe !",
    icon: Trophy,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    video: "https://thebestfan.online/img/public/tuto/video1.mp4"
  },
  {
    title: "Adopte ton Fanz",
    description: "Choisis ton personnage, entraîne-le, améliore ses caractéristiques et débloque des skins ou des animations pour frimer !",
    icon: Sparkles,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    video: "https://thebestfan.online/img/public/tuto/video2.mp4"
  },
  {
    title: "Collectionne les Cartes",
    description: "Constitue un deck de cartes stratégiques (objets, chants, malus) pour te donner un avantage décisif pendant les duels.",
    icon: Layers,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    video: "https://thebestfan.online/img/public/tuto/video3.mp4"
  },
  {
    title: "Gagne tes Duels",
    description: "Pendant les matchs, rejoins un duel. Clique le plus vite possible pour tirer la corde et utilise tes cartes au bon moment !",
    icon: Swords,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    video: "https://thebestfan.online/img/public/tuto/video4.mp4"
  },
  {
    title: "Progression & Stats",
    description: "La montée en compétences de tes FANZ se fait grâce aux actions LIFE ! Améliore tes stats pour être plus fort et plus résistant durant les duels.",
    icon: Flame,
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20"
  },
  {
    title: "Ferveur et Récompenses",
    description: "Gagne de la ferveur pour monter en grade, complète tes missions quotidiennes et débloque un maximum de récompenses !",
    icon: Trophy,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    video: "https://thebestfan.online/img/public/tuto/video5.mp4"
  }
];

export function OnboardingTutorial({ profile, onComplete }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finishTutorial();
    }
  };

  const finishTutorial = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        hasCompletedOnboarding: true
      });
      onComplete();
    } catch (error) {
      console.error("Error setting onboarding status", error);
      setIsFinishing(false);
    }
  };

  const step = STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-md bg-[#0a0a0a] border border-orange-500/20 rounded-3xl overflow-hidden shadow-2xl relative"
      >
        {/* Passer le tutoriel */}
        <button
          onClick={finishTutorial}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors z-20 bg-black/50 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-6 flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center w-full"
            >
              {step.video ? (
                <div className="w-full aspect-[4/3] sm:aspect-video rounded-xl overflow-hidden mb-6 border border-white/10 bg-black/50 shadow-lg relative flex items-center justify-center">
                  <video 
                    src={step.video} 
                    className="w-full h-full object-contain" 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                  />
                  {/* Keep icon as a watermark/small decorative element */}
                  <div className={cn("absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center border shadow-lg bg-black/60 backdrop-blur-sm", step.border)}>
                    <StepIcon className={cn("w-5 h-5", step.color)} />
                  </div>
                </div>
              ) : (
                <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-6 border", step.bg, step.border)}>
                  <StepIcon className={cn("w-12 h-12", step.color)} />
                </div>
              )}
              
              <h2 className="text-2xl font-black uppercase tracking-wider mb-4 text-white">
                {step.title}
              </h2>
              
              <p className="text-gray-400 text-sm leading-relaxed max-w-[280px]">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                idx === currentStep ? "w-6 bg-orange-500" : "w-1.5 bg-white/20"
              )}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/5 border-t border-white/10 flex justify-center">
          <button
            onClick={handleNext}
            disabled={isFinishing}
            className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] flex items-center justify-center gap-2"
          >
            {isFinishing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : currentStep < STEPS.length - 1 ? (
              <>
                Suivant <ChevronRight className="w-5 h-5" />
              </>
            ) : (
              "Commencer à jouer"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
