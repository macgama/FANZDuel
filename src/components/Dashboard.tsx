import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { footballApi } from '../services/footballApi';
import { Card, Button } from './Layout';
import { UserProfile, Fanz, Duel, LifeAction, FanzTemplate } from '../types';
import { Coins, Gem, Zap, Trophy, User as UserIcon, Swords, Activity, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { DuelScreen } from './Duel';
import { LifeActionCard } from './LifeActionCard';
import { ALL_FANZ } from '../constants/fanz';
import { getImageUrl } from '../lib/utils';

interface DashboardProps {
  onDuelStatusChange?: (isActive: boolean) => void;
  onTeamClick: (teamId: number, season: number) => void;
  onLeagueClick: (leagueId: number, season: number) => void;
  onMatchClick: (matchId: number) => void;
}

export function Dashboard({ onDuelStatusChange, onTeamClick, onLeagueClick, onMatchClick }: DashboardProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [fanzList, setFanzList] = useState<Fanz[]>([]);
  const [fanzTemplates, setFanzTemplates] = useState<FanzTemplate[]>([]);
  const [lifeActions, setLifeActions] = useState<LifeAction[]>([]);
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (onDuelStatusChange) {
      onDuelStatusChange(!!activeDuel);
    }
  }, [activeDuel, onDuelStatusChange]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userPath = `users/${auth.currentUser.uid}`;
    const unsubUser = onSnapshot(doc(db, userPath), (doc) => {
      if (doc.exists()) {
        setUser(doc.data() as UserProfile);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, userPath);
      setError("Erreur de permission sur le profil utilisateur.");
      setLoading(false);
    });

    const fanzPath = 'fanz';
    const q = query(collection(db, fanzPath), where('ownerUid', '==', auth.currentUser.uid));
    const unsubFanz = onSnapshot(q, (snapshot) => {
      setFanzList(snapshot.docs.map(d => d.data() as Fanz));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, fanzPath);
      setError("Erreur de permission sur la liste des FANZ.");
    });

    const tplPath = 'fanz_templates';
    const unsubTemplates = onSnapshot(collection(db, tplPath), (snapshot) => {
      setFanzTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FanzTemplate)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, tplPath);
    });

    const actionsPath = 'life_actions';
    const unsubActions = onSnapshot(collection(db, actionsPath), (snapshot) => {
      setLifeActions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LifeAction)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, actionsPath);
    });

    return () => {
      unsubUser();
      unsubFanz();
      unsubTemplates();
      unsubActions();
    };
  }, []);

  const handleStartDuel = async (type: Duel['type']) => {
    if (!user || !auth.currentUser || user.energy < 10) return;
    if (user.activeAction) {
      alert("Vous avez une action en cours ! Terminez-la avant de lancer un duel.");
      return;
    }

    try {
      const duelId = Math.random().toString(36).substring(7);
      const newDuel: Duel = {
        id: duelId,
        type,
        status: 'active',
        teamA: user.favoriteTeams[0],
        teamB: 'Rival Team',
        progress: 50,
        participants: [user.uid]
      };

      setActiveDuel(newDuel);
      
      const userPath = `users/${auth.currentUser.uid}`;
      await updateDoc(doc(db, userPath), {
        energy: user.energy - 10,
        money: user.money - 50
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser?.uid}`);
    }
  };

  const [liveMatches, setLiveMatches] = useState<any[]>([]);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const data = await footballApi.getLiveFixtures();
        setLiveMatches(data.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch live matches', err);
      }
    };
    fetchLive();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen">Chargement...</div>;
  if (error) return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>;
  if (!user) return <div className="flex items-center justify-center h-screen">Profil introuvable.</div>;

  const activeFanz = user?.activeAction ? fanzList.find(f => f.id === user.activeAction?.fanzId) : null;
  const activeActionDetails = lifeActions.find(a => a.id === user?.activeAction?.actionId);

  if (activeDuel) {
    const fanzToUse = activeFanz || fanzList[0];
    return <DuelScreen duel={activeDuel} onExit={() => setActiveDuel(null)} user={user} fanzId={fanzToUse?.id} />;
  }

  return (
    <div className="space-y-8">
      {/* Active Action Banner */}
      {user?.activeAction && activeFanz && activeActionDetails && (
        <div className="mb-6">
          <LifeActionCard 
            action={activeActionDetails} 
            fanz={activeFanz} 
            userProfile={user} 
          />
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Coins className="text-yellow-500" />} label="Money" value={`$${user.money}`} />
        <StatCard icon={<Gem className="text-purple-500" />} label="Gems" value={user.gems} />
        <StatCard icon={<Zap className="text-orange-500" />} label="Energy" value={`${user.energy}/100`} />
        <StatCard icon={<Trophy className="text-blue-500" />} label="Ferveur" value={user.ferveurPoints} />
      </div>

      {/* User Level Progress */}
      <Card>
        <div className="flex justify-between items-end mb-2">
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-tight">Level {user.level}</h3>
            <p className="text-xs text-gray-400 uppercase font-bold">Chemin de la Ferveur</p>
          </div>
          <p className="text-sm font-mono">{user.ferveurPoints} / 100,000 XP</p>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(user.ferveurPoints / 100000) * 100}%` }}
            className="h-full bg-orange-600"
          />
        </div>
      </Card>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase flex items-center gap-2">
            <Activity className="text-orange-500 animate-pulse" /> Live Matches
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveMatches.map(match => (
              <Card 
                key={match.fixture.id} 
                className="p-4 hover:border-orange-500/30 transition-all cursor-pointer group"
                onClick={() => onMatchClick(match.fixture.id)}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
                    <span 
                      className="hover:text-orange-500 transition-colors"
                      onClick={(e) => { e.stopPropagation(); onLeagueClick(match.league.id, match.league.season); }}
                    >
                      {match.league.name}
                    </span>
                    <span className="text-orange-500 animate-pulse">{match.fixture.status.elapsed}'</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(match.teams.home.id, match.league.season); }}>
                      <div className="flex items-center gap-3">
                        <img src={match.teams.home.logo} alt="" className="w-6 h-6 object-contain group-hover/team:scale-110 transition-transform" referrerPolicy="no-referrer" />
                        <span className="text-sm font-bold group-hover/team:text-orange-500 transition-colors">{match.teams.home.name}</span>
                      </div>
                      <span className="font-black text-lg">{match.goals.home ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(match.teams.away.id, match.league.season); }}>
                      <div className="flex items-center gap-3">
                        <img src={match.teams.away.logo} alt="" className="w-6 h-6 object-contain group-hover/team:scale-110 transition-transform" referrerPolicy="no-referrer" />
                        <span className="text-sm font-bold group-hover/team:text-orange-500 transition-colors">{match.teams.away.name}</span>
                      </div>
                      <span className="font-black text-lg">{match.goals.away ?? 0}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* FANZ List */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase flex items-center gap-2">
            <UserIcon /> Mes FANZ ({fanzList.length})
          </h2>
          <div className="space-y-4">
            {fanzList.map(fanz => {
              const template = fanzTemplates.find(t => t.id === fanz.templateId);
              const equippedSkin = template?.skins?.find(s => s.id === fanz.equippedSkin);
              
              const displayImage = equippedSkin?.imageUrl || fanz.imageUrl || template?.image;
              const displayVideo = equippedSkin?.videoUrl || fanz.videoUrl || template?.video;

              return (
              <Card key={fanz.id} className="flex items-center gap-4 group relative overflow-hidden">
                <div className="w-16 h-16 bg-orange-600/20 rounded-full flex items-center justify-center border border-orange-500 overflow-hidden relative z-10">
                  {displayVideo ? (
                    <video 
                      key={getImageUrl(displayVideo)}
                      poster={getImageUrl(displayImage || '')}
                      className="w-full h-full object-contain"
                      autoPlay muted loop playsInline
                      preload="auto"
                      crossOrigin="anonymous"
                    >
                      <source src={getImageUrl(displayVideo)} type="video/mp4" />
                    </video>
                  ) : displayImage ? (
                    <img src={getImageUrl(displayImage)} alt={fanz.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="text-orange-500" />
                  )}
                </div>
                <div className="flex-1 z-10">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">{fanz.name}</h4>
                    {fanz.equippedSkin && fanz.equippedSkin !== 'default' && (
                      <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                    )}
                  </div>
                  <div className="flex gap-2 text-xs text-gray-400">
                    <span className="font-bold text-orange-500">LVL {fanz.level}</span>
                    <span>•</span>
                    <span>{fanz.xp} XP</span>
                    {equippedSkin && (
                      <>
                        <span>•</span>
                        <span className="text-purple-400 italic">{equippedSkin.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <Button variant="outline" className="px-3 py-1 text-xs z-10">Stats</Button>
              </Card>
              );
            })}
          </div>
        </section>

        {/* Game Modes */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase flex items-center gap-2">
            <Swords /> Duels
          </h2>
          <div className="grid gap-4">
            <DuelModeCard 
              title="Entraînement" 
              desc="Gagne de l'XP avant les matchs" 
              onClick={() => handleStartDuel('training')}
            />
            <DuelModeCard 
              title="Match 1V1" 
              desc="Défie un autre supporter" 
              onClick={() => handleStartDuel('1v1')}
            />
            <DuelModeCard 
              title="Guerre des Kops" 
              desc="Unis-toi pour ton équipe" 
              onClick={() => handleStartDuel('war_of_kops')}
            />
          </div>
        </section>
      </div>

      {/* Action Life */}
      <section className="space-y-4">
        <h2 className="text-2xl font-black italic uppercase flex items-center gap-2">
          <Activity /> Action LIFE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActionCard title="Travailler" reward="+$200" cost="-20 Energy" />
          <ActionCard title="S'entraîner" reward="+50 XP" cost="-30 Energy" />
          <ActionCard title="Se reposer" reward="+40 Energy" cost="Free" />
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="flex flex-col items-center justify-center p-4">
      <div className="mb-1">{icon}</div>
      <p className="text-[10px] uppercase font-bold text-gray-400">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </Card>
  );
}

function DuelModeCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="flex justify-between items-center group">
      <div>
        <h4 className="font-black italic uppercase text-lg group-hover:text-orange-500 transition-colors">{title}</h4>
        <p className="text-sm text-gray-400">{desc}</p>
      </div>
      <Swords className="text-gray-600 group-hover:text-orange-500" />
    </Card>
  );
}

function ActionCard({ title, reward, cost }: { title: string; reward: string; cost: string }) {
  return (
    <Card className="text-center">
      <h4 className="font-bold mb-1">{title}</h4>
      <p className="text-orange-500 font-black text-sm">{reward}</p>
      <p className="text-xs text-gray-500">{cost}</p>
      <Button variant="outline" className="mt-4 w-full py-1 text-xs">Lancer</Button>
    </Card>
  );
}
