import React, { useState, useEffect } from 'react';
import { footballApi } from '../services/footballApi';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, collection, getDocs, writeBatch, deleteDoc, query, where } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { League, Team, Standing, Fixture, LifeAction, Card as DuelCard, FanzTemplate, FerveurLevel, RankReward, FanzStats, Fanz } from '../types';
import { Database, Download, RefreshCw, CheckCircle, AlertCircle, Search, Plus, Save, Trash2, Activity, Video, Zap, Layers, Users, Trophy, Star, Shield, Brain, Eye, Info, Flame, MessageCircle } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { BASE_CARDS } from '../constants/cards';
import { ALL_FANZ } from '../constants/fanz';

import { footballDataService } from '../services/footballDataService';

export function AdminZone() {
  const [activeTab, setActiveTab] = useState<'football' | 'lifeActions' | 'duelCards' | 'fanz'>('football');
  
  // Football state
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(footballDataService.getCurrentSeasonYear());
  const [leagues, setLeagues] = useState<any[]>([]);
  const [manualLeagueId, setManualLeagueId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error', message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Life Actions state
  const [lifeActions, setLifeActions] = useState<LifeAction[]>([]);
  const [editingAction, setEditingAction] = useState<LifeAction | null>(null);

  // Duel Cards state
  const [duelCards, setDuelCards] = useState<DuelCard[]>([]);
  const [editingCard, setEditingCard] = useState<DuelCard | null>(null);

  // Fanz state
  const [fanzTemplates, setFanzTemplates] = useState<FanzTemplate[]>([]);
  const [editingFanz, setEditingFanz] = useState<FanzTemplate | null>(null);

  useEffect(() => {
    if (activeTab === 'lifeActions') {
      fetchLifeActions();
    } else if (activeTab === 'duelCards') {
      fetchDuelCards();
    } else if (activeTab === 'fanz') {
      fetchFanzTemplates();
    }
  }, [activeTab]);

  const fetchFanzTemplates = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'fanz_templates'));
      const fanzData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FanzTemplate));
      setFanzTemplates(fanzData);
    } catch (err) {
      console.error("Error fetching fanz templates", err);
      handleFirestoreError(err, OperationType.GET, 'fanz_templates');
    } finally {
      setLoading(false);
    }
  };

  const handleFixAllUrls = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Réparation de toutes les URLs...' });
    try {
      // 1. Fix Fanz Templates
      const tplSnap = await getDocs(collection(db, 'fanz_templates'));
      const batch = writeBatch(db);
      
      tplSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as FanzTemplate;
        const updated = { ...data };
        let changed = false;

        if (updated.image && !updated.image.startsWith('gs://') && updated.image.includes('firebasestorage')) {
          updated.image = updated.image.replace(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^\?]+)\?alt=media/, (_, bucket, path) => {
            return `gs://${bucket}/${decodeURIComponent(path)}`;
          });
          changed = true;
        }
        if (updated.video && !updated.video.startsWith('gs://') && updated.video.includes('firebasestorage')) {
          updated.video = updated.video.replace(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^\?]+)\?alt=media/, (_, bucket, path) => {
            return `gs://${bucket}/${decodeURIComponent(path)}`;
          });
          changed = true;
        }
        
        if (updated.skins) {
          updated.skins = updated.skins.map(skin => {
            if (skin.imageUrl && !skin.imageUrl.startsWith('gs://') && skin.imageUrl.includes('firebasestorage')) {
              changed = true;
              return { ...skin, imageUrl: skin.imageUrl.replace(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^\?]+)\?alt=media/, (_, bucket, path) => `gs://${bucket}/${decodeURIComponent(path)}`) };
            }
            if (skin.videoUrl && !skin.videoUrl.startsWith('gs://') && skin.videoUrl.includes('firebasestorage')) {
              changed = true;
              return { ...skin, videoUrl: skin.videoUrl.replace(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^\?]+)\?alt=media/, (_, bucket, path) => `gs://${bucket}/${decodeURIComponent(path)}`) };
            }
            return skin;
          });
        }

        if (updated.emotes) {
          updated.emotes = updated.emotes.map(emote => {
            if (emote.imageUrl && !emote.imageUrl.startsWith('gs://') && emote.imageUrl.includes('firebasestorage')) {
              changed = true;
              return { ...emote, imageUrl: emote.imageUrl.replace(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^\?]+)\?alt=media/, (_, bucket, path) => `gs://${bucket}/${decodeURIComponent(path)}`) };
            }
            return emote;
          });
        }

        if (changed) {
          batch.update(docSnap.ref, updated);
        }
      });

      // 2. Fix Fanz Instances
      const fanzSnap = await getDocs(collection(db, 'fanz'));
      fanzSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as Fanz;
        const updated = { ...data };
        let changed = false;

        if (updated.imageUrl && !updated.imageUrl.startsWith('gs://') && updated.imageUrl.includes('firebasestorage')) {
          updated.imageUrl = updated.imageUrl.replace(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^\?]+)\?alt=media/, (_, bucket, path) => {
            return `gs://${bucket}/${decodeURIComponent(path)}`;
          });
          changed = true;
        }
        if (updated.videoUrl && !updated.videoUrl.startsWith('gs://') && updated.videoUrl.includes('firebasestorage')) {
          updated.videoUrl = updated.videoUrl.replace(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^\?]+)\?alt=media/, (_, bucket, path) => {
            return `gs://${bucket}/${decodeURIComponent(path)}`;
          });
          changed = true;
        }

        if (changed) {
          batch.update(docSnap.ref, updated);
        }
      });

      await batch.commit();
      setStatus({ type: 'success', message: 'Toutes les URLs ont été réparées !' });
      fetchFanzTemplates();
    } catch (err) {
      console.error("Error fixing URLs", err);
      setStatus({ type: 'error', message: 'Erreur lors de la réparation des URLs.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBaseFanz = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Synchronisation des FANZ de base...' });
    try {
      const batch = writeBatch(db);
      for (const fanz of ALL_FANZ) {
        const fanzRef = doc(db, 'fanz_templates', fanz.id);
        batch.set(fanzRef, fanz);
      }
      await batch.commit();
      setStatus({ type: 'success', message: 'FANZ de base synchronisés !' });
      fetchFanzTemplates();
    } catch (err) {
      console.error("Error syncing base fanz", err);
      handleFirestoreError(err, OperationType.WRITE, 'fanz_templates');
      setStatus({ type: 'error', message: 'Erreur lors de la synchronisation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFanzTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFanz) return;
    
    setLoading(true);
    try {
      const fanzRef = doc(db, 'fanz_templates', editingFanz.id);
      await setDoc(fanzRef, editingFanz);
      setStatus({ type: 'success', message: 'FANZ sauvegardé avec succès !' });
      fetchFanzTemplates();
      setEditingFanz(null);
    } catch (err) {
      console.error("Error saving fanz template", err);
      handleFirestoreError(err, OperationType.WRITE, `fanz_templates/${editingFanz.id}`);
      setStatus({ type: 'error', message: 'Erreur lors de la sauvegarde.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFanzTemplate = async (id: string) => {
    setLoading(true);
    try {
      const fanzRef = doc(db, 'fanz_templates', id);
      await deleteDoc(fanzRef);
      setStatus({ type: 'success', message: 'FANZ supprimé avec succès !' });
      if (editingFanz?.id === id) {
        setEditingFanz(null);
      }
      fetchFanzTemplates();
    } catch (err) {
      console.error("Error deleting fanz template", err);
      handleFirestoreError(err, OperationType.DELETE, `fanz_templates/${id}`);
      setStatus({ type: 'error', message: 'Erreur lors de la suppression.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewFanz = () => {
    const newId = `fanz-${Date.now()}`;
    setEditingFanz({
      id: newId,
      name: 'Nouveau FANZ',
      sport: 'soccer',
      rarity: 'common',
      image: '',
      description: 'Description du FANZ...',
      baseStats: {
        force: 1, endurance: 1, mental: 1, bluff: 1,
        creativity: 1, social: 1, intelligence: 1, charisma: 1
      },
      specialCards: [],
      skins: [],
      emotes: [],
      ferveurPath: [],
      rankRewards: {}
    });
  };

  const fetchDuelCards = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'cards'));
      const cardsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DuelCard));
      setDuelCards(cardsData);
    } catch (err) {
      console.error("Error fetching duel cards", err);
      handleFirestoreError(err, OperationType.GET, 'cards');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBaseCards = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Synchronisation des cartes de base...' });
    try {
      const batch = writeBatch(db);
      for (const card of BASE_CARDS) {
        const cardRef = doc(db, 'cards', card.id);
        batch.set(cardRef, card);
      }
      await batch.commit();
      setStatus({ type: 'success', message: 'Cartes de base synchronisées !' });
      fetchDuelCards();
    } catch (err) {
      console.error("Error syncing base cards", err);
      handleFirestoreError(err, OperationType.WRITE, 'cards');
      setStatus({ type: 'error', message: 'Erreur lors de la synchronisation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDuelCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    
    setLoading(true);
    try {
      const cardRef = doc(db, 'cards', editingCard.id);
      await setDoc(cardRef, editingCard);
      setStatus({ type: 'success', message: 'Carte sauvegardée avec succès !' });
      fetchDuelCards();
      setEditingCard(null);
    } catch (err) {
      console.error("Error saving duel card", err);
      handleFirestoreError(err, OperationType.WRITE, `cards/${editingCard.id}`);
      setStatus({ type: 'error', message: 'Erreur lors de la sauvegarde.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDuelCard = async (id: string) => {
    setLoading(true);
    try {
      const cardRef = doc(db, 'cards', id);
      await deleteDoc(cardRef);
      setStatus({ type: 'success', message: 'Carte supprimée avec succès !' });
      if (editingCard?.id === id) {
        setEditingCard(null);
      }
      fetchDuelCards();
    } catch (err) {
      console.error("Error deleting duel card", err);
      handleFirestoreError(err, OperationType.DELETE, `cards/${id}`);
      setStatus({ type: 'error', message: 'Erreur lors de la suppression.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewCard = () => {
    const newId = `card-${Date.now()}`;
    setEditingCard({
      id: newId,
      name: 'Nouvelle Carte',
      type: 'neutral',
      rarity: 'common',
      energyCost: 20,
      description: 'Description de la carte...',
      effects: [],
      imageUrl: '',
      videoUrl: '',
      fanzIds: []
    });
  };

  const fetchLifeActions = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'life_actions'));
      const actionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LifeAction));
      setLifeActions(actionsData);
    } catch (err) {
      console.error("Error fetching life actions", err);
      handleFirestoreError(err, OperationType.GET, 'life_actions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLifeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAction) return;
    
    setLoading(true);
    try {
      const actionRef = doc(db, 'life_actions', editingAction.id);
      await setDoc(actionRef, editingAction);
      setStatus({ type: 'success', message: 'Action sauvegardée avec succès !' });
      fetchLifeActions();
      setEditingAction(null);
    } catch (err) {
      console.error("Error saving life action", err);
      handleFirestoreError(err, OperationType.WRITE, `life_actions/${editingAction.id}`);
      setStatus({ type: 'error', message: 'Erreur lors de la sauvegarde.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLifeAction = async (id: string) => {
    // Cannot use window.confirm in iframe easily, so we'll just delete it for now.
    // In a real app, we'd use a custom modal for confirmation.
    setLoading(true);
    try {
      const actionRef = doc(db, 'life_actions', id);
      await deleteDoc(actionRef);
      setStatus({ type: 'success', message: 'Action supprimée avec succès !' });
      if (editingAction?.id === id) {
        setEditingAction(null);
      }
      fetchLifeActions();
    } catch (err) {
      console.error("Error deleting life action", err);
      handleFirestoreError(err, OperationType.DELETE, `life_actions/${id}`);
      setStatus({ type: 'error', message: 'Erreur lors de la suppression.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewAction = () => {
    const newId = `action-${Date.now()}`;
    setEditingAction({
      id: newId,
      fanzTemplateId: '',
      name: 'Nouvelle Action',
      durationMinutes: 30,
      energyCost: 0,
      moneyCost: 0,
      gemsCost: 0,
      boostCost: 0,
      energyGain: 0,
      moneyGain: 0,
      gemsGain: 0,
      boostGain: 0,
      xpGains: {
        force: 0, endurance: 0, mental: 0, bluff: 0,
        creativity: 0, social: 0, intelligence: 0, charisma: 0
      }
    });
  };

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await footballApi.getSeasons();
        let allSeasons = data || [];
        const currentYear = footballDataService.getCurrentSeasonYear();
        // Ensure current and next season are in the list if missing
        if (!allSeasons.includes(currentYear)) allSeasons.push(currentYear);
        if (!allSeasons.includes(currentYear + 1)) allSeasons.push(currentYear + 1);
        setSeasons(Array.from(new Set(allSeasons)).sort((a, b) => b - a));
      } catch (err) {
        console.error('Failed to fetch seasons', err);
        const currentYear = footballDataService.getCurrentSeasonYear();
        setSeasons([currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3]);
      }
    };
    fetchSeasons();
  }, []);

  const handleImportLeagues = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: manualLeagueId 
      ? `Importation de la compétition ${manualLeagueId} pour la saison ${selectedSeason}...`
      : `Importation des compétitions pour la saison ${selectedSeason}...` 
    });
    try {
      const data = await footballApi.getLeagues(selectedSeason, manualLeagueId ? parseInt(manualLeagueId) : undefined);
      if (!data || data.length === 0) {
        setStatus({ type: 'error', message: "Aucune compétition trouvée. Vérifiez l'ID ou la saison." });
        return;
      }
      
      // If manual ID, add to list if not already there
      if (manualLeagueId) {
        setLeagues(prev => {
          const exists = prev.some(l => l.league.id === data[0].league.id);
          return exists ? prev : [...prev, ...data];
        });
      } else {
        setLeagues(data);
      }
      
      const batch = writeBatch(db);
      for (const item of data) {
        const leagueRef = doc(db, 'leagues', item.league.id.toString());
        batch.set(leagueRef, {
          id: item.league.id,
          name: item.league.name,
          type: item.league.type,
          logo: item.league.logo,
          country: item.country.name,
          countryCode: item.country.code,
          countryFlag: item.country.flag,
          season: selectedSeason
        });
      }
      await batch.commit();
      setStatus({ type: 'success', message: `${data.length} compétition(s) importée(s) avec succès !` });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'leagues');
      setStatus({ type: 'error', message: "Erreur lors de l'importation. Vérifiez votre clé API." });
    } finally {
      setLoading(false);
    }
  };

  const handleImportFullLeague = async (leagueId: number) => {
    setLoading(true);
    setStatus({ type: 'info', message: `Importation complète de la compétition ${leagueId}...` });
    try {
      // 1. Teams
      const teamsData = await footballApi.getTeams(leagueId, selectedSeason);
      const teamsBatch = writeBatch(db);
      for (const item of teamsData) {
        const teamRef = doc(db, 'api_teams', item.team.id.toString());
        teamsBatch.set(teamRef, {
          ...item.team,
          venue: item.venue
        });
      }
      await teamsBatch.commit();

      // 2. Standings
      const standingsData = await footballApi.getStandings(leagueId, selectedSeason);
      if (standingsData && standingsData[0]) {
        const standingsBatch = writeBatch(db);
        const leagueStandings = standingsData[0].league.standings[0];
        for (const s of leagueStandings) {
          const standingRef = doc(db, `leagues/${leagueId}/standings`, s.rank.toString());
          standingsBatch.set(standingRef, {
            rank: s.rank,
            teamId: s.team.id,
            points: s.points,
            goalsDiff: s.goalsDiff,
            group: s.group,
            form: s.form,
            status: s.status,
            description: s.description,
            all: s.all,
            home: s.home,
            away: s.away,
            update: s.update
          });
        }
        await standingsBatch.commit();
      }

      // 3. Fixtures (with batch splitting for safety)
      const fixturesData = await footballApi.getFixtures(leagueId, selectedSeason);
      if (fixturesData && fixturesData.length > 0) {
        // Split into chunks of 400 (Firestore limit is 500)
        const chunkSize = 400;
        for (let i = 0; i < fixturesData.length; i += chunkSize) {
          const chunk = fixturesData.slice(i, i + chunkSize);
          const fixturesBatch = writeBatch(db);
          for (const f of chunk) {
            const fixtureRef = doc(db, `leagues/${leagueId}/fixtures`, f.fixture.id.toString());
            fixturesBatch.set(fixtureRef, {
              id: f.fixture.id,
              referee: f.fixture.referee,
              timezone: f.fixture.timezone,
              date: f.fixture.date,
              timestamp: f.fixture.timestamp,
              periods: f.fixture.periods,
              venue: f.fixture.venue,
              status: f.fixture.status,
              league: f.league,
              teams: f.teams,
              goals: f.goals,
              score: f.score
            });
          }
          await fixturesBatch.commit();
          setStatus({ type: 'info', message: `Matchs : ${Math.min(i + chunkSize, fixturesData.length)} / ${fixturesData.length} importés...` });
        }
      }

      setStatus({ type: 'success', message: `Compétition ${leagueId} importée avec succès (${teamsData.length} équipes, ${fixturesData.length} matchs) !` });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `leagues/${leagueId}`);
      setStatus({ type: 'error', message: `Erreur lors de l'importation de la compétition ${leagueId}.` });
    } finally {
      setLoading(false);
    }
  };

  const filteredLeagues = leagues
    .filter(l => l.league.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.country.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.country.name.localeCompare(b.country.name));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-500" />
          Zone Admin
        </h1>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button
          className={`pb-2 px-4 font-bold ${activeTab === 'football' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('football')}
        >
          Importation Football
        </button>
        <button
          className={`pb-2 px-4 font-bold ${activeTab === 'lifeActions' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('lifeActions')}
        >
          Actions LIFE
        </button>
        <button
          className={`pb-2 px-4 font-bold ${activeTab === 'duelCards' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('duelCards')}
        >
          Cartes DUEL
        </button>
        <button
          className={`pb-2 px-4 font-bold ${activeTab === 'fanz' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('fanz')}
        >
          Gestion FANZ
        </button>
      </div>

      {activeTab === 'football' && (
      <Card className="p-6 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500">Saison</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              className="w-40 p-2 bg-gray-100 text-gray-900 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
            >
              {seasons.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500">ID Compétition (Optionnel)</label>
            <input
              type="text"
              placeholder="Ex: 39"
              value={manualLeagueId}
              onChange={(e) => setManualLeagueId(e.target.value)}
              className="w-40 p-2 bg-gray-100 text-gray-900 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Button
            onClick={handleImportLeagues}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {manualLeagueId ? 'Importer cet ID' : 'Actualiser la liste'}
          </Button>
        </div>

        {status && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            status.type === 'success' ? 'bg-green-100 text-green-800' :
            status.type === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
             status.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
             <RefreshCw className="w-5 h-5 animate-spin" />}
            {status.message}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par pays ou nom de compétition..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 text-gray-900 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeagues.map((item) => (
            <div key={item.league.id} className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={item.league.logo} alt={item.league.name} className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                <div>
                  <div className="font-bold text-sm">{item.league.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    {item.country.flag && <img src={item.country.flag} alt="" className="w-4 h-3 object-cover rounded-sm" referrerPolicy="no-referrer" />}
                    {item.country.name}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => handleImportFullLeague(item.league.id)}
                disabled={loading}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
      )}

      {activeTab === 'duelCards' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gestion des Cartes DUEL</h2>
            <div className="flex gap-3">
              <Button onClick={handleSyncBaseCards} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" /> Synchroniser Base
              </Button>
              <Button onClick={handleCreateNewCard} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Plus className="w-5 h-5" /> Nouvelle Carte
              </Button>
            </div>
          </div>

          {status && activeTab === 'duelCards' && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              status.type === 'success' ? 'bg-green-100 text-green-800' :
              status.type === 'error' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
               status.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
               <RefreshCw className="w-5 h-5 animate-spin" />}
              {status.message}
            </div>
          )}

          {editingCard && (
            <Card className="p-6 border-blue-500">
              <h3 className="text-xl font-bold mb-4">
                {editingCard.id.startsWith('card-') ? 'Créer' : 'Modifier'} la carte
              </h3>
              <form onSubmit={handleSaveDuelCard} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">ID (Unique)</label>
                    <input
                      type="text"
                      value={editingCard.id}
                      onChange={e => setEditingCard({...editingCard, id: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      disabled={!editingCard.id.startsWith('card-')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Nom de la carte</label>
                    <input
                      type="text"
                      value={editingCard.name}
                      onChange={e => setEditingCard({...editingCard, name: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <select
                      value={editingCard.type}
                      onChange={e => setEditingCard({...editingCard, type: e.target.value as any})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    >
                      <option value="bonus">Bonus</option>
                      <option value="malus">Malus</option>
                      <option value="neutral">Neutre</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Rareté</label>
                    <select
                      value={editingCard.rarity}
                      onChange={e => setEditingCard({...editingCard, rarity: e.target.value as any})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    >
                      <option value="common">Commune</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Épique</option>
                      <option value="legendary">Légendaire</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Coût Énergie</label>
                    <input
                      type="number"
                      value={editingCard.energyCost}
                      onChange={e => setEditingCard({...editingCard, energyCost: Number(e.target.value)})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      required
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <textarea
                      value={editingCard.description}
                      onChange={e => setEditingCard({...editingCard, description: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none h-20"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Image</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingCard.imageUrl || ''}
                        onChange={e => setEditingCard({...editingCard, imageUrl: e.target.value})}
                        className="flex-1 p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                        placeholder="https://..."
                      />
                      {editingCard.imageUrl && (
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <img src={getImageUrl(editingCard.imageUrl)} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Vidéo</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingCard.videoUrl || ''}
                        onChange={e => setEditingCard({...editingCard, videoUrl: e.target.value})}
                        className="flex-1 p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                        placeholder="https://..."
                      />
                      {editingCard.videoUrl && (
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <Video className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">ID du Fanz (Optionnel)</label>
                    <input
                      type="text"
                      value={editingCard.fanzIds?.join(', ') || ''}
                      onChange={e => setEditingCard({...editingCard, fanzIds: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')})}
                      placeholder="Ex: fanz-1, fanz-2 (Laissez vide pour tous)"
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold">Conditions de déblocage</h4>
                    <Button type="button" size="sm" onClick={() => setEditingCard({...editingCard, unlockRequirements: [...(editingCard.unlockRequirements || []), { type: 'skill', skillName: 'force', minLevel: 1 }]})}>
                      Ajouter Condition
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {(editingCard.unlockRequirements || []).map((req, idx) => (
                      <div key={idx} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Type</label>
                          <select
                            value={req.type}
                            onChange={e => {
                              const newReqs = [...(editingCard.unlockRequirements || [])];
                              newReqs[idx] = { ...req, type: e.target.value as any };
                              setEditingCard({...editingCard, unlockRequirements: newReqs});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                          >
                            <option value="skill">Compétence</option>
                            <option value="ferveur">Chemin de Ferveur</option>
                            <option value="rank">Rang du Fanz (1-10)</option>
                          </select>
                        </div>
                        {req.type === 'skill' && (
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Compétence</label>
                            <select
                              value={req.skillName}
                              onChange={e => {
                                const newReqs = [...(editingCard.unlockRequirements || [])];
                                newReqs[idx] = { ...req, skillName: e.target.value as any };
                                setEditingCard({...editingCard, unlockRequirements: newReqs});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                            >
                              <option value="force">Force</option>
                              <option value="endurance">Endurance</option>
                              <option value="mental">Mental</option>
                              <option value="bluff">Bluff</option>
                              <option value="creativity">Créativité</option>
                              <option value="social">Social</option>
                              <option value="intelligence">Intelligence</option>
                              <option value="charisma">Charisme</option>
                            </select>
                          </div>
                        )}
                        <div className="w-24 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Niveau Min</label>
                          <input
                            type="number"
                            value={req.minLevel}
                            onChange={e => {
                              const newReqs = [...(editingCard.unlockRequirements || [])];
                              newReqs[idx] = { ...req, minLevel: Number(e.target.value) };
                              setEditingCard({...editingCard, unlockRequirements: newReqs});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                          />
                        </div>
                        <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => {
                          const newReqs = (editingCard.unlockRequirements || []).filter((_, i) => i !== idx);
                          setEditingCard({...editingCard, unlockRequirements: newReqs});
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold">Effets</h4>
                    <Button type="button" size="sm" onClick={() => setEditingCard({...editingCard, effects: [...editingCard.effects, { type: 'push_rope', value: 5 }]})}>
                      Ajouter Effet
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {editingCard.effects.map((effect, idx) => (
                      <div key={idx} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Type</label>
                          <select
                            value={effect.type}
                            onChange={e => {
                              const newEffects = [...editingCard.effects];
                              newEffects[idx] = { ...effect, type: e.target.value as any };
                              setEditingCard({...editingCard, effects: newEffects});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                          >
                            <option value="push_rope">Pousser Corde (%)</option>
                            <option value="drain_energy">Drainer Énergie (Adverse)</option>
                            <option value="refill_energy">Remplir Énergie (Soi)</option>
                            <option value="hide_button">Cacher Bouton (Adverse)</option>
                            <option value="shrink_button">Réduire Bouton (Adverse)</option>
                            <option value="move_button">Bouger Bouton (Adverse)</option>
                            <option value="blur_view">Troubler Vue (Adverse)</option>
                            <option value="hide_score">Cacher Score</option>
                            <option value="discard_enemy_cards">Défausser Cartes (Adverse)</option>
                            <option value="shuffle_deck">Mélanger Deck (Adverse)</option>
                            <option value="freeze_button">Geler Bouton (Adverse)</option>
                            <option value="double_points">Double Ferveur (Soi)</option>
                            <option value="shield">Bouclier (Soi)</option>
                            <option value="mirror">Miroir (Soi)</option>
                            <option value="energy_regen_boost">Boost Regen (Soi)</option>
                            <option value="earthquake">Séisme (Adverse)</option>
                            <option value="fake_buttons">Boutons Fantômes (Adverse)</option>
                            <option value="card_lock">Bloquer Cartes (Adverse)</option>
                            <option value="swap_hands">Échanger Mains</option>
                            <option value="mimic">Copier Dernière Carte</option>
                            <option value="lucky_draw">Tirage Chanceux</option>
                          </select>
                        </div>
                        <div className="w-24 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Valeur</label>
                          <input
                            type="number"
                            value={effect.value || 0}
                            onChange={e => {
                              const newEffects = [...editingCard.effects];
                              newEffects[idx] = { ...effect, value: Number(e.target.value) };
                              setEditingCard({...editingCard, effects: newEffects});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Durée (s)</label>
                          <input
                            type="number"
                            value={effect.duration || 0}
                            onChange={e => {
                              const newEffects = [...editingCard.effects];
                              newEffects[idx] = { ...effect, duration: Number(e.target.value) };
                              setEditingCard({...editingCard, effects: newEffects});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                          />
                        </div>
                        <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => {
                          const newEffects = editingCard.effects.filter((_, i) => i !== idx);
                          setEditingCard({...editingCard, effects: newEffects});
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditingCard(null)}>Annuler</Button>
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {duelCards.map((card) => (
              <Card key={card.id} className="p-4 hover:border-blue-500 transition-colors cursor-pointer group" onClick={() => setEditingCard(card)}>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100">
                  <img src={getImageUrl(card.imageUrl || '')} alt={card.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Zap size={10} className="text-yellow-400" /> {card.energyCost}
                  </div>
                  <div className={`absolute top-2 left-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                    card.type === 'bonus' ? 'bg-green-500' : card.type === 'malus' ? 'bg-red-500' : 'bg-gray-500'
                  }`}>
                    {card.type}
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black italic uppercase text-sm">{card.name}</h4>
                    <p className="text-[10px] text-gray-500 line-clamp-1">{card.description}</p>
                    {card.fanzIds && card.fanzIds.length > 0 && (
                      <div className="text-[8px] text-blue-500 font-bold mt-1">Fanz: {card.fanzIds.join(', ')}</div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDuelCard(card.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {duelCards.length === 0 && !loading && (
              <div className="col-span-full text-center p-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Aucune carte DUEL trouvée. Utilisez "Synchroniser Base" pour commencer.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'lifeActions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gestion des Actions LIFE</h2>
            <Button onClick={handleCreateNewAction} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
              <Plus className="w-5 h-5" /> Nouvelle Action
            </Button>
          </div>

          {editingAction && (
            <Card className="p-6 border-blue-500">
              <h3 className="text-xl font-bold mb-4">
                {editingAction.id.startsWith('action-') ? 'Créer' : 'Modifier'} l'action
              </h3>
              <form onSubmit={handleSaveLifeAction} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">ID (Unique)</label>
                    <input
                      type="text"
                      value={editingAction.id}
                      onChange={e => setEditingAction({...editingAction, id: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      disabled={!editingAction.id.startsWith('action-')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">ID du Fanz (Optionnel)</label>
                    <input
                      type="text"
                      value={editingAction.fanzTemplateId || ''}
                      onChange={e => setEditingAction({...editingAction, fanzTemplateId: e.target.value})}
                      placeholder="Ex: fanz-1 (Laissez vide pour tous)"
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Nom de l'action</label>
                    <input
                      type="text"
                      value={editingAction.name}
                      onChange={e => setEditingAction({...editingAction, name: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Image</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingAction.image || ''}
                        onChange={e => setEditingAction({...editingAction, image: e.target.value})}
                        className="flex-1 p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                        placeholder="gs://... ou https://..."
                      />
                      {editingAction.image && (
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <img src={getImageUrl(editingAction.image)} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Vidéo</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingAction.videoUrl || ''}
                        onChange={e => setEditingAction({...editingAction, videoUrl: e.target.value})}
                        className="flex-1 p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                        placeholder="gs://... ou https://..."
                      />
                      {editingAction.videoUrl && (
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <Video className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Durée (minutes)</label>
                    <input
                      type="number"
                      value={editingAction.durationMinutes}
                      onChange={e => setEditingAction({...editingAction, durationMinutes: Number(e.target.value)})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      required
                      min="1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Costs */}
                  <div className="space-y-4 p-4 bg-red-50 rounded-xl border border-red-100">
                    <h4 className="font-bold text-red-800">Coûts</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Énergie</label>
                        <input type="number" value={editingAction.energyCost || 0} onChange={e => setEditingAction({...editingAction, energyCost: Number(e.target.value)})} className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Argent</label>
                        <input type="number" value={editingAction.moneyCost || 0} onChange={e => setEditingAction({...editingAction, moneyCost: Number(e.target.value)})} className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Gemmes</label>
                        <input type="number" value={editingAction.gemsCost || 0} onChange={e => setEditingAction({...editingAction, gemsCost: Number(e.target.value)})} className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Boosts</label>
                        <input type="number" value={editingAction.boostCost || 0} onChange={e => setEditingAction({...editingAction, boostCost: Number(e.target.value)})} className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" />
                      </div>
                    </div>
                  </div>

                  {/* Gains */}
                  <div className="space-y-4 p-4 bg-green-50 rounded-xl border border-green-100">
                    <h4 className="font-bold text-green-800">Gains (Ressources)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Énergie</label>
                        <input type="number" value={editingAction.energyGain || 0} onChange={e => setEditingAction({...editingAction, energyGain: Number(e.target.value)})} className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Argent</label>
                        <input type="number" value={editingAction.moneyGain || 0} onChange={e => setEditingAction({...editingAction, moneyGain: Number(e.target.value)})} className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Gemmes</label>
                        <input type="number" value={editingAction.gemsGain || 0} onChange={e => setEditingAction({...editingAction, gemsGain: Number(e.target.value)})} className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Boosts</label>
                        <input type="number" value={editingAction.boostGain || 0} onChange={e => setEditingAction({...editingAction, boostGain: Number(e.target.value)})} className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* XP Gains */}
                <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-800">Gains XP (Compétences)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['force', 'endurance', 'mental', 'bluff', 'creativity', 'social', 'intelligence', 'charisma'].map((stat) => (
                      <div key={stat} className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 capitalize">{stat}</label>
                        <input 
                          type="number" 
                          value={editingAction.xpGains?.[stat as keyof typeof editingAction.xpGains] || 0} 
                          onChange={e => setEditingAction({
                            ...editingAction, 
                            xpGains: { ...editingAction.xpGains, [stat]: Number(e.target.value) }
                          })} 
                          className="w-full p-2 bg-white text-gray-900 rounded-lg border-none" 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditingAction(null)}>Annuler</Button>
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lifeActions.map((action) => (
              <Card key={action.id} className="p-4 hover:border-blue-500 transition-colors cursor-pointer" onClick={() => setEditingAction(action)}>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                    {action.videoUrl ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Video className="w-6 h-6 text-white" />
                      </div>
                    ) : null}
                    {action.image ? (
                      <img src={getImageUrl(action.image)} alt={action.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Activity className="w-8 h-8 text-gray-400" /></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg">{action.name}</h4>
                    <div className="text-sm text-gray-500">{action.durationMinutes} minutes</div>
                    <div className="text-xs text-gray-400 mt-1">ID: {action.id}</div>
                    {action.fanzTemplateId && (
                      <div className="text-xs text-blue-500 mt-1 font-bold">Fanz: {action.fanzTemplateId}</div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLifeAction(action.id);
                    }}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </Card>
            ))}
            {lifeActions.length === 0 && !loading && (
              <div className="col-span-full text-center p-8 text-gray-500">
                Aucune action LIFE trouvée dans la base de données.
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'fanz' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gestion des FANZ</h2>
            <div className="flex gap-3">
              <Button onClick={handleFixAllUrls} variant="outline" className="flex items-center gap-2">
        <RefreshCw className="w-5 h-5" /> Réparer URLs
      </Button>
      <Button onClick={handleSyncBaseFanz} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" /> Synchroniser Base
              </Button>
              <Button onClick={handleCreateNewFanz} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Plus className="w-5 h-5" /> Nouveau FANZ
              </Button>
            </div>
          </div>

          {status && activeTab === 'fanz' && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              status.type === 'success' ? 'bg-green-100 text-green-800' :
              status.type === 'error' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
               status.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
               <RefreshCw className="w-5 h-5 animate-spin" />}
              {status.message}
            </div>
          )}

          {editingFanz && (
            <Card className="p-6 border-blue-500">
              <h3 className="text-xl font-bold mb-4">
                {editingFanz.id.startsWith('fanz-') ? 'Créer' : 'Modifier'} le FANZ
              </h3>
              <form onSubmit={handleSaveFanzTemplate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">ID (Unique)</label>
                    <input
                      type="text"
                      value={editingFanz.id}
                      onChange={e => setEditingFanz({...editingFanz, id: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      disabled={!editingFanz.id.startsWith('fanz-')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Nom du FANZ</label>
                    <input
                      type="text"
                      value={editingFanz.name}
                      onChange={e => setEditingFanz({...editingFanz, name: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Rareté</label>
                    <select
                      value={editingFanz.rarity}
                      onChange={e => setEditingFanz({...editingFanz, rarity: e.target.value as any})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    >
                      <option value="common">Commune</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Épique</option>
                      <option value="legendary">Légendaire</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <textarea
                      value={editingFanz.description}
                      onChange={e => setEditingFanz({...editingFanz, description: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none h-20"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Image</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingFanz.image || ''}
                        onChange={e => setEditingFanz({...editingFanz, image: e.target.value})}
                        className="flex-1 p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                        placeholder="https://..."
                        required
                      />
                      {editingFanz.image && (
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <img src={getImageUrl(editingFanz.image)} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Vidéo (Optionnel)</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingFanz.video || ''}
                        onChange={e => setEditingFanz({...editingFanz, video: e.target.value})}
                        className="flex-1 p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                        placeholder="https://..."
                      />
                      {editingFanz.video && (
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <Video className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-500" /> Statistiques de Base
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.keys(editingFanz.baseStats).map((stat) => (
                      <div key={stat} className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-400">{stat}</label>
                        <input
                          type="number"
                          value={editingFanz.baseStats[stat as keyof FanzStats]}
                          onChange={e => setEditingFanz({
                            ...editingFanz,
                            baseStats: {
                              ...editingFanz.baseStats,
                              [stat]: Number(e.target.value)
                            }
                          })}
                          className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                          min="1"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-500" /> Chemin de la Ferveur
                    </h4>
                    <Button type="button" size="sm" onClick={() => setEditingFanz({
                      ...editingFanz,
                      ferveurPath: [...(editingFanz.ferveurPath || []), { level: (editingFanz.ferveurPath?.length || 0) + 1, pointsRequired: ((editingFanz.ferveurPath?.length || 0) + 1) * 100 }]
                    })}>
                      Ajouter Palier
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(editingFanz.ferveurPath || []).map((path, idx) => (
                      <div key={idx} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg">
                        <div className="w-16 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Niv.</label>
                          <input type="number" value={path.level} readOnly className="w-full p-2 bg-white text-gray-400 rounded border-none text-sm" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Points Requis (1-1000)</label>
                          <input
                            type="number"
                            value={path.pointsRequired}
                            onChange={e => {
                              const newPath = [...(editingFanz.ferveurPath || [])];
                              newPath[idx] = { ...path, pointsRequired: Number(e.target.value) };
                              setEditingFanz({...editingFanz, ferveurPath: newPath});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                            min="1"
                            max="1000"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Récompense Type</label>
                          <select
                            value={path.reward?.type || 'money'}
                            onChange={e => {
                              const newPath = [...(editingFanz.ferveurPath || [])];
                              newPath[idx] = { ...path, reward: { ...(path.reward || { type: 'money', amount: 0 }), type: e.target.value as any } };
                              setEditingFanz({...editingFanz, ferveurPath: newPath});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                          >
                            <option value="money">Argent</option>
                            <option value="gems">Gemmes</option>
                            <option value="boost">Points Boost</option>
                            <option value="xp">XP Compétence</option>
                            <option value="card">Carte Duel</option>
                            <option value="skin">Skin</option>
                            <option value="emote">Emote</option>
                            <option value="choice">Choix (Carte/Skin/Emote)</option>
                          </select>
                        </div>
                        {(path.reward?.type === 'money' || path.reward?.type === 'gems' || path.reward?.type === 'boost' || path.reward?.type === 'xp') && (
                          <div className="w-24 space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Valeur</label>
                            <input
                              type="number"
                              value={path.reward?.amount || 0}
                              onChange={e => {
                                const newPath = [...(editingFanz.ferveurPath || [])];
                                newPath[idx] = { ...path, reward: { ...(path.reward || { type: 'money', amount: 0 }), amount: Number(e.target.value) } };
                                setEditingFanz({...editingFanz, ferveurPath: newPath});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                            />
                          </div>
                        )}
                        {path.reward?.type === 'card' && (
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">ID Carte</label>
                            <input
                              type="text"
                              value={path.reward?.cardId || ''}
                              onChange={e => {
                                const newPath = [...(editingFanz.ferveurPath || [])];
                                newPath[idx] = { ...path, reward: { ...(path.reward || { type: 'card' }), cardId: e.target.value } };
                                setEditingFanz({...editingFanz, ferveurPath: newPath});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                              placeholder="ID..."
                            />
                          </div>
                        )}
                        {path.reward?.type === 'skin' && (
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">ID Skin</label>
                            <input
                              type="text"
                              value={path.reward?.skinId || ''}
                              onChange={e => {
                                const newPath = [...(editingFanz.ferveurPath || [])];
                                newPath[idx] = { ...path, reward: { ...(path.reward || { type: 'skin' }), skinId: e.target.value } };
                                setEditingFanz({...editingFanz, ferveurPath: newPath});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                              placeholder="ID..."
                            />
                          </div>
                        )}
                        {path.reward?.type === 'emote' && (
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">ID Emote</label>
                            <input
                              type="text"
                              value={path.reward?.emoteId || ''}
                              onChange={e => {
                                const newPath = [...(editingFanz.ferveurPath || [])];
                                newPath[idx] = { ...path, reward: { ...(path.reward || { type: 'emote' }), emoteId: e.target.value } };
                                setEditingFanz({...editingFanz, ferveurPath: newPath});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                              placeholder="ID..."
                            />
                          </div>
                        )}
                        <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => {
                          const newPath = (editingFanz.ferveurPath || []).filter((_, i) => i !== idx);
                          setEditingFanz({...editingFanz, ferveurPath: newPath});
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <h4 className="font-bold flex items-center gap-2 text-orange-800">
                    <RefreshCw className="w-5 h-5" /> Récompenses Récurrentes (Hors Niveau)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Tous les X points</label>
                      <input
                        type="number"
                        value={editingFanz.recurringReward?.points || 20}
                        onChange={e => setEditingFanz({
                          ...editingFanz,
                          recurringReward: { ...(editingFanz.recurringReward || { points: 20, type: 'money', amount: 100 }), points: Number(e.target.value) }
                        })}
                        className="w-full p-2 bg-white text-gray-900 rounded-lg border-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Type de gain</label>
                      <select
                        value={editingFanz.recurringReward?.type || 'money'}
                        onChange={e => setEditingFanz({
                          ...editingFanz,
                          recurringReward: { ...(editingFanz.recurringReward || { points: 20, type: 'money', amount: 100 }), type: e.target.value as any }
                        })}
                        className="w-full p-2 bg-white text-gray-900 rounded-lg border-none"
                      >
                        <option value="money">Argent</option>
                        <option value="boost">Boost</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Montant</label>
                      <input
                        type="number"
                        value={editingFanz.recurringReward?.amount || 100}
                        onChange={e => setEditingFanz({
                          ...editingFanz,
                          recurringReward: { ...(editingFanz.recurringReward || { points: 20, type: 'money', amount: 100 }), amount: Number(e.target.value) }
                        })}
                        className="w-full p-2 bg-white text-gray-900 rounded-lg border-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold flex items-center gap-2">
                      <Star className="w-5 h-5 text-purple-500" /> Skins du Fanz
                    </h4>
                    <Button type="button" size="sm" onClick={() => {
                      const newSkins = [...(editingFanz.skins || []), { id: `skin-${Date.now()}`, fanzId: editingFanz.id, name: 'Nouveau Skin', imageUrl: '', videoUrl: '', price: { type: 'money' as const, amount: 1000 } }];
                      setEditingFanz({...editingFanz, skins: newSkins});
                    }}>
                      Ajouter Skin
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(editingFanz.skins || []).map((skin, sIdx) => (
                      <div key={sIdx} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-200 relative">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="absolute top-2 right-2 text-red-500"
                          onClick={() => {
                            const newSkins = editingFanz.skins.filter((_, i) => i !== sIdx);
                            setEditingFanz({...editingFanz, skins: newSkins});
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Nom</label>
                            <input
                              type="text"
                              value={skin.name}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, name: e.target.value };
                                setEditingFanz({...editingFanz, skins: newSkins});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">ID</label>
                            <input
                              type="text"
                              value={skin.id}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, id: e.target.value };
                                setEditingFanz({...editingFanz, skins: newSkins});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Image URL</label>
                            <input
                              type="text"
                              value={skin.imageUrl}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, imageUrl: e.target.value };
                                setEditingFanz({...editingFanz, skins: newSkins});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Video URL</label>
                            <input
                              type="text"
                              value={skin.videoUrl || ''}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, videoUrl: e.target.value };
                                setEditingFanz({...editingFanz, skins: newSkins});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Prix Type</label>
                            <select
                              value={skin.price.type}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, price: { ...skin.price, type: e.target.value as any } };
                                setEditingFanz({...editingFanz, skins: newSkins});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            >
                              <option value="money">Argent</option>
                              <option value="gems">Gemmes</option>
                              <option value="boostPoints">Boost</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Montant</label>
                            <input
                              type="number"
                              value={skin.price.amount}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, price: { ...skin.price, amount: Number(e.target.value) } };
                                setEditingFanz({...editingFanz, skins: newSkins});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-yellow-500" /> Emotes du Fanz
                    </h4>
                    <Button type="button" size="sm" onClick={() => {
                      const newEmotes = [...(editingFanz.emotes || []), { id: `emote-${Date.now()}`, fanzId: editingFanz.id, name: 'Nouvel Emote', imageUrl: '' }];
                      setEditingFanz({...editingFanz, emotes: newEmotes});
                    }}>
                      Ajouter Emote
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(editingFanz.emotes || []).map((emote, eIdx) => (
                      <div key={eIdx} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-200 relative">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="absolute top-2 right-2 text-red-500"
                          onClick={() => {
                            const newEmotes = editingFanz.emotes.filter((_, i) => i !== eIdx);
                            setEditingFanz({...editingFanz, emotes: newEmotes});
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Nom</label>
                            <input
                              type="text"
                              value={emote.name}
                              onChange={e => {
                                const newEmotes = [...editingFanz.emotes];
                                newEmotes[eIdx] = { ...emote, name: e.target.value };
                                setEditingFanz({...editingFanz, emotes: newEmotes});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">ID</label>
                            <input
                              type="text"
                              value={emote.id}
                              onChange={e => {
                                const newEmotes = [...editingFanz.emotes];
                                newEmotes[eIdx] = { ...emote, id: e.target.value };
                                setEditingFanz({...editingFanz, emotes: newEmotes});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Image URL</label>
                          <input
                            type="text"
                            value={emote.imageUrl}
                            onChange={e => {
                              const newEmotes = [...editingFanz.emotes];
                              newEmotes[eIdx] = { ...emote, imageUrl: e.target.value };
                              setEditingFanz({...editingFanz, emotes: newEmotes});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" /> Récompenses de Rang (1-10)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 10 }).map((_, rIdx) => {
                      const rankNum = rIdx + 1;
                      const slotId = `rank-${rankNum}`;
                      const reward = editingFanz.rankRewards?.[slotId] || { id: slotId, type: 'choice' };
                      
                      return (
                        <div key={rankNum} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-200">
                          <div className="flex justify-between items-center">
                            <div className="font-black italic uppercase text-sm text-gray-500">Rang {rankNum}</div>
                            <Trophy className="w-4 h-4 text-orange-500" />
                          </div>
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Récompense unique</div>
                            <select
                              value={reward.type}
                              onChange={e => {
                                const newRewards = { ...(editingFanz.rankRewards || {}) };
                                newRewards[slotId] = { ...reward, type: e.target.value as any };
                                setEditingFanz({...editingFanz, rankRewards: newRewards});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs font-bold"
                            >
                              <option value="choice">Choix (Carte/XP/Skin/Emote)</option>
                              <option value="card">Carte Spécifique</option>
                              <option value="xp">XP Spécifique</option>
                              <option value="skin">Skin Spécifique</option>
                              <option value="emote">Emote Spécifique</option>
                            </select>
                            {reward.type === 'card' && (
                              <input
                                type="text"
                                value={reward.cardId || ''}
                                onChange={e => {
                                  const newRewards = { ...(editingFanz.rankRewards || {}) };
                                  newRewards[slotId] = { ...reward, cardId: e.target.value };
                                  setEditingFanz({...editingFanz, rankRewards: newRewards});
                                }}
                                placeholder="ID de la Carte"
                                className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                              />
                            )}
                            {reward.type === 'skin' && (
                              <input
                                type="text"
                                value={reward.skinId || ''}
                                onChange={e => {
                                  const newRewards = { ...(editingFanz.rankRewards || {}) };
                                  newRewards[slotId] = { ...reward, skinId: e.target.value };
                                  setEditingFanz({...editingFanz, rankRewards: newRewards});
                                }}
                                placeholder="ID du Skin"
                                className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                              />
                            )}
                            {reward.type === 'emote' && (
                              <input
                                type="text"
                                value={reward.emoteId || ''}
                                onChange={e => {
                                  const newRewards = { ...(editingFanz.rankRewards || {}) };
                                  newRewards[slotId] = { ...reward, emoteId: e.target.value };
                                  setEditingFanz({...editingFanz, rankRewards: newRewards});
                                }}
                                placeholder="ID de l'Emote"
                                className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                              />
                            )}
                            {reward.type === 'xp' && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={reward.amount || 100}
                                  onChange={e => {
                                    const newRewards = { ...(editingFanz.rankRewards || {}) };
                                    newRewards[slotId] = { ...reward, amount: Number(e.target.value) };
                                    setEditingFanz({...editingFanz, rankRewards: newRewards});
                                  }}
                                  className="flex-1 p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                                />
                                <span className="text-[10px] font-bold text-gray-500">XP</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditingFanz(null)}>Annuler</Button>
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {fanzTemplates.map((template) => (
              <Card key={template.id} className="p-4 hover:border-blue-500 transition-colors cursor-pointer group" onClick={() => setEditingFanz(template)}>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100">
                  <img src={getImageUrl(template.image)} alt={template.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className={`absolute top-2 left-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                    template.rarity === 'legendary' ? 'bg-yellow-500' : template.rarity === 'epic' ? 'bg-purple-500' : template.rarity === 'rare' ? 'bg-blue-500' : 'bg-gray-500'
                  }`}>
                    {template.rarity}
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-lg">{template.name}</h4>
                    <div className="text-xs text-gray-400">ID: {template.id}</div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFanzTemplate(template.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {fanzTemplates.length === 0 && !loading && (
              <div className="col-span-full text-center p-8 text-gray-500">
                Aucun FANZ trouvé dans la base de données. Utilisez "Synchroniser Base" pour commencer.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
