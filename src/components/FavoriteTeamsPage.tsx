import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { Search, Plus, Shield, ChevronLeft } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { footballApi } from '../services/footballApi';
import { Button, Card } from './Layout';
import { useAlert } from '../context/AlertContext';
import { handleFirestoreError, OperationType } from '../firebase';
import { logTransaction } from '../services/transactionService';

interface FavoriteTeamsPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function FavoriteTeamsPage({ profile, onBack }: FavoriteTeamsPageProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const { showAlert } = useAlert();

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const favoriteTeams = profile.favoriteTeams || [];
        const teamData = await Promise.all(
          favoriteTeams.map(async (teamIdOrName) => {
            const teamIdStr = teamIdOrName.toString();
            const teamDoc = await getDoc(doc(db, 'teams', teamIdStr));
            
            if (teamDoc.exists()) {
              const data = teamDoc.data();
              if (data.logo && data.name) {
                return { id: teamDoc.id, ...data };
              }
              // Found doc but missing data - try fallback below
            }
            
            // Try fallback API fetch
            try {
              let teamApiData = null;
              
              if (!isNaN(Number(teamIdStr))) {
                const res = await footballApi.getTeamInfo(Number(teamIdStr));
                if (res && res.team) teamApiData = res.team;
              } else {
                const results = await footballApi.searchTeams(teamIdStr);
                const matching = results?.find((r: any) => r.team.name.toLowerCase() === teamIdStr.toLowerCase());
                if (matching) teamApiData = matching.team;
              }

              if (teamApiData) {
                // Update DB with missing info if we found it
                const teamRef = doc(db, 'teams', teamApiData.id.toString());
                const updates = {
                  name: teamApiData.name,
                  logo: teamApiData.logo,
                  updatedAt: new Date().toISOString()
                };
                await setDoc(teamRef, updates, { merge: true });
                return { id: teamApiData.id.toString(), ...updates };
              }
            } catch (e) {
              console.error(`Failed to fetch team data for ${teamIdStr}:`, e);
            }

            // Ultimate fallback: display what we have
            const existingName = teamDoc.exists() ? teamDoc.data().name : null;
            return { 
              id: teamIdStr, 
              name: existingName || teamIdStr, 
              logo: teamDoc.exists() ? teamDoc.data().logo : '' 
            };
          })
        );
        setTeams(teamData);
      } catch (error) {
        console.error("Error fetching favorite teams:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [profile.favoriteTeams]);

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await footballApi.searchTeams(searchQuery);
        setSearchResults(results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    };
    
    const timeoutId = setTimeout(search, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleAddTeam = async (team: any) => {
    const favoriteTeams = profile.favoriteTeams || [];
    if (favoriteTeams.length >= (profile.teamSlots || 1)) {
      showAlert({ type: 'error', title: 'Limite atteinte', subtitle: 'Plus d\'emplacements disponibles.' });
      return;
    }

    const teamId = team.team.id.toString();
    if (favoriteTeams.map(t => t.toString()).includes(teamId)) {
      showAlert({ type: 'error', title: 'Déjà ajouté', subtitle: 'Cette équipe est déjà dans vos favoris.' });
      return;
    }

    setIsAdding(teamId);
    try {
      const teamRef = doc(db, 'teams', teamId);
      const teamDoc = await getDoc(teamRef);
      
      const teamPayload = {
        name: team.team.name,
        logo: team.team.logo,
        updatedAt: new Date().toISOString()
      };

      if (!teamDoc.exists()) {
        // Fetch leagues for this team to enrich data
        let leagueIds: number[] = [];
        try {
          const leaguesData = await footballApi.getLeaguesByTeam(Number(teamId));
          leagueIds = leaguesData.map((l: any) => l.league.id);
        } catch (e) {
          console.error("Failed to fetch leagues for team enrichment", e);
        }

        await setDoc(teamRef, {
          ...teamPayload,
          userCount: 1,
          averageFerveur: 10,
          ferveurEarned: 0,
          totalScoreGiven: 0,
          matchesPlayed: 0,
          leagueIds: leagueIds
        });
      } else {
        // If doc exists but lacked name/logo (due to some error), heal it
        await updateDoc(teamRef, {
          ...teamPayload,
          userCount: increment(1)
        });
      }

      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        favoriteTeams: [...favoriteTeams, teamId]
      });
      
      setSearchQuery('');
      setSearchResults([]);
      showAlert({ type: 'success', title: 'Équipe ajoutée !', subtitle: `${team.team.name} a rejoint vos favoris.` });
    } catch (error) {
      console.error("Error adding favorite team:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsAdding(null);
    }
  };

  const handleBuySlot = async () => {
    if (profile.gems < 5) {
      showAlert({ type: 'error', title: 'Pas assez de gemmes.' });
      return;
    }

    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        gems: profile.gems - 5,
        teamSlots: profile.teamSlots + 1
      });
      await logTransaction(profile.uid, 'gems', -5, 'Achat d\'un emplacement d\'équipe favorite');
      showAlert({ type: 'success', title: 'Nouvel emplacement débloqué !' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const emptySlots = Math.max(0, profile.teamSlots - profile.favoriteTeams.length);

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          Équipes Favorites
        </h1>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        <div className="bg-black/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div className="text-gray-400 text-xs sm:text-sm">Emplacements utilisés</div>
          <div className="text-xl font-black text-orange-500">{profile.favoriteTeams.length} <span className="text-sm text-orange-500/50">/ {profile.teamSlots}</span></div>
        </div>
        
        {/* Current Teams */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-bold animate-pulse">
            Chargement de vos équipes...
          </div>
        ) : (
          <>
            {teams.map((team, idx) => (
              <div key={idx} className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center p-2">
                  {team.logo ? (
                    <img src={getImageUrl(team.logo, 100)} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <Shield className="w-6 h-6 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm truncate">{team.name}</h3>
                  <p className="text-[10px] text-orange-500 font-bold uppercase leading-tight mt-0.5">Bonus<br/>Ferveur Actif</p>
                </div>
              </div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: emptySlots }).map((_, idx) => (
              <div key={`empty-${idx}`} className="bg-black/20 border border-dashed border-white/20 rounded-xl p-3 flex flex-col items-center justify-center min-h-[88px]">
                <span className="text-gray-500 font-bold text-xs text-center leading-tight">Emplacement<br/>Libre</span>
              </div>
            ))}

            {/* Buy Slot Button */}
            <button
              onClick={handleBuySlot}
              className="bg-orange-500/5 border border-orange-500/30 rounded-xl p-3 flex flex-col items-center justify-center gap-1 hover:bg-orange-500/10 transition-colors"
            >
              <Plus className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-orange-500 font-bold text-xs text-center leading-tight">Acheter un<br/>emplacement</span>
              <div className="bg-orange-500 text-black text-[10px] font-black px-2 py-0.5 rounded mt-1">
                5 Gemmes
              </div>
            </button>
          </>
        )}
      </div>

      {/* Add New Team */}
      {emptySlots > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tight text-white">
            Ajouter une équipe
          </h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une équipe (ex: Paris)"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {isSearching && (
            <div className="text-center py-8 text-gray-500 font-bold animate-pulse">
              Recherche en cours...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {searchResults.map((result) => (
                <div 
                  key={result.team.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between hover:border-orange-500/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 bg-white/5 rounded-lg p-1.5 flex items-center justify-center">
                      <img src={getImageUrl(result.team.logo, 100)} alt={result.team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{result.team.name}</h4>
                      <p className="text-xs text-gray-500 truncate">{result.team.country}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleAddTeam(result)}
                    disabled={isAdding === result.team.id.toString()}
                    className="shrink-0 ml-2 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase text-[10px] px-3 py-1.5 h-auto disabled:opacity-50"
                  >
                    {isAdding === result.team.id.toString() ? '...' : 'Ajouter'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
