import React, { useState, useEffect } from "react";
import { Card, Button } from "./Layout";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Ruler,
  Weight,
  User,
  Activity,
  Goal,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { footballApi } from "../services/footballApi";

interface PlayerDetailsProps {
  playerId: number;
  season: number;
  onBack: () => void;
  onTeamClick?: (teamId: number, season: number) => void;
  onLeagueClick?: (leagueId: number, season: number) => void;
}

const formatSeason = (season: number) =>
  `${season}/${String(season + 1).slice(-2)}`;

export function PlayerDetails({
  playerId,
  season,
  onBack,
  onTeamClick,
  onLeagueClick,
}: PlayerDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<any | null>(null);
  const [stats, setStats] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [detailsRes, teamsRes] = await Promise.all([
          footballApi.getPlayerDetails(playerId, season),
          footballApi.getPlayerTeams(playerId),
        ]);

        if (detailsRes && detailsRes.length > 0) {
          setPlayerData(detailsRes[0].player);
          setStats(detailsRes[0].statistics || []);
        } else {
          // If no data for this season, maybe try fetching profile instead, or we just handle it
          setPlayerData(null);
        }
        setTeams(teamsRes || []);
      } catch (e) {
        console.error("Error fetching player details:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [playerId, season]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-4"></div>
        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest animate-pulse">
          Chargement...
        </p>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="p-4">
        <Button onClick={onBack} variant="outline" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
        <Card className="p-8 text-center bg-zinc-900 border-zinc-800">
          <p className="text-gray-400 font-bold uppercase">
            Aucune donnée trouvée pour ce joueur sur la saison {season}.
          </p>
        </Card>
      </div>
    );
  }

  // Calculate totals across all competitions for the season
  const totalGoals = stats.reduce((sum, s) => sum + (s.goals?.total || 0), 0);
  const totalAssists = stats.reduce(
    (sum, s) => sum + (s.goals?.assists || 0),
    0,
  );
  const totalApps = stats.reduce(
    (sum, s) => sum + (s.games?.appearences || 0),
    0,
  );
  const totalMins = stats.reduce((sum, s) => sum + (s.games?.minutes || 0), 0);
  const totalYellow = stats.reduce((sum, s) => sum + (s.cards?.yellow || 0), 0);
  const totalRed = stats.reduce((sum, s) => sum + (s.cards?.red || 0), 0);

  const goalsPer90 =
    totalMins > 0 ? (totalGoals / (totalMins / 90)).toFixed(2) : "0.00";
  const cardsPer90 =
    totalMins > 0
      ? ((totalYellow + totalRed) / (totalMins / 90)).toFixed(2)
      : "0.00";

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <User className="w-48 h-48 sm:w-64 sm:h-64" />
        </div>

        <div className="relative p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
          <div className="relative group">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-orange-500/30 bg-zinc-900 shadow-[0_0_30px_rgba(249,115,22,0.15)] group-hover:scale-105 transition-transform duration-300">
              <img
                src={playerData.photo}
                alt={playerData.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://via.placeholder.com/150/1f2937/fb923c?text=No+Photo";
                }}
              />
            </div>
            {stats.length > 0 && stats[0].games?.position && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-500 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-lg shadow-orange-500/30">
                {stats[0].games.position}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl flex items-center justify-center md:justify-start gap-3 sm:text-4xl font-black text-white tracking-tight uppercase">
                {playerData.firstname}{" "}
                <span className="text-orange-500">{playerData.lastname}</span>
              </h1>
              <div className="flex items-center justify-center md:justify-start gap-2 text-gray-400 mt-2">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {playerData.nationality}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Âge
                  </span>
                </div>
                <p className="text-lg font-black text-white">
                  {playerData.age || "-"} ans
                </p>
              </div>
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Ruler className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Taille
                  </span>
                </div>
                <p className="text-lg font-black text-white">
                  {playerData.height || "-"}
                </p>
              </div>
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Weight className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Poids
                  </span>
                </div>
                <p className="text-lg font-black text-white">
                  {playerData.weight || "-"}
                </p>
              </div>
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Activity className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Statut
                  </span>
                </div>
                <p className="text-lg font-black text-white">
                  {playerData.injured ? (
                    <span className="text-red-500 inline-flex items-center gap-1">
                      Blessé
                    </span>
                  ) : (
                    "Actif"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Season Totals */}
      <h2 className="text-xl font-black text-white uppercase tracking-tight mt-8 flex items-center gap-2">
        Saison <span className="text-orange-500">{formatSeason(season)}</span>
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center justify-center text-center">
          <Activity className="w-8 h-8 text-white mb-3 opacity-20" />
          <span className="text-3xl font-black text-white">{totalApps}</span>
          <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-2">
            Matches
          </span>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center justify-center text-center">
          <Calendar className="w-8 h-8 text-white mb-3 opacity-20" />
          <span className="text-3xl font-black text-white">{totalMins}'</span>
          <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-2">
            Minutes
          </span>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors"></div>
          <Goal className="w-8 h-8 text-white mb-3 opacity-20" />
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-green-400 leading-none">
              {totalGoals}
            </span>
            <span className="text-[10px] font-black text-gray-400 mt-1">
              {goalsPer90} Buts / 90'
            </span>
          </div>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-orange-500/5 group-hover:bg-orange-500/10 transition-colors"></div>
          <div className="flex gap-1 mb-3 opacity-50 relative">
            <div className="w-5 h-7 bg-yellow-400 rounded-sm -rotate-12 transform translate-x-2"></div>
            <div className="w-5 h-7 bg-red-500 rounded-sm rotate-12 z-10 shadow-lg"></div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-white leading-none">
              <span className="text-yellow-400">{totalYellow}</span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-red-500">{totalRed}</span>
            </span>
            <span className="text-[10px] font-black text-gray-400 mt-1">
              {cardsPer90} <span className="text-red-400">Cartons / 90'</span>
            </span>
          </div>
        </Card>
      </div>

      {/* Competitions */}
      {stats.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            Statistiques par{" "}
            <span className="text-orange-500">Compétition</span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stats.map((stat, idx) => (
              <Card
                key={idx}
                className="bg-zinc-900 border-zinc-800 p-5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                  <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() =>
                      onLeagueClick &&
                      stat.league?.id &&
                      onLeagueClick(stat.league.id, season)
                    }
                  >
                    <div className="w-10 h-10 bg-white rounded flex items-center justify-center p-1 relative overflow-hidden group-hover:scale-105 transition-transform">
                      {stat.league?.logo ? (
                        <img
                          src={stat.league.logo}
                          alt={stat.league.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <Goal className="w-5 h-5 text-black" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase group-hover:text-orange-500 transition-colors">
                        {stat.league?.name || "Compétition"}
                      </h4>
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                        {stat.league?.country || "Europe"}
                      </p>
                    </div>
                  </div>

                  {stat.team && (
                    <div
                      className="flex items-center gap-2 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                      onClick={() =>
                        onTeamClick && onTeamClick(stat.team.id, season)
                      }
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                        {stat.team.name}
                      </span>
                      <img
                        src={stat.team.logo}
                        alt={stat.team.name}
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <span className="block text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                      Matches
                    </span>
                    <span className="text-sm font-bold text-white">
                      {stat.games?.appearences || 0}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                      Buts
                    </span>
                    <span className="text-sm font-bold text-green-400">
                      {stat.goals?.total || 0}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                      Passes
                    </span>
                    <span className="text-sm font-bold text-blue-400">
                      {stat.goals?.assists || 0}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                      Cartons
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-3.5 bg-yellow-400 rounded-sm"></div>
                      <span className="text-xs font-bold text-white mr-1">
                        {stat.cards?.yellow || 0}
                      </span>
                      <div className="w-2.5 h-3.5 bg-red-500 rounded-sm"></div>
                      <span className="text-xs font-bold text-white">
                        {stat.cards?.red || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Career History */}
      {teams && teams.length > 0 && (
        <PlayerCareer
          playerId={playerId}
          teams={teams}
          onTeamClick={onTeamClick}
          onLeagueClick={onLeagueClick}
        />
      )}
    </div>
  );
}

function PlayerCareer({
  playerId,
  teams,
  onTeamClick,
  onLeagueClick,
}: {
  playerId: number;
  teams: any[];
  onTeamClick?: (id: number, season: number) => void;
  onLeagueClick?: (id: number, season: number) => void;
}) {
  const [careerStats, setCareerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadStats() {
      // Get unique seasons, sort descending
      const allSeasons = new Set<number>();
      teams.forEach((t) => t.seasons.forEach((s: number) => allSeasons.add(s)));
      const sortedSeasons = Array.from(allSeasons)
        .sort((a, b) => b - a)
        .slice(0, 5); // Load top 5 recent seasons to respect rate limits

      setLoading(true);
      try {
        const statsPromises = sortedSeasons.map((s) =>
          footballApi.getPlayerDetails(playerId, s).catch(() => null),
        );
        const results = await Promise.all(statsPromises);

        const allStats: any[] = [];
        results.forEach((res, idx) => {
          if (res && res.length > 0 && res[0].statistics) {
            res[0].statistics.forEach((stat: any) => {
              allStats.push({ ...stat, season: sortedSeasons[idx] });
            });
          }
        });
        setCareerStats(allStats);
      } catch (err) {
        console.error("Error loading career stats", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [playerId, teams]);

  if (loading) {
    return (
      <div className="pt-8 flex flex-col items-center justify-center space-y-4 opacity-50">
        <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full"></div>
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
          Chargement de la carrière...
        </p>
      </div>
    );
  }

  // Group by Season -> Team -> Leagues
  const careerMap = new Map<
    number,
    Map<number, { team: any; leagues: any[]; totals: any }>
  >();

  careerStats.forEach((stat) => {
    const s = stat.season;
    if (!careerMap.has(s)) careerMap.set(s, new Map());

    const seasonMap = careerMap.get(s)!;
    const tId = stat.team?.id || 0;

    if (!seasonMap.has(tId)) {
      seasonMap.set(tId, {
        team: stat.team,
        leagues: [],
        totals: {
          games: 0,
          goals: 0,
          assists: 0,
          yellow: 0,
          red: 0,
        },
      });
    }

    const teamRecord = seasonMap.get(tId)!;
    teamRecord.leagues.push(stat);
    teamRecord.totals.games += stat.games?.appearences || 0;
    teamRecord.totals.goals += stat.goals?.total || 0;
    teamRecord.totals.assists += stat.goals?.assists || 0;
    teamRecord.totals.yellow += stat.cards?.yellow || 0;
    teamRecord.totals.red += stat.cards?.red || 0;
  });

  const seasonsList = Array.from(careerMap.keys()).sort((a, b) => b - a);

  if (seasonsList.length === 0) return null;

  const toggleRow = (id: string) => {
    const newExp = new Set(expandedRows);
    if (newExp.has(id)) newExp.delete(id);
    else newExp.add(id);
    setExpandedRows(newExp);
  };

  return (
    <div className="space-y-4 pt-8">
      <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
        Liste de clubs où il a <span className="text-orange-500">Joué</span>
      </h2>
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 text-[9px] text-gray-500 font-black uppercase tracking-widest border-b border-zinc-800">
                <th className="p-3 w-10"></th>
                <th className="p-3">Équipes</th>
                <th className="p-3 text-center">Saison</th>
                <th className="p-3 text-center">MJ</th>
                <th className="p-3 text-center">Buts</th>
                <th className="p-3 text-center">Pass.</th>
                <th className="p-3 text-center">
                  <div className="w-2.5 h-3.5 bg-yellow-400 rounded-sm mx-auto"></div>
                </th>
                <th className="p-3 text-center">
                  <div className="w-2.5 h-3.5 bg-red-500 rounded-sm mx-auto"></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {seasonsList.map((season) => {
                const teamsMap = careerMap.get(season)!;
                return Array.from(teamsMap.values()).map((tRecord, idx) => {
                  const rowId = `${season}-${tRecord.team.id}`;
                  const isExpanded = expandedRows.has(rowId);
                  return (
                    <React.Fragment key={rowId}>
                      <tr
                        className={`border-b border-zinc-800/50 hover:bg-white/5 transition-colors cursor-pointer ${isExpanded ? "bg-white/5" : ""}`}
                        onClick={() => toggleRow(rowId)}
                      >
                        <td className="p-3 text-center w-10">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="p-3 flex items-center gap-2">
                          <img
                            src={tRecord.team.logo}
                            alt={tRecord.team.name}
                            className="w-6 h-6 object-contain"
                          />
                          <span
                            className="text-xs font-bold text-white uppercase hover:text-orange-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onTeamClick)
                                onTeamClick(tRecord.team.id, season);
                            }}
                          >
                            {tRecord.team.name}
                          </span>
                        </td>
                        <td className="p-3 text-center text-xs font-bold text-gray-300">
                          {formatSeason(season)}
                        </td>
                        <td className="p-3 text-center text-xs font-black text-gray-300">
                          {tRecord.totals.games}
                        </td>
                        <td className="p-3 text-center text-xs font-bold text-green-400">
                          {tRecord.totals.goals}
                        </td>
                        <td className="p-3 text-center text-xs font-bold text-blue-400">
                          {tRecord.totals.assists}
                        </td>
                        <td className="p-3 text-center text-xs font-bold text-yellow-400">
                          {tRecord.totals.yellow}
                        </td>
                        <td className="p-3 text-center text-xs font-bold text-red-400">
                          {tRecord.totals.red}
                        </td>
                      </tr>
                      {isExpanded &&
                        tRecord.leagues.map((lStat, lIdx) => (
                          <tr
                            key={`${rowId}-${lIdx}`}
                            className="bg-black/20 border-b border-zinc-800/30"
                          >
                            <td></td>
                            <td className="p-2 pl-4 flex items-center gap-2 opacity-70">
                              {lStat.league?.logo ? (
                                <img
                                  src={lStat.league.logo}
                                  alt={lStat.league.name}
                                  className="w-4 h-4 object-contain"
                                />
                              ) : (
                                <div className="w-4 h-4 bg-white/10 rounded flex items-center justify-center">
                                  <Goal className="w-2 h-2 text-gray-400" />
                                </div>
                              )}
                              <span
                                className="text-[10px] font-bold text-gray-300 uppercase cursor-pointer hover:text-white"
                                onClick={() => {
                                  if (onLeagueClick && lStat.league?.id)
                                    onLeagueClick(lStat.league.id, season);
                                }}
                              >
                                {lStat.league?.name || "Inconnu"}
                              </span>
                            </td>
                            <td colSpan={1}></td>
                            <td className="p-2 text-center text-[10px] font-black text-gray-400">
                              {lStat.games?.appearences || 0}
                            </td>
                            <td className="p-2 text-center text-[10px] font-bold text-green-500/70">
                              {lStat.goals?.total || 0}
                            </td>
                            <td className="p-2 text-center text-[10px] font-bold text-blue-500/70">
                              {lStat.goals?.assists || 0}
                            </td>
                            <td className="p-2 text-center text-[10px] font-bold text-yellow-500/70">
                              {lStat.cards?.yellow || 0}
                            </td>
                            <td className="p-2 text-center text-[10px] font-bold text-red-500/70">
                              {lStat.cards?.red || 0}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {seasonsList.length <
        teams.reduce((acc, t) => {
          t.seasons.forEach((s: number) => acc.add(s));
          return acc;
        }, new Set()).size && (
        <p className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2">
          Affichage des 5 dernières saisons par souci de performance
        </p>
      )}
    </div>
  );
}
