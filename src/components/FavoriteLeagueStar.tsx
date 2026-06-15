import React from 'react';
import { Star } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

interface FavoriteLeagueStarProps {
  leagueId: number | string;
  profile?: UserProfile | null;
  className?: string;
  iconClassName?: string;
}

export function FavoriteLeagueStar({ leagueId, profile, className = '', iconClassName = '' }: FavoriteLeagueStarProps) {
  if (!profile) return null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const favLeagues = profile.favoriteLeagues || [];
    const idStr = leagueId.toString();
    const isFav = favLeagues.includes(idStr);
    
    const newFavs = isFav 
      ? favLeagues.filter((lId: string) => lId !== idStr)
      : [...favLeagues, idStr];
      
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        favoriteLeagues: newFavs
      });
    } catch (err) {
      console.error("Error updating favorite leagues", err);
    }
  };

  const isFavorite = profile.favoriteLeagues?.includes(leagueId.toString());

  return (
    <button
      onClick={handleToggle}
      className={`focus:outline-none flex items-center justify-center transition-transform ${className}`}
    >
      <Star 
        className={`transition-colors ${isFavorite ? 'text-orange-500 fill-orange-500' : 'text-gray-500 hover:text-gray-300'} ${iconClassName || 'w-4 h-4'}`} 
      />
    </button>
  );
}
