import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { Search, Plus, Shield } from 'lucide-react';
import { footballApi } from '../services/footballApi';
import { Button, Card } from './Layout';
import { useAlert } from '../context/AlertContext';
import { handleFirestoreError, OperationType } from '../firebase';
import { logTransaction } from '../services/transactionService';

interface FavoriteTeamsPageProps {
  profile: UserProfile;
}

export function FavoriteTeamsPage({ profile }: FavoriteTeamsPageProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const teamData = await Promise.all(
          profile.favoriteTeams.map(async (teamIdOrName) => {
            const teamDoc = await getDoc(doc(db, 'teams', teamIdOrName));
            if (teamDoc.exists()) {
              return { id: teamDoc.id, ...teamDoc.data() };
            }
            return { id: teamIdOrName, name: teamIdOrName, logo: '' };
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
    if (profile.favoriteTeams.length >= profile.teamSlots) {
      showAlert({ type: 'error', title: 'Vous avez atteint la limite d\'équipes favorites.' });
      return;
    }

    const teamId = team.team.id.toString();
    if (profile.favoriteTeams.includes(teamId) || profile.favoriteTeams.includes(team.team.name)) {
      showAlert({ type: 'error', title: 'Cette équipe est déjà dans vos favoris.' });
      return;
    }

    try {
      const teamRef = doc(db, 'teams', teamId);
      const teamDoc = await getDoc(teamRef);
      
      if (!teamDoc.exists()) {
        // Fetch leagues for this team
        let leagueIds: number[] = [];
        try {
          const leaguesData = await footballApi.getLeaguesByTeam(Number(teamId));
          leagueIds = leaguesData.map((l: any) => l.league.id);
        } catch (e) {
          console.error("Failed to fetch leagues for team", e);
        }

        await setDoc(teamRef, {
          name: team.team.name,
          logo: team.team.logo,
          userCount: 1,
          averageFerveur: 10,
          ferveurEarned: 0,
          totalScoreGiven: 0,
          matchesPlayed: 0,
          leagueIds: leagueIds
        });
      } else {
        await updateDoc(teamRef, {
          userCount: increment(1)
        });
      }

      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        favoriteTeams: [...profile.favoriteTeams, teamId]
      });
      
      setSearchQuery('');
      setSearchResults([]);
      showAlert({ type: 'success', title: 'Équipe ajoutée aux favoris !' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
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
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight text-white mb-2 leading-tight">
            Équipes<br />Favorites
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-md">
            Gérez vos équipes préférées. Jouer des duels avec ces équipes vous rapporte un bonus de ferveur (+20%).
          </p>
        </div>
        <div className="bg-black/50 border border-white/10 rounded-xl p-4 text-center shrink-0 min-w-[140px] self-start md:self-auto">
          <div className="text-3xl font-black text-orange-500">{profile.favoriteTeams.length} <span className="text-xl text-orange-500/50">/ {profile.teamSlots}</span></div>
          <div className="text-[10px] text-gray-400 uppercase font-bold mt-1 tracking-wider">Emplacements</div>
        </div>
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
                    <img src={team.logo} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
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
        <Card className="p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tight text-white mb-4">
            Ajouter une équipe
          </h2>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une équipe (ex: Paris)"
              className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
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
                  className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between hover:border-orange-500/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 bg-white/5 rounded-lg p-1.5 flex items-center justify-center">
                      <img src={result.team.logo} alt={result.team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{result.team.name}</h4>
                      <p className="text-xs text-gray-500 truncate">{result.team.country}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleAddTeam(result)}
                    className="shrink-0 ml-2 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase text-[10px] px-3 py-1.5 h-auto"
                  >
                    Ajouter
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
