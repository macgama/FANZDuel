import React, { createContext, useContext, useState, useCallback } from 'react';
import { RewardAlert, RewardData } from '../components/RewardAlert';

interface RewardContextType {
  showReward: (reward: RewardData) => void;
}

const RewardContext = createContext<RewardContextType | undefined>(undefined);

export function RewardProvider({ children }: { children: React.ReactNode }) {
  const [activeReward, setActiveReward] = useState<RewardData | null>(null);

  const showReward = useCallback((reward: RewardData) => {
    setActiveReward(reward);
  }, []);

  const handleClose = () => {
    setActiveReward(null);
  };

  return (
    <RewardContext.Provider value={{ showReward }}>
      {children}
      <RewardAlert reward={activeReward} onClose={handleClose} />
    </RewardContext.Provider>
  );
}

export function useReward() {
  const context = useContext(RewardContext);
  if (context === undefined) {
    throw new Error('useReward must be used within a RewardProvider');
  }
  return context;
}
