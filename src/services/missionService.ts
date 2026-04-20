import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { Mission, UserProfile } from '../types';

export const progressMission = async (
  userProfile: UserProfile,
  missionType: Mission['type'],
  amount: number = 1
) => {
  if (!userProfile?.uid) return;

  try {
    const userRef = doc(db, 'users', userProfile.uid);
    const [missionsSnap, userSnap] = await Promise.all([
      getDocs(collection(db, 'missions')),
      getDoc(userRef)
    ]);
    
    if (!userSnap.exists()) return;
    const freshUserData = userSnap.data() as UserProfile;

    const activeMissions = missionsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Mission))
      .filter(m => m.isActive && m.type === missionType);

    if (activeMissions.length === 0) return;

    const updates: Record<string, any> = {};
    let hasUpdates = false;

    for (const mission of activeMissions) {
      const currentProgress = freshUserData.missionsProgress?.[mission.id]?.currentValue || 0;
      const isAlreadyCompleted = freshUserData.missionsProgress?.[mission.id]?.isCompleted || false;

      if (!isAlreadyCompleted) {
        const newValue = currentProgress + amount;
        updates[`missionsProgress.${mission.id}.currentValue`] = increment(amount);
        updates[`missionsProgress.${mission.id}.missionId`] = mission.id;
        
        if (newValue >= mission.target) {
          updates[`missionsProgress.${mission.id}.isCompleted`] = true;
        }
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      await updateDoc(userRef, updates);
    }
  } catch (err) {
    console.error('Error updating missions progress:', err);
  }
};
