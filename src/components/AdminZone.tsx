import React, { useState, useEffect } from 'react';
import { footballApi } from '../services/footballApi';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, collection, getDocs, writeBatch, deleteDoc, query, where, getDoc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { League, Team, Standing, Fixture, LifeAction, Card as DuelCard, FanzTemplate, FerveurLevel, RankReward, FanzStats, Fanz, UserProfile, Mission, Pass, GlobalFervorConfig, WeeklyStreakConfig, WeeklyStreakCycle, DuelConfig, FanzSkin, PassLevel } from '../types';
import { Database, Download, RefreshCw, CheckCircle, AlertCircle, Search, Plus, Save, Trash2, Activity, Video, Layers, Users, Trophy, Star, Shield, Brain, Eye, Info, Flame, MessageCircle, Calendar, Gift, Target, CreditCard, UserCog, List, LayoutGrid, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { generateFervorPath } from '../utils/fervorPath';
import { RewardSelector } from './RewardSelector';
import { FanzSkinsTable, FanzEmotesTable, FanzFerveurTable } from './FanzItemsTable';
import { AdminLifeActionRow } from './AdminLifeActionRow';
import { AdminDuelCardRow } from './AdminDuelCardRow';
import { AdminMissionsTable } from './AdminMissionsTable';
import { AdminPassesTable } from './AdminPassesTable';
import { BASE_CARDS } from '../constants/cards';
import { ALL_FANZ } from '../constants/fanz';
import { LOGOS } from '../constants';

import { footballDataService } from '../services/footballDataService';

export function AdminZone() {
  const [activeTab, setActiveTab] = useState<'football' | 'lifeActions' | 'duelCards' | 'fanz' | 'users' | 'duelConfig' | 'shop'>('football');
  const [activeUserSubTab, setActiveUserSubTab] = useState<'profiles' | 'fervor' | 'streak' | 'missions' | 'passes'>('profiles');
  const [confirmRecalculate, setConfirmRecalculate] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  
  // Duel Config state
  const [duelConfig, setDuelConfig] = useState<DuelConfig | null>(null);
  
  // Football state
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(footballDataService.getCurrentSeasonYear());
  const [leagues, setLeagues] = useState<any[]>([]);
  const [manualLeagueId, setManualLeagueId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error' | 'loading', message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [leagueSort, setLeagueSort] = useState<{column: string, direction: 'asc'|'desc'}>({column: 'id', direction: 'asc'});
  const [leagueActivationPrompt, setLeagueActivationPrompt] = useState<{ id: number, name: string } | null>(null);

  // Life Actions state
  const [lifeActions, setLifeActions] = useState<LifeAction[]>([]);
  const [editingAction, setEditingAction] = useState<LifeAction | null>(null);
  const [filterLifeActionFanz, setFilterLifeActionFanz] = useState<string>('all');
  const [lifeActionViewMode, setLifeActionViewMode] = useState<'grid'|'list'>('grid');
  const [lifeActionSort, setLifeActionSort] = useState<{column: string, direction: 'asc'|'desc'} | null>(null);
  const [searchLifeAction, setSearchLifeAction] = useState<string>('');

  // Duel Cards state
  const [duelCards, setDuelCards] = useState<DuelCard[]>([]);
  const [editingCard, setEditingCard] = useState<DuelCard | null>(null);
  const [filterCardType, setFilterCardType] = useState<string>('all');
  const [filterCardRarity, setFilterCardRarity] = useState<string>('all');
  const [filterCardFanz, setFilterCardFanz] = useState<string>('all');
  const [cardViewMode, setCardViewMode] = useState<'grid'|'list'>('grid');
  const [cardSort, setCardSort] = useState<{column: string, direction: 'asc'|'desc'} | null>(null);
  const [searchCard, setSearchCard] = useState<string>('');


  // Fanz state
  const [fanzTemplates, setFanzTemplates] = useState<FanzTemplate[]>([]);
  const [editingFanz, setEditingFanz] = useState<FanzTemplate | null>(null);
  const [fanzViewMode, setFanzViewMode] = useState<'grid'|'list'>('grid');
  const [fanzSort, setFanzSort] = useState<{column: string, direction: 'asc'|'desc'}>({column: 'id', direction: 'asc'});
  const [modifiedFanzIds, setModifiedFanzIds] = useState<Set<string>>(new Set());

  const handleFanzSort = (column: string) => {
    if (fanzSort.column === column) {
      setFanzSort({ column, direction: fanzSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setFanzSort({ column, direction: 'asc' });
    }
  };

  const sortedFanzTemplates = React.useMemo(() => {
    let sorted = [...fanzTemplates];
    sorted.sort((a, b) => {
      let valA: any = a[fanzSort.column as keyof FanzTemplate];
      let valB: any = b[fanzSort.column as keyof FanzTemplate];
      
      if (fanzSort.column === 'skins') {
        valA = a.skins?.length || 0;
        valB = b.skins?.length || 0;
      } else if (fanzSort.column === 'emotes') {
        valA = a.emotes?.length || 0;
        valB = b.emotes?.length || 0;
      }
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return fanzSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (valA < valB) return fanzSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return fanzSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [fanzTemplates, fanzSort]);

  const handleQuickSaveFanz = async (e: React.MouseEvent, template: FanzTemplate) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const fanzRef = doc(db, 'fanz_templates', template.id);
      
      // Auto-generate fervor path if needed
      if (template.ferveurConfig && template.ferveurConfig.ranges && template.ferveurConfig.ranges.length > 0) {
        const lastRange = template.ferveurConfig.ranges[template.ferveurConfig.ranges.length - 1];
        template.ferveurPath = generateFervorPath(lastRange.max || 150000, template.ferveurConfig);
      } else if (!template.ferveurPath || template.ferveurPath.length === 0) {
        if (fanzFervorConfig) {
          const defaultPath = generateFervorPath(fanzFervorConfig.ranges?.[fanzFervorConfig.ranges.length - 1]?.max || 150000, fanzFervorConfig);
          template.ferveurPath = defaultPath;
        }
      }

      const sanitizedFanz = JSON.parse(JSON.stringify(template));
      await setDoc(fanzRef, sanitizedFanz);
      setStatus({ type: 'success', message: 'FANZ mis à jour avec succès !' });
      setModifiedFanzIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template.id);
        return newSet;
      });
    } catch (err) {
      console.error("Error saving fanz template", err);
      handleFirestoreError(err, OperationType.WRITE, `fanz_templates/${template.id}`);
      setStatus({ type: 'error', message: `Erreur: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateFanz = async (e: React.MouseEvent, template: FanzTemplate) => {
    e.stopPropagation();
    const newId = `fanz-${Date.now()}`;
    const newTemplate = {
      ...template,
      id: newId,
      name: `${template.name} (Copie)`,
      skins: template.skins?.map(skin => ({ ...skin, id: `skin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, fanzId: newId })),
      emotes: template.emotes?.map(emote => ({ ...emote, id: `emote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, fanzId: newId }))
    };
    
    setLoading(true);
    try {
      const fanzRef = doc(db, 'fanz_templates', newId);
      const sanitizedFanz = JSON.parse(JSON.stringify(newTemplate));
      await setDoc(fanzRef, sanitizedFanz);
      setStatus({ type: 'success', message: 'FANZ dupliqué !' });
      fetchFanzTemplates();
    } catch (err) {
      console.error("Error duplicating fanz template", err);
      setStatus({ type: 'error', message: 'Erreur lors de la duplication' });
    } finally {
      setLoading(false);
    }
  };

  const handleLocalFanzChange = (id: string, updates: Partial<FanzTemplate>) => {
    setFanzTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    setModifiedFanzIds(prev => new Set(prev).add(id));
  };

  const effectiveFanzTemplates = React.useMemo(() => {
    let merged = [...fanzTemplates];
    if (editingFanz) {
      const idx = merged.findIndex(t => t.id === editingFanz.id);
      if (idx !== -1) merged[idx] = editingFanz as FanzTemplate;
      else merged.push(editingFanz as FanzTemplate);
    }
    return merged;
  }, [fanzTemplates, editingFanz]);

  // User Management state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [userFervorConfig, setUserFervorConfig] = useState<GlobalFervorConfig | null>(null);
  const [fanzFervorConfig, setFanzFervorConfig] = useState<GlobalFervorConfig | null>(null);
  const [streakCycles, setStreakCycles] = useState<WeeklyStreakCycle[]>([]);
  const [editingCycle, setEditingCycle] = useState<WeeklyStreakCycle | null>(null);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [editingPass, setEditingPass] = useState<Pass | null>(null);
  const [shopConfig, setShopConfig] = useState<any | null>(null);

  const fetchShopConfig = async () => {
    try {
      setStatus({ type: 'loading', message: 'Chargement config de la boutique...' });
      const docRef = doc(db, 'global_configs', 'shop');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.boosts || data.boosts.length === 0) {
           data.boosts = [
             { id: 'b1', name: 'Boost XP x2', duration: '24h', price: 100, currency: 'boost', color: 'blue' },
             { id: 'b2', name: 'Énergie Infinie', duration: '1h', price: 50, currency: 'boost', color: 'yellow' },
             { id: 'b3', name: 'Bouclier Anti-Malus', duration: '3 Matchs', price: 150, currency: 'boost', color: 'green' }
           ];
        }
        setShopConfig(data);
      } else {
        const defaultShopConfig = {
          id: 'shop',
          ferveurPacks: [
             { id: 'pack_1', name: 'Pack Ferveur Standard', price: 5, numberOfRewards: 1, description: '1 Récompense (Skin, Carte, Énergie...)' },
             { id: 'pack_2', name: 'Pack Ferveur Épique', price: 9, numberOfRewards: 2, description: '2 Récompenses (Skins, Cartes, Énergie...)' },
             { id: 'pack_3', name: 'Pack Ferveur Légendaire', price: 13, numberOfRewards: 3, description: '3 Récompenses (Skins, Cartes, Énergie...)' }
          ],
          boosts: [
             { id: 'b1', name: 'Boost XP x2', duration: '24h', price: 100, currency: 'boost', color: 'blue' },
             { id: 'b2', name: 'Énergie Infinie', duration: '1h', price: 50, currency: 'boost', color: 'yellow' },
             { id: 'b3', name: 'Bouclier Anti-Malus', duration: '3 Matchs', price: 150, currency: 'boost', color: 'green' }
          ]
        };
        setShopConfig(defaultShopConfig);
      }
      setStatus(null);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Erreur lors du chargement' });
    }
  };

  const handleSaveShopConfig = async (newConfig: any) => {
    try {
      setStatus({ type: 'loading', message: 'Sauvegarde config boutique...' });
      await setDoc(doc(db, 'global_configs', 'shop'), newConfig);
      setShopConfig(newConfig);
      setStatus({ type: 'success', message: 'Config boutique sauvegardée' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    }
  };

  useEffect(() => {
    if (activeTab === 'lifeActions') {
      fetchLifeActions();
      if (fanzTemplates.length === 0) fetchFanzTemplates();
    } else if (activeTab === 'duelCards') {
      fetchDuelCards();
      if (fanzTemplates.length === 0) fetchFanzTemplates();
    } else if (activeTab === 'fanz') {
      fetchFanzTemplates();
      fetchUserFervorConfig();
      if (lifeActions.length === 0) fetchLifeActions();
      if (duelCards.length === 0) fetchDuelCards();
    } else if (activeTab === 'users') {
      // Only fetch the current sub-tab's data to avoid massive reads
      if (activeUserSubTab === 'profiles') fetchUsers();
      if (activeUserSubTab === 'missions') {
        fetchMissions();
        if (fanzTemplates.length === 0) fetchFanzTemplates();
        if (lifeActions.length === 0) fetchLifeActions();
        if (duelCards.length === 0) fetchDuelCards();
      }
      if (activeUserSubTab === 'passes') {
        fetchPasses();
        if (fanzTemplates.length === 0) fetchFanzTemplates();
        if (lifeActions.length === 0) fetchLifeActions();
        if (duelCards.length === 0) fetchDuelCards();
      }
      if (activeUserSubTab === 'fervor') {
        fetchUserFervorConfig();
        if (fanzTemplates.length === 0) fetchFanzTemplates();
        if (lifeActions.length === 0) fetchLifeActions();
        if (duelCards.length === 0) fetchDuelCards();
      }
      if (activeUserSubTab === 'streak') {
        fetchStreakCycles();
        if (fanzTemplates.length === 0) fetchFanzTemplates();
        if (lifeActions.length === 0) fetchLifeActions();
        if (duelCards.length === 0) fetchDuelCards();
      }
    } else if (activeTab === 'duelConfig') {
      fetchDuelConfig();
    } else if (activeTab === 'shop') {
      fetchShopConfig();
    }
  }, [activeTab, activeUserSubTab]); // Added activeUserSubTab to dependencies

  useEffect(() => {
    const addLifeActionsToFanz2 = async () => {
      return; // Automated injection removed
      try {
        const lifeActionsToAdd = [
          {
            id: 'action-fanz2-001',
            fanzTemplateId: 'fanz-2',
            name: "Transport d'une peluche géante",
            image: '/fanz/imageFanz002Life001.png',
            videoUrl: '/fanz/videoFanz002Life001.mp4',
            durationMinutes: 30,
            energyCost: 10,
            moneyCost: 0,
            gemsCost: 0,
            boostCost: 0,
            energyGain: 0,
            moneyGain: 0,
            gemsGain: 0,
            boostGain: 0,
            xpGains: { force: 5 }
          },
          {
            id: 'action-fanz2-002',
            fanzTemplateId: 'fanz-2',
            name: "Faire la queue pour le méga-câlin",
            image: '/fanz/imageFanz002Life002.png',
            videoUrl: '/fanz/videoFanz002Life002.mp4',
            durationMinutes: 60,
            energyCost: 10,
            moneyCost: 0,
            gemsCost: 0,
            boostCost: 0,
            energyGain: 0,
            moneyGain: 0,
            gemsGain: 0,
            boostGain: 0,
            xpGains: { endurance: 5 }
          },
          {
            id: 'action-fanz2-003',
            fanzTemplateId: 'fanz-2',
            name: "Apprendre la chorégraphie de la mascotte",
            image: '/fanz/imageFanz002Life003.png',
            videoUrl: '/fanz/videoFanz002Life003.mp4',
            durationMinutes: 30,
            energyCost: 5,
            moneyCost: 0,
            gemsCost: 0,
            boostCost: 0,
            energyGain: 0,
            moneyGain: 0,
            gemsGain: 0,
            boostGain: 0,
            xpGains: { mental: 5 }
          },
          {
            id: 'action-fanz2-004',
            fanzTemplateId: 'fanz-2',
            name: "Les yeux doux à la boutique du stade",
            image: '/fanz/imageFanz002Life004.png',
            videoUrl: '/fanz/videoFanz002Life004.mp4',
            durationMinutes: 30,
            energyCost: 5,
            moneyCost: 0,
            gemsCost: 0,
            boostCost: 0,
            energyGain: 0,
            moneyGain: 0,
            gemsGain: 0,
            boostGain: 0,
            xpGains: { charisma: 5 }
          },
          {
            id: 'action-fanz2-005',
            fanzTemplateId: 'fanz-2',
            name: "Atelier Origami Mascottes",
            image: '/fanz/imageFanz002Life005.png',
            videoUrl: '/fanz/videoFanz002Life005.mp4',
            durationMinutes: 60,
            energyCost: 10,
            moneyCost: 0,
            gemsCost: 0,
            boostCost: 0,
            energyGain: 0,
            moneyGain: 0,
            gemsGain: 0,
            boostGain: 0,
            xpGains: { creativity: 5 }
          },
          {
            id: 'action-fanz2-006',
            fanzTemplateId: 'fanz-2',
            name: "Bourse d'échange de stickers à la mi-temps",
            image: '/fanz/imageFanz002Life006.png',
            videoUrl: '/fanz/videoFanz002Life006.mp4',
            durationMinutes: 30,
            energyCost: 5,
            moneyCost: 0,
            gemsCost: 0,
            boostCost: 0,
            energyGain: 0,
            moneyGain: 0,
            gemsGain: 0,
            boostGain: 0,
            xpGains: { social: 5 }
          },
          {
            id: 'action-fanz2-007',
            fanzTemplateId: 'fanz-2',
            name: "Le jeu des paires (Mascotte / Équipe)",
            image: '/fanz/imageFanz002Life007.png',
            videoUrl: '/fanz/videoFanz002Life007.mp4',
            durationMinutes: 30,
            energyCost: 5,
            moneyCost: 0,
            gemsCost: 0,
            boostCost: 0,
            energyGain: 0,
            moneyGain: 0,
            gemsGain: 0,
            boostGain: 0,
            xpGains: { intelligence: 5 }
          },
          {
            id: 'action-fanz2-008',
            fanzTemplateId: 'fanz-2',
            name: "Arriver au stade en mini-cosplay",
            image: '/fanz/imageFanz002Life008.png',
            videoUrl: '/fanz/videoFanz002Life008.mp4',
            durationMinutes: 60,
            energyCost: 10,
            moneyCost: 0,
            gemsCost: 0,
            boostCost: 0,
            energyGain: 0,
            moneyGain: 0,
            gemsGain: 0,
            boostGain: 0,
            xpGains: { bluff: 5 }
          }
        ];

        for (const action of lifeActionsToAdd) {
          const actionRef = doc(db, 'life_actions', action.id);
          const actionSnap = await getDoc(actionRef);
          if (!actionSnap.exists()) {
            await setDoc(actionRef, action);
            console.log(`Added life action: ${action.name}`);
          }
        }
        
        // Refresh life actions if we are on the lifeActions tab
        if (activeTab === 'lifeActions') {
          fetchLifeActions();
        }
      } catch (err) {
        console.error('Error adding life actions to fanz-2:', err);
      }
    };
    
    addLifeActionsToFanz2();
  }, []); // Run once on mount

  useEffect(() => {
    const addSkinsToFanz2 = async () => {
      return; // Automated injection removed
      try {
        const fanzRef = doc(db, 'fanz_templates', 'fanz-2');
        const fanzSnap = await getDoc(fanzRef);
        if (fanzSnap.exists()) {
          const data = fanzSnap.data() as FanzTemplate;
          const existingSkins = data.skins || [];
          
          const skinsToAdd = [
            { id: 'skin001', name: 'Mascotte Fanzzy Lion', imageUrl: '/fanz/imageFanz002Skin001.png', videoUrl: '/fanz/videoFanz002Skin001.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin002', name: 'Mascotte Fanzzy Glove', imageUrl: '/fanz/imageFanz002Skin002.png', videoUrl: '/fanz/videoFanz002Skin002.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin003', name: 'Mascotte Fanzzy Redgirl', imageUrl: '/fanz/imageFanz002Skin003.png', videoUrl: '/fanz/videoFanz002Skin003.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin004', name: 'Mascotte Fanzzy Megaphone', imageUrl: '/fanz/imageFanz002Skin004.png', videoUrl: '/fanz/videoFanz002Skin004.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin005', name: 'Mascotte Fanzzy Green', imageUrl: '/fanz/imageFanz002Skin005.png', videoUrl: '/fanz/videoFanz002Skin005.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin006', name: 'Mascotte Fanzzy Ball', imageUrl: '/fanz/imageFanz002Skin006.png', videoUrl: '/fanz/videoFanz002Skin006.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin007', name: 'Mascotte Fanzzy Hotdog', imageUrl: '/fanz/imageFanz002Skin007.png', videoUrl: '/fanz/videoFanz002Skin007.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin008', name: 'Mascotte Fanzzy Goldcup', imageUrl: '/fanz/imageFanz002Skin008.png', videoUrl: '/fanz/videoFanz002Skin008.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin009', name: 'Mascotte Fanzzy Eagle', imageUrl: '/fanz/imageFanz002Skin009.png', videoUrl: '/fanz/videoFanz002Skin009.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin010', name: 'Mascotte Fanzzy Vuvuzela', imageUrl: '/fanz/imageFanz002Skin010.png', videoUrl: '/fanz/videoFanz002Skin010.mp4', price: { money: 100, gems: 0, boostPoints: 0 } },
            { id: 'skin011', name: 'Mascotte Fanzzy Festival', imageUrl: '/fanz/imageFanz002Skin011.png', videoUrl: '/fanz/videoFanz002Skin011.mp4', price: { money: 100, gems: 0, boostPoints: 0 } }
          ];

          const newSkins = skinsToAdd.filter(s => !existingSkins.find(ex => ex.id === s.id));
          
          if (newSkins.length > 0) {
            const updatedSkins = [...existingSkins, ...newSkins];
            await updateDoc(fanzRef, { skins: updatedSkins });
            console.log(`Successfully added ${newSkins.length} skins to fanz-2.`);
            // Refresh templates if we are on the fanz tab
            if (activeTab === 'fanz') {
              fetchFanzTemplates();
            }
          }
        }
      } catch (err) {
        console.error('Error adding skins to fanz-2:', err);
      }
    };
    
    addSkinsToFanz2();
  }, []); // Run once on mount

  const fetchUserData = () => {
    fetchUsers();
    fetchMissions();
    fetchPasses();
    fetchUserFervorConfig();
    fetchStreakCycles();
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Limit to 100 most recent users to avoid hitting quota
      const q = query(collection(db, 'users'), orderBy('lastLoginDate', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      const usersData = querySnapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching users", err);
      handleFirestoreError(err, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  };

  const fetchMissions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'missions'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
      setMissions(data);
    } catch (err) {
      console.error("Error fetching missions", err);
      handleFirestoreError(err, OperationType.GET, 'missions');
    }
  };

  const fetchPasses = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'passes'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pass));
      setPasses(data);
    } catch (err) {
      console.error("Error fetching passes", err);
      handleFirestoreError(err, OperationType.GET, 'passes');
    }
  };

  const generateWCPass = async () => {
    try {
      setStatus({ type: 'info', message: 'Génération du Pass World Cup 2026...' });
      
      // 1. Fetch Fanz-1 (Baby Fanzzy)
      const fanzRef = doc(db, 'fanz_templates', 'fanz-001');
      const fanzSnap = await getDoc(fanzRef);
      
      if (!fanzSnap.exists()) {
        setStatus({ type: 'error', message: 'Le Fanz Baby Fanzzy (fanz-001) n\'existe pas.' });
        return;
      }
      
      const fanzData = fanzSnap.data() as FanzTemplate;
      const existingSkins = fanzData.skins || [];
      
      // 2. Create 48 skins
      const newSkins: FanzSkin[] = [];
      for (let i = 1; i <= 48; i++) {
        const skinId = `skin-bebe-wc26-${i}`;
        // Only add if it doesn't already exist
        if (!existingSkins.find(s => s.id === skinId)) {
          newSkins.push({
            id: skinId,
            fanzId: 'fanz-001',
            name: `Skin WC26 - Équipe ${i}`,
            imageUrl: `https://thebestfan.online/img/public/fanz/wc26/equipe${i}.png`,
            price: {} // Exclusive to pass
          });
        }
      }
      
      if (newSkins.length > 0) {
        await updateDoc(fanzRef, {
          skins: [...existingSkins, ...newSkins]
        });
      }
      
      // 3. Create the Pass
      const passId = `pass-wc26-${Date.now()}`;
      const levels: PassLevel[] = [];
      
      for (let i = 1; i <= 48; i++) {
        levels.push({
          level: i,
          pointsRequired: i * 100, // 100 points per level
          freeReward: { type: 'money', amount: 50 * i },
          premiumReward: { type: 'skin', skinId: `skin-bebe-wc26-${i}` }
        });
      }
      
      const newPass: Pass = {
        id: passId,
        name: 'Skin Bébé Fanzzy World Cup 2026',
        description: 'Gagnez les 48 skins des équipes qualifiées pour la Coupe du Monde 2026 !',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        priceGems: 0,
        premiumPrice: {
          money: 10000,
          gems: 500
        },
        levels: levels,
        isActive: true
      };
      
      await setDoc(doc(db, 'passes', passId), newPass);
      
      setStatus({ type: 'success', message: 'Pass World Cup 2026 généré avec succès !' });
      fetchPasses();
    } catch (err) {
      console.error("Error generating WC pass", err);
      handleFirestoreError(err, OperationType.WRITE, 'passes/wc26');
    }
  };

  const fetchUserFervorConfig = async () => {
    try {
      const docSnap = await getDocs(collection(db, 'global_configs'));
      const fervorDoc = docSnap.docs.find(d => d.id === 'user_fervor');
      const fanzFervorDoc = docSnap.docs.find(d => d.id === 'fanz_fervor');
      
      const defaultConfig: GlobalFervorConfig = {
        id: 'user_fervor',
        ranges: [
          { level: 1, min: 0, max: 99999, step: 5000, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
          { level: 2, min: 100000, max: 499999, step: 10000, levelReward: { type: 'gems', amount: 100 }, intermediateReward: { type: 'money', amount: 100 } },
          { level: 3, min: 500000, max: 999999, step: 25000, levelReward: { type: 'boost', amount: 5 }, intermediateReward: { type: 'money', amount: 200 } },
          { level: 4, min: 1000000, max: 1999999, step: 50000, levelReward: { type: 'gems', amount: 500 }, intermediateReward: { type: 'money', amount: 500 } },
          { level: 5, min: 2000000, max: 2999999, step: 50000, levelReward: { type: 'money', amount: 10000 }, intermediateReward: { type: 'gems', amount: 10 } },
          { level: 6, min: 3000000, max: 3999999, step: 100000, levelReward: { type: 'boost', amount: 10 }, intermediateReward: { type: 'money', amount: 1000 } },
          { level: 7, min: 4000000, max: 4999999, step: 100000, levelReward: { type: 'gems', amount: 1000 }, intermediateReward: { type: 'money', amount: 1000 } },
          { level: 8, min: 5000000, max: 5999999, step: 100000, levelReward: { type: 'money', amount: 50000 }, intermediateReward: { type: 'gems', amount: 20 } },
          { level: 9, min: 6000000, max: 6999999, step: 200000, levelReward: { type: 'boost', amount: 20 }, intermediateReward: { type: 'money', amount: 2000 } },
          { level: 10, min: 7000000, max: 7999999, step: 200000, levelReward: { type: 'gems', amount: 2000 }, intermediateReward: { type: 'money', amount: 2000 } },
          { level: 11, min: 8000000, max: 8999999, step: 200000, levelReward: { type: 'money', amount: 100000 }, intermediateReward: { type: 'gems', amount: 50 } },
          { level: 12, min: 9000000, max: 9999999, step: 250000, levelReward: { type: 'boost', amount: 50 }, intermediateReward: { type: 'money', amount: 5000 } },
          { level: 13, min: 10000000, max: 11999999, step: 250000, levelReward: { type: 'gems', amount: 5000 }, intermediateReward: { type: 'money', amount: 5000 } },
          { level: 14, min: 12000000, max: 14999999, step: 500000, levelReward: { type: 'money', amount: 500000 }, intermediateReward: { type: 'gems', amount: 100 } },
          { level: 15, min: 15000000, max: 15000000, step: 1000000, levelReward: { type: 'boost', amount: 100 }, intermediateReward: { type: 'money', amount: 10000 } },
        ]
      };

      const defaultFanzConfig: GlobalFervorConfig = {
        id: 'fanz_fervor',
        ranges: [
          { level: 1, min: 0, max: 4999, step: 1000, levelReward: { type: 'gems', amount: 50 }, intermediateReward: { type: 'money', amount: 100 } },
          { level: 2, min: 5000, max: 14999, step: 1000, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 100 } },
          { level: 3, min: 15000, max: 29999, step: 1000, levelReward: { type: 'gems', amount: 100 }, intermediateReward: { type: 'money', amount: 100 } },
          { level: 4, min: 30000, max: 49999, step: 2500, levelReward: { type: 'boost', amount: 5 }, intermediateReward: { type: 'money', amount: 200 } },
          { level: 5, min: 50000, max: 74999, step: 2500, levelReward: { type: 'money', amount: 5000 }, intermediateReward: { type: 'gems', amount: 10 } },
          { level: 6, min: 75000, max: 99999, step: 5000, levelReward: { type: 'gems', amount: 500 }, intermediateReward: { type: 'money', amount: 500 } },
          { level: 7, min: 100000, max: 119999, step: 5000, levelReward: { type: 'boost', amount: 10 }, intermediateReward: { type: 'money', amount: 500 } },
          { level: 8, min: 120000, max: 134999, step: 5000, levelReward: { type: 'money', amount: 10000 }, intermediateReward: { type: 'gems', amount: 20 } },
          { level: 9, min: 135000, max: 149999, step: 5000, levelReward: { type: 'gems', amount: 1000 }, intermediateReward: { type: 'money', amount: 1000 } },
          { level: 10, min: 150000, max: 150000, step: 10000, levelReward: { type: 'gems', amount: 2000 }, intermediateReward: { type: 'money', amount: 2000 } },
        ]
      };

      if (fervorDoc) {
        const data = fervorDoc.data();
        if (!data.ranges || data.ranges.length === 0) {
          setUserFervorConfig({ id: fervorDoc.id, ranges: defaultConfig.ranges, ...data } as GlobalFervorConfig);
        } else {
          setUserFervorConfig({ id: fervorDoc.id, ...data } as GlobalFervorConfig);
        }
      } else {
        setUserFervorConfig(defaultConfig);
      }

      if (fanzFervorDoc) {
        const data = fanzFervorDoc.data();
        if (!data.ranges || data.ranges.length === 0) {
          setFanzFervorConfig({ id: fanzFervorDoc.id, ranges: defaultFanzConfig.ranges, ...data } as GlobalFervorConfig);
        } else {
          setFanzFervorConfig({ id: fanzFervorDoc.id, ...data } as GlobalFervorConfig);
        }
      } else {
        setFanzFervorConfig(defaultFanzConfig);
      }
    } catch (err) {
      console.error("Error fetching user fervor config", err);
      handleFirestoreError(err, OperationType.GET, 'global_configs');
    }
  };

  const fetchStreakCycles = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'weekly_streak_cycles'));
      const data = querySnapshot.docs.map(doc => ({ ...doc.data() } as WeeklyStreakCycle));
      setStreakCycles(data);
    } catch (err) {
      console.error("Error fetching streak cycles", err);
      handleFirestoreError(err, OperationType.GET, 'weekly_streak_cycles');
    }
  };

  const fetchDuelConfig = async () => {
    setLoading(true);
    try {
      const docSnap = await getDocs(collection(db, 'global_configs'));
      const configDoc = docSnap.docs.find(d => d.id === 'duel_config');
      if (configDoc) {
        const data = configDoc.data() as DuelConfig;
        if (!data.rewards) {
          data.rewards = {
            training: { winXp: 5, loseXp: 5 },
            '1v1': { winXp: 10, loseXp: 10 },
            '2v2': { winXp: 20, loseXp: 20 },
            '5v5': { winXp: 300, loseXp: 30 },
            war_of_kops: { winXp: 10, loseXp: 10 }
          };
        }
        setDuelConfig({ id: configDoc.id, ...data });
      } else {
        // Initialize if missing
        const defaultConfig: DuelConfig = {
          id: 'duel_config',
          baseExcitementRegenTime: 5,
          statEffects: [
            { statName: 'force', effectType: 'click_power', baseValue: 0.005, multiplierPerLevel: 0.001, description: 'Force : Augmente la puissance du clic (Ferveur +X%)' },
            { statName: 'endurance', effectType: 'energy_regen', baseValue: 2, multiplierPerLevel: 0.5, description: 'Endurance : Augmente la régénération d\'excitation par seconde' },
            { statName: 'mental', effectType: 'malus_duration', baseValue: 1, multiplierPerLevel: 0.1, description: 'Mental : Augmente la durée des malus infligés à l\'adversaire' },
            { statName: 'bluff', effectType: 'visual_malus_duration', baseValue: 1, multiplierPerLevel: 0.1, description: 'Bluff : Augmente la durée des effets visuels (Flou, Bouton fou, etc.)' },
            { statName: 'creativity', effectType: 'card_cost_reduction', baseValue: 0, multiplierPerLevel: 0.02, description: 'Créativité : Réduit le coût en excitation des cartes' },
            { statName: 'social', effectType: 'ferveur_bonus', baseValue: 0, multiplierPerLevel: 0.05, description: 'Social : Bonus de Ferveur gagnée à la fin du duel' },
            { statName: 'intelligence', effectType: 'rarity_chance', baseValue: 0, multiplierPerLevel: 0.02, description: 'Intelligence : Chance de piocher une carte légendaire' },
            { statName: 'charisma', effectType: 'card_power', baseValue: 1, multiplierPerLevel: 0.05, description: 'Charisme : Augmente la puissance des cartes bonus' },
            { statName: 'endurance', effectType: 'max_energy', baseValue: 10, multiplierPerLevel: 1, description: 'Endurance : Augmente la jauge d\'excitation maximale' },
            { statName: 'force', effectType: 'start_energy', baseValue: 5, multiplierPerLevel: 1, description: 'Force : Augmente l\'excitation de départ' },
            { statName: 'mental', effectType: 'button_visibility', baseValue: 3000, multiplierPerLevel: 200, description: 'Durée de visibilité du bouton (ms)' },
            { statName: 'mental', effectType: 'button_hidden', baseValue: 2000, multiplierPerLevel: -100, description: 'Durée de disparition du bouton (ms)' },
        ],
          costs: {
            training: { money: 5, energy: 5 },
            '1v1': { money: 10, energy: 10 },
            '2v2': { money: 15, energy: 15 },
            '5v5': { money: 20, energy: 20 },
            war_of_kops: { money: 30, energy: 30 }
          },
          rewards: {
            training: { winXp: 5, loseXp: 5 },
            '1v1': { winXp: 10, loseXp: 10 },
            '2v2': { winXp: 20, loseXp: 20 },
            '5v5': { winXp: 300, loseXp: 30 },
            war_of_kops: { winXp: 10, loseXp: 10 }
          }
        };
        setDuelConfig(defaultConfig);
      }
    } catch (err) {
      console.error("Error fetching duel config", err);
      handleFirestoreError(err, OperationType.GET, 'global_configs/duel_config');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDuelConfig = async () => {
    if (!duelConfig) return;
    setLoading(true);
    try {
      const configRef = doc(db, 'global_configs', 'duel_config');
      const sanitizedConfig = JSON.parse(JSON.stringify(duelConfig));
      await setDoc(configRef, sanitizedConfig);
      setStatus({ type: 'success', message: 'Configuration des duels sauvegardée !' });
    } catch (err) {
      console.error("Error saving duel config", err);
      handleFirestoreError(err, OperationType.WRITE, 'global_configs/duel_config');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (uid: string, newRole: UserProfile['role']) => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { role: newRole }, { merge: true });
      setStatus({ type: 'success', message: 'Rôle utilisateur mis à jour !' });
      fetchUsers();
    } catch (err) {
      console.error("Error updating user role", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUserFervorConfig = async () => {
    if (!userFervorConfig) return;
    setLoading(true);
    try {
      const configRef = doc(db, 'global_configs', 'user_fervor');
      const sanitizedConfig = JSON.parse(JSON.stringify(userFervorConfig));
      await setDoc(configRef, sanitizedConfig);
      setStatus({ type: 'success', message: 'Chemin de ferveur global sauvegardé !' });
    } catch (err) {
      console.error("Error saving user fervor config", err);
      handleFirestoreError(err, OperationType.WRITE, 'global_configs/user_fervor');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFanzFervorConfig = async () => {
    if (!fanzFervorConfig) return;
    setLoading(true);
    try {
      const configRef = doc(db, 'global_configs', 'fanz_fervor');
      const sanitizedConfig = JSON.parse(JSON.stringify(fanzFervorConfig));
      await setDoc(configRef, sanitizedConfig);
      setStatus({ type: 'success', message: 'Chemin de ferveur FANZ sauvegardé !' });
    } catch (err) {
      console.error("Error saving fanz fervor config", err);
      handleFirestoreError(err, OperationType.WRITE, 'global_configs/fanz_fervor');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStreakCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCycle) return;
    setLoading(true);
    try {
      const ref = doc(db, 'weekly_streak_cycles', editingCycle.id);
      const sanitizedCycle = JSON.parse(JSON.stringify(editingCycle));
      await setDoc(ref, sanitizedCycle);
      setStatus({ type: 'success', message: 'Cycle sauvegardé !' });
      setEditingCycle(null);
      fetchStreakCycles();
    } catch (err) {
      console.error("Error saving streak cycle", err);
      handleFirestoreError(err, OperationType.WRITE, `weekly_streak_cycles/${editingCycle.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActiveCycle = async (cycleId: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      if (!currentStatus) {
        // Deactivate all other cycles
        streakCycles.forEach(c => {
          if (c.id !== cycleId && c.isActive) {
            batch.update(doc(db, 'weekly_streak_cycles', c.id), { isActive: false });
          }
        });
      }
      
      batch.update(doc(db, 'weekly_streak_cycles', cycleId), { isActive: !currentStatus });
      await batch.commit();
      fetchStreakCycles();
    } catch (err) {
      console.error("Error toggling streak cycle", err);
      handleFirestoreError(err, OperationType.WRITE, `weekly_streak_cycles/${cycleId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStreakCycle = async (cycleId: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'weekly_streak_cycles', cycleId));
      setStatus({ type: 'success', message: 'Cycle supprimé !' });
      fetchStreakCycles();
    } catch (err) {
      console.error("Error deleting streak cycle", err);
      handleFirestoreError(err, OperationType.DELETE, `weekly_streak_cycles/${cycleId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMission) return;
    setLoading(true);
    try {
      const ref = doc(db, 'missions', editingMission.id);
      const sanitizedMission = JSON.parse(JSON.stringify(editingMission));
      await setDoc(ref, sanitizedMission);
      setStatus({ type: 'success', message: 'Mission sauvegardée !' });
      fetchMissions();
      setEditingMission(null);
    } catch (err) {
      console.error("Error saving mission", err);
      handleFirestoreError(err, OperationType.WRITE, `missions/${editingMission.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPass) return;
    setLoading(true);
    try {
      const ref = doc(db, 'passes', editingPass.id);
      const sanitizedPass = JSON.parse(JSON.stringify(editingPass));
      await setDoc(ref, sanitizedPass);
      setStatus({ type: 'success', message: 'Pass sauvegardé !' });
      fetchPasses();
      setEditingPass(null);
    } catch (err) {
      console.error("Error saving pass", err);
      handleFirestoreError(err, OperationType.WRITE, `passes/${editingPass.id}`);
    } finally {
      setLoading(false);
    }
  };

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

  const handleMigrateSkinIds = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Migration des IDs de skins/emotes en cours...' });
    try {
      let fanzFixed = 0;
      let usersFixed = 0;

      // 1. Fix Fanz Templates
      const fanzSnap = await getDocs(collection(db, 'fanz_templates'));
      for (const docSnap of fanzSnap.docs) {
        const data = docSnap.data() as FanzTemplate;
        const templateId = data.id || docSnap.id;
        let changed = false;

        const newSkins = (data.skins || []).map(skin => {
          if (!skin.id.startsWith(`${templateId}_`)) {
            changed = true;
            return { ...skin, id: `${templateId}_${skin.id}` };
          }
          return skin;
        });

        const newEmotes = (data.emotes || []).map(emote => {
          if (!emote.id.startsWith(`${templateId}_`)) {
            changed = true;
            return { ...emote, id: `${templateId}_${emote.id}` };
          }
          return emote;
        });

        if (changed) {
          await updateDoc(doc(db, 'fanz_templates', docSnap.id), {
            skins: newSkins,
            emotes: newEmotes
          });
          fanzFixed++;
        }
      }

      // 2. Fix Users
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const uSnap of usersSnap.docs) {
        const uData = uSnap.data() as UserProfile;
        let changed = false;

        const fixArray = (arr: string[] | undefined | any) => {
          if (!arr || !Array.isArray(arr)) return arr;
          const newArr: string[] = [];
          arr.forEach(item => {
            if (item.startsWith('skin') || item.startsWith('emote')) {
              changed = true;
              // Add for fanz-1 and fanz-2 to be safe since we don't know
              newArr.push(`fanz-1_${item}`);
              newArr.push(`fanz-2_${item}`);
            } else {
              newArr.push(item);
            }
          });
          // Unique Array
          return Array.from(new Set(newArr));
        };

        const newSkins = fixArray(uData.skins);
        const newEmotes = fixArray(uData.emotes);

        if (changed) {
          await updateDoc(doc(db, 'users', uSnap.id), {
            skins: newSkins || [],
            emotes: newEmotes || []
          });
          usersFixed++; 
        }
      }

      setStatus({ type: 'success', message: `Migration OK ! Fanz: ${fanzFixed}, Users: ${usersFixed}` });
      fetchFanzTemplates();
      fetchUsers();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Erreur lors de la migration.' });
      handleFirestoreError(err, OperationType.WRITE, 'multiple');
    } finally {
      setLoading(false);
    }
  };

  const handleFixAllUrls = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Réparation de toutes les URLs...' });
    try {
      let totalFixed = 0;

      const fixUrl = (url: string | undefined): { url: string | undefined, changed: boolean } => {
        if (!url || typeof url !== 'string' || !url.includes('firebasestorage')) return { url, changed: false };
        let newUrl = url;
        let changed = false;

        if (!newUrl.startsWith('gs://')) {
          const regex = /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^\?]+)\?alt=media/;
          if (regex.test(newUrl)) {
            newUrl = newUrl.replace(regex, (_, bucket, path) => {
              return `gs://${bucket}/${decodeURIComponent(path)}`;
            });
            if (newUrl !== url) changed = true;
          }
        }

        if (newUrl.includes('.appspot.com')) {
          newUrl = newUrl.replace('.appspot.com', '.firebasestorage.app');
          changed = true;
        }

        return { url: newUrl, changed };
      };

      const collectionsToFix = [
        { name: 'fanz_templates', imageField: 'image', videoField: 'video' },
        { name: 'fanz', imageField: 'imageUrl', videoField: 'videoUrl' },
        { name: 'cards', imageField: 'imageUrl', videoField: 'videoUrl' },
        { name: 'life_actions', imageField: 'image', videoField: 'videoUrl' },
        { name: 'users', imageField: 'photoURL' },
        { name: 'passes', imageField: 'imageUrl' }
      ];

      for (const coll of collectionsToFix) {
        const snap = await getDocs(collection(db, coll.name));
        let batch = writeBatch(db);
        let count = 0;

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const updated = { ...data };
          let changed = false;

          // Fix main image/video
          if (coll.imageField && updated[coll.imageField]) {
            const res = fixUrl(updated[coll.imageField]);
            if (res.changed) {
              updated[coll.imageField] = res.url;
              changed = true;
            }
          }
          if (coll.videoField && updated[coll.videoField]) {
            const res = fixUrl(updated[coll.videoField]);
            if (res.changed) {
              updated[coll.videoField] = res.url;
              changed = true;
            }
          }

          // Special case for Fanz Templates (skins/emotes)
          if (coll.name === 'fanz_templates') {
            if (Array.isArray(updated.skins)) {
              updated.skins = updated.skins.map((skin: any) => {
                const resImg = fixUrl(skin.imageUrl);
                const resVid = fixUrl(skin.videoUrl);
                if (resImg.changed || resVid.changed) {
                  changed = true;
                  return { ...skin, imageUrl: resImg.url, videoUrl: resVid.url };
                }
                return skin;
              });
            }
            if (Array.isArray(updated.emotes)) {
              updated.emotes = updated.emotes.map((emote: any) => {
                const resImg = fixUrl(emote.imageUrl);
                const resVid = fixUrl(emote.videoUrl);
                if (resImg.changed || resVid.changed) {
                  changed = true;
                  return { ...emote, imageUrl: resImg.url, videoUrl: resVid.url };
                }
                return emote;
              });
            }

            // Fix missing Skin000
            if (updated.image && typeof updated.image === 'string' && updated.image.match(/imageFanz\d{3}\.png$/)) {
              updated.image = updated.image.replace(/imageFanz(\d{3})\.png$/, 'imageFanz$1Skin000.png');
              changed = true;
            }
            if (updated.video && typeof updated.video === 'string' && updated.video.match(/videoFanz\d{3}\.mp4$/)) {
              updated.video = updated.video.replace(/videoFanz(\d{3})\.mp4$/, 'videoFanz$1Skin000.mp4');
              changed = true;
            }
          }

          // Special case for Fanz instances (Skin000)
          if (coll.name === 'fanz') {
            if (updated.imageUrl && typeof updated.imageUrl === 'string' && updated.imageUrl.match(/imageFanz\d{3}\.png$/)) {
              updated.imageUrl = updated.imageUrl.replace(/imageFanz(\d{3})\.png$/, 'imageFanz$1Skin000.png');
              changed = true;
            }
            if (updated.videoUrl && typeof updated.videoUrl === 'string' && updated.videoUrl.match(/videoFanz\d{3}\.mp4$/)) {
              updated.videoUrl = updated.videoUrl.replace(/videoFanz(\d{3})\.mp4$/, 'videoFanz$1Skin000.mp4');
              changed = true;
            }
          }

          if (changed) {
            batch.update(docSnap.ref, updated);
            count++;
            totalFixed++;
            if (count >= 450) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }

      setStatus({ type: 'success', message: `${totalFixed} URLs ont été réparées !` });
      fetchFanzTemplates();
      fetchDuelCards();
      fetchLifeActions();
    } catch (err) {
      console.error("Error fixing URLs", err);
      setStatus({ type: 'error', message: 'Erreur lors de la réparation des URLs.' });
      handleFirestoreError(err, OperationType.WRITE, 'multiple');
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
      
      // Generate the Ferveur path based on specific config if it exists
      if (editingFanz.ferveurConfig && editingFanz.ferveurConfig.ranges && editingFanz.ferveurConfig.ranges.length > 0) {
        const lastRange = editingFanz.ferveurConfig.ranges[editingFanz.ferveurConfig.ranges.length - 1];
        editingFanz.ferveurPath = generateFervorPath(lastRange.max || 150000, editingFanz.ferveurConfig);
      } else if (!editingFanz.ferveurPath || editingFanz.ferveurPath.length === 0) {
        // Fallback to global if both are missing
        if (fanzFervorConfig) {
          const defaultPath = generateFervorPath(fanzFervorConfig.ranges?.[fanzFervorConfig.ranges.length - 1]?.max || 150000, fanzFervorConfig);
          editingFanz.ferveurPath = defaultPath;
        }
      }

      // Remove undefined values which Firestore rejects
      const sanitizedFanz = JSON.parse(JSON.stringify(editingFanz));
      await setDoc(fanzRef, sanitizedFanz);
      setStatus({ type: 'success', message: 'FANZ sauvegardé avec succès !' });
      fetchFanzTemplates();
      setEditingFanz(null);
    } catch (err) {
      console.error("Error saving fanz template", err);
      handleFirestoreError(err, OperationType.WRITE, `fanz_templates/${editingFanz.id}`);
      setStatus({ type: 'error', message: `Erreur: ${err instanceof Error ? err.message : String(err)}` });
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

  const handleFixFerveurPaths = async () => {
    if (!fanzFervorConfig) {
      setStatus({ type: 'error', message: 'Configuration globale de la ferveur FANZ non trouvée.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Mise à jour de tous les chemins de ferveur...' });
    try {
      const defaultPath = generateFervorPath(fanzFervorConfig.ranges?.[fanzFervorConfig.ranges.length - 1]?.max || 150000, fanzFervorConfig);

      let templatesUpdated = 0;
      let instancesUpdated = 0;
      let usersUpdated = 0;
      
      // Update fanz_templates
      const templatesSnapshot = await getDocs(collection(db, 'fanz_templates'));
      let batch = writeBatch(db);
      let opsCount = 0;
      
      const templatePathsMap: Record<string, FerveurLevel[]> = {};
      
      for (const docSnap of templatesSnapshot.docs) {
        const tData = docSnap.data() as FanzTemplate;
        let specificPath = defaultPath;
        if (tData.ferveurConfig && tData.ferveurConfig.ranges && tData.ferveurConfig.ranges.length > 0) {
           const max = tData.ferveurConfig.ranges[tData.ferveurConfig.ranges.length - 1].max || 150000;
           specificPath = generateFervorPath(max, tData.ferveurConfig);
        }
        templatePathsMap[docSnap.id] = specificPath;

        batch.update(docSnap.ref, { ferveurPath: specificPath });
        templatesUpdated++;
        opsCount++;
        if (opsCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opsCount = 0;
        }
      }

      // Update fanz instances
      const fanzSnapshot = await getDocs(collection(db, 'fanz'));
      for (const docSnap of fanzSnapshot.docs) {
        const data = docSnap.data();
        const pts = data.ferveurPoints || 0;
        const assignedPath = templatePathsMap[data.templateId] || defaultPath;
        
        let newLevel = 1;
        const majorLevels = assignedPath.filter(l => !l.isIntermediate).sort((a, b) => a.pointsRequired - b.pointsRequired);
        for (const ml of majorLevels) {
          if (pts >= ml.pointsRequired) {
            newLevel = ml.level;
          }
        }

        batch.update(docSnap.ref, { 
          ferveurPath: assignedPath,
          ferveurLevel: newLevel
        });
        instancesUpdated++;
        opsCount++;
        if (opsCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opsCount = 0;
        }
      }

      if (opsCount > 0) {
        await batch.commit();
      }

      // Update users level
      batch = writeBatch(db);
      opsCount = 0;
      const usersSnapshot = await getDocs(collection(db, 'users'));
      for (const docSnap of usersSnapshot.docs) {
        const data = docSnap.data();
        const pts = data.ferveurPoints || 0;
        
        let newLevel = 1;
        for (const range of (userFervorConfig?.ranges || [])) {
          if (pts >= range.min) {
            newLevel = range.level;
          }
        }
        if (pts >= 15000000) newLevel = 15;

        batch.update(docSnap.ref, { 
          level: newLevel
        });
        usersUpdated++;
        opsCount++;
        if (opsCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opsCount = 0;
        }
      }

      if (opsCount > 0) {
        await batch.commit();
      }

      setStatus({ type: 'success', message: `${templatesUpdated} modèles, ${instancesUpdated} items et ${usersUpdated} joueurs mis à jour !` });
      fetchFanzTemplates();
      fetchUserFervorConfig();
    } catch (err: any) {
      console.error("Error fixing ferveur paths", err);
      // Suppress handleFirestoreError throwing to show message in UI
      setStatus({ type: 'error', message: `Erreur lors de la mise à jour: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewFanz = () => {
    const newId = `fanz-${Date.now()}`;
    
    setEditingFanz({
      id: newId,
      name: 'Nouveau FANZ',
      shortDescription: 'Nouvel ami du stade !',
      longDescription: 'Un supporter passionné prêt à tout pour son équipe.',
      battleCry: 'ALLEZ !',
      sport: 'soccer',
      rarity: 'common',
      image: '',
      description: 'Description du FANZ...',
      baseExcitement: 5,
      baseStats: {
        force: 1, endurance: 1, mental: 1, bluff: 1,
        creativity: 1, social: 1, intelligence: 1, charisma: 1
      },
      specialCards: [],
      specialAttackIds: ['', '', ''],
      lifeActionIds: {
        force: '', endurance: '', mental: '', bluff: '',
        creativity: '', social: '', intelligence: '', charisma: ''
      },
      skins: Array.from({ length: 11 }, (_, i) => ({
        id: `${newId}-skin${String(i).padStart(3, '0')}`,
        fanzId: newId,
        name: i === 0 ? 'Principal (Skin000)' : `Skin Débloquable ${i}`,
        imageUrl: '',
        price: i === 0 ? {} : { gems: 100 }
      })),
      emotes: [],
      ferveurConfig: undefined, // Will default to global when saved
      rankRewards: {}
    } as any);
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
      const sanitizedCard = JSON.parse(JSON.stringify(editingCard));
      await setDoc(cardRef, sanitizedCard);
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
      energyCost: 5,
      fervorValue: 0,
      description: 'Description de la carte...',
      effects: [],
      imageUrl: '',
      videoUrl: '',
      fanzIds: filterCardFanz !== 'all' && filterCardFanz !== 'generic' ? [filterCardFanz] : []
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
      const sanitizedAction = JSON.parse(JSON.stringify(editingAction));
      await setDoc(actionRef, sanitizedAction);
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
      fanzTemplateId: filterLifeActionFanz !== 'all' && filterLifeActionFanz !== 'generic' ? filterLifeActionFanz : '',
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
      
      // Fetch existing leagues from Firestore to preserve isActive status
      const firestoreLeaguesSnapshot = await getDocs(collection(db, 'leagues'));
      const firestoreLeagues = new Map();
      firestoreLeaguesSnapshot.forEach(doc => {
        firestoreLeagues.set(doc.id, doc.data());
      });

      const mergedData = data.map((item: any) => {
        const firestoreData = firestoreLeagues.get(item.league.id.toString());
        if (firestoreData && firestoreData.isActive !== undefined) {
          return {
            ...item,
            league: {
              ...item.league,
              isActive: firestoreData.isActive
            }
          };
        }
        return item;
      });

      // If manual ID, add to list if not already there
      if (manualLeagueId) {
        setLeagues(prev => {
          const exists = prev.some(l => l.league.id === mergedData[0].league.id);
          return exists ? prev : [...prev, ...mergedData];
        });
      } else {
        setLeagues(mergedData);
      }
      
      const batch = writeBatch(db);
      for (const item of mergedData) {
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
        }, { merge: true });
      }
      await batch.commit();
      setStatus({ type: 'success', message: `${data.length} compétition(s) récupérée(s) (à activer pour les rendre visibles).` });
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

  const handleToggleCompetition = async (leagueId: number, currentStatus: boolean, leagueName: string) => {
    if (!currentStatus) {
      // Trying to activate -> open modal instead
      setLeagueActivationPrompt({ id: leagueId, name: leagueName });
      return;
    }
    // Deactivating
    handleConfirmLeagueActivation(leagueId, leagueName, false, 'none');
  };

  const handleConfirmLeagueActivation = async (leagueId: number, leagueName: string, newStatus: boolean, createType: 'mission' | 'pass' | 'none') => {
    setLeagueActivationPrompt(null);
    setLoading(true);
    setStatus({ type: 'info', message: `${newStatus ? 'Activation' : 'Désactivation'} de la compétition ${leagueName}...` });
    try {
      const leagueRef = doc(db, 'leagues', leagueId.toString());
      await setDoc(leagueRef, { isActive: newStatus }, { merge: true });
      
      setLeagues(prev => prev.map(l => {
        if (l.league.id === leagueId) {
          return { ...l, league: { ...l.league, isActive: newStatus } };
        }
        return l;
      }));

      setStatus({ type: 'success', message: `Compétition ${leagueId} ${newStatus ? 'activée' : 'désactivée'}.` });
      
      if (newStatus) {
         if (createType === 'mission') {
           setActiveTab('users');
           setActiveUserSubTab('missions');
           setEditingMission({
             id: `mission-${Date.now()}`,
             title: `Jouer dans ${leagueName}`,
             description: `Fais 1 duel dans la compétition: ${leagueName}`,
             type: 'duel_count',
             target: 1,
             reward: { type: 'money', amount: 100 },
             isActive: true,
             period: 'one_shot',
             conditionType: 'league',
             conditionValue: leagueId.toString(),
           });
         } else if (createType === 'pass') {
           setActiveTab('users');
           setActiveUserSubTab('passes');
           setEditingPass({
             id: `pass-${Date.now()}`,
             name: `Pass ${leagueName}`,
             description: `Gagne des points sur les matchs de ${leagueName}...`,
             priceGems: 500,
             startDate: new Date().toISOString(),
             endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
             premiumPrice: { gems: 500 },
             levels: Array.from({ length: 5 }, (_, i) => ({
               level: i + 1,
               pointsRequired: (i + 1) * 100,
               freeReward: { type: 'money', amount: 50 },
               premiumReward: { type: 'gems', amount: 20 }
             })),
             isActive: true,
             conditionType: 'league',
             conditionValue: leagueId.toString(),
           });
         }
      }
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: `Erreur: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

    const handleDisableAllLeagues = async () => {
    // Disable all without prompt window.confirm since it's blocked in iframe
    setLoading(true);
    setStatus({ type: 'info', message: 'Désactivation de toutes les compétitions...' });
    try {
      // We will disable ALL leagues directly from Firestore to ensure everything is disabled
      const leaguesSnap = await getDocs(collection(db, 'leagues'));
      let batch = writeBatch(db);
      let opsCount = 0;
      let totalDisabled = 0;
      
      for (const docSnap of leaguesSnap.docs) {
        if (docSnap.data().isActive === true) {
          batch.update(docSnap.ref, { isActive: false });
          opsCount++;
          totalDisabled++;
        }
        
        if (opsCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opsCount = 0;
        }
      }
      
      if (opsCount > 0) {
        await batch.commit();
      }
      
      // Update local state
      setLeagues(prev => prev.map(l => ({ ...l, league: { ...l.league, isActive: false } })));
      setStatus({ type: 'success', message: `${totalDisabled} compétitions ont été désactivées avec succès.` });
    } catch (error: any) {
      console.error("Error in handleDisableAllLeagues:", error);
      setStatus({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateOngoingLeagues = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: "Recherche et activation des compétitions en cours..." });
    let activatedCount = 0;
    try {
      let batch = writeBatch(db);
      let opsCount = 0;
      
      const newLeagues = [...leagues];
      
      for (let i = 0; i < leagues.length; i++) {
        const item = leagues[i];
        if (item.league.isActive) continue; // Skip already active
        
        const seasonInfo = item.seasons?.find((s: any) => s.year === selectedSeason);
        if (!seasonInfo) continue;
        
        const now = new Date();
        const start = new Date(seasonInfo.start);
        const end = new Date(seasonInfo.end);
        
        if (now >= start && now <= end) { // Ongoing
          const leagueRef = doc(db, 'leagues', item.league.id.toString());
          batch.set(leagueRef, { isActive: true }, { merge: true });
          newLeagues[i] = { ...item, league: { ...item.league, isActive: true } };
          activatedCount++;
          opsCount++;
          
          const missionId = `mission-comp-${item.league.id}`;
          const passId = `pass-comp-${item.league.id}`;
          
          // Mission
          batch.set(doc(db, 'missions', missionId), {
            id: missionId,
            title: `Mission ${item.league.name}`,
            description: `Gagnez des matchs de la compétition ${item.league.name}`,
            type: 'duel',
            target: 10,
            reward: { type: 'money', amount: 500 },
            isActive: true,
            period: 'one_shot'
          });
          opsCount++;

          // Pass
          batch.set(doc(db, 'passes', passId), {
            id: passId,
            name: `Pass ${item.league.name}`,
            description: `Récompenses exclusives pour la compétition ${item.league.name}`,
            imageUrl: '',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            levels: [
              { level: 1, pointsRequired: 100, freeReward: { type: 'money', amount: 100 } },
              { level: 2, pointsRequired: 200, freeReward: { type: 'gems', amount: 10 } }
            ],
            priceGems: 100,
            isActive: true,
            premiumPrice: { money: 1000 },
            conditionType: 'league',
            conditionValue: item.league.id.toString()
          });
          opsCount++;

          if (opsCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            opsCount = 0;
          }
        }
      }
      
      if (opsCount > 0) {
        await batch.commit();
      }
      
      setLeagues(newLeagues);
      setStatus({ type: 'success', message: `${activatedCount} compétitions activées avec succès.` });

    } catch(err) {
      console.error(err);
      setStatus({ type: 'error', message: "Erreur lors de l'activation des compétitions." });
    } finally {
      setLoading(false);
    }
  };

  const handleClearTransactions = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Suppression des transactions...' });
    try {
      const txSnap = await getDocs(collection(db, 'transactions'));
      let batch = writeBatch(db);
      let count = 0;
      let totalDeleted = 0;
      
      for (const docSnap of txSnap.docs) {
        batch.delete(docSnap.ref);
        count++;
        totalDeleted++;
        
        if (count === 490) { // Keep under the 500 limit
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }
      
      setStatus({ type: 'success', message: `${totalDeleted} transactions supprimées.` });
    } catch (error) {
      console.error("Error clearing transactions:", error);
      setStatus({ type: 'error', message: "Erreur lors de la suppression." });
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateRankings = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Recalcul des classements en cours...' });
    try {
      let fixturesSnap;
      try {
        fixturesSnap = await getDocs(collection(db, 'fixture_results'));
      } catch(e) {
        throw new Error('Error fetching fixture_results: ' + (e as Error).message);
      }
      
      const teamStats: Record<string, { totalScore: number, matches: number }> = {};
      const userStats: Record<string, { totalScore: number, matches: number }> = {};
      
      fixturesSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.type === 'training') return; // Do not include trainings in rankings
        
        const season = data.season || new Date().getFullYear().toString();
        const leagueId = data.leagueId || 'global';
        
        const seasons = [season];
        const currentYear = new Date().getFullYear().toString();
        if (season !== currentYear) seasons.push(currentYear);
        
        const teamAId = data.teamHome?.id?.toString();
        const scoreA = Number(data.teamHome?.score) || 0;
        const teamBId = data.teamAway?.id?.toString();
        const scoreB = Number(data.teamAway?.score) || 0;
        
        const activeSeasons = Array.from(new Set(seasons));

        for (const s of activeSeasons) {
          if (teamAId) {
            const keyGlobal = `${teamAId}_${s}_global`.replace(/\//g, '-');
            if (!teamStats[keyGlobal]) teamStats[keyGlobal] = { totalScore: 0, matches: 0 };
            teamStats[keyGlobal].totalScore += scoreA;
            teamStats[keyGlobal].matches += 1;
            
            if (leagueId !== 'global') {
              const keyLeague = `${teamAId}_${s}_${leagueId}`.replace(/\//g, '-');
              if (!teamStats[keyLeague]) teamStats[keyLeague] = { totalScore: 0, matches: 0 };
              teamStats[keyLeague].totalScore += scoreA;
              teamStats[keyLeague].matches += 1;
            }
          }
          if (teamBId) {
            const keyGlobal = `${teamBId}_${s}_global`.replace(/\//g, '-');
            if (!teamStats[keyGlobal]) teamStats[keyGlobal] = { totalScore: 0, matches: 0 };
            teamStats[keyGlobal].totalScore += scoreB;
            teamStats[keyGlobal].matches += 1;
            
            if (leagueId !== 'global') {
              const keyLeague = `${teamBId}_${s}_${leagueId}`.replace(/\//g, '-');
              if (!teamStats[keyLeague]) teamStats[keyLeague] = { totalScore: 0, matches: 0 };
              teamStats[keyLeague].totalScore += scoreB;
              teamStats[keyLeague].matches += 1;
            }
          }
        }
        
        if (data.users && typeof data.users === 'object') {
          Object.keys(data.users).forEach(uid => {
            const uData = data.users[uid];
            const uScore = Number(uData.score) || 0;
            
            for (const s of activeSeasons) {
              const keyGlobal = `${uid}_${s}_global`.replace(/\//g, '-');
              if (!userStats[keyGlobal]) userStats[keyGlobal] = { totalScore: 0, matches: 0 };
              userStats[keyGlobal].totalScore += uScore;
              userStats[keyGlobal].matches += 1;
              
              if (leagueId !== 'global') {
                const keyLeague = `${uid}_${s}_${leagueId}`.replace(/\//g, '-');
                if (!userStats[keyLeague]) userStats[keyLeague] = { totalScore: 0, matches: 0 };
                userStats[keyLeague].totalScore += uScore;
                userStats[keyLeague].matches += 1;
              }
            }
          });
        }
      });
      
      const { setDoc } = await import('firebase/firestore');
      
      let teamUpdateCount = 0;
      for (const key of Object.keys(teamStats)) {
        const parts = key.split('_');
        if (parts.length < 3) continue;
        const leagueIdStr = parts.pop()!;
        const season = parts.pop()!;
        const entityId = parts.join('_');
        
        const stats = teamStats[key];
        try {
          await setDoc(doc(db, 'ranking_teams', key), {
            teamId: entityId,
            season,
            leagueId: leagueIdStr,
            totalScore: stats.totalScore,
            matches: stats.matches,
            averageScore: stats.matches > 0 ? stats.totalScore / stats.matches : 0,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch(e) {
          throw new Error(`Error writing ranking_teams (key: ${key}): ` + (e as Error).message);
        }
        teamUpdateCount++;
      }

      let userUpdateCount = 0;
      for (const key of Object.keys(userStats)) {
        const parts = key.split('_');
        if (parts.length < 3) continue;
        const leagueIdStr = parts.pop()!;
        const season = parts.pop()!;
        const entityId = parts.join('_');
        
        const stats = userStats[key];
        try {
          await setDoc(doc(db, 'ranking_users', key), {
            userId: entityId,
            season,
            leagueId: leagueIdStr,
            totalScore: stats.totalScore,
            matches: stats.matches,
            averageScore: stats.matches > 0 ? stats.totalScore / stats.matches : 0,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch(e) {
          throw new Error(`Error writing ranking_users (key: ${key}): ` + (e as Error).message);
        }
        userUpdateCount++;
      }
      
      setStatus({ type: 'success', message: `Classements recalculés ! Équipes: ${teamUpdateCount}, Users: ${userUpdateCount}` });
    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', message: e.message || 'Erreur lors du recalcul.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetAllRankings = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Suppression globale en cours...' });
    try {
      const deleteCollection = async (collectionName: string) => {
        let count = 0;
        try {
          const querySnapshot = await getDocs(collection(db, collectionName));
          if (!querySnapshot.empty) {
            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => {
              batch.delete(docSnap.ref);
              count++;
            });
            await batch.commit();
          }
        } catch(e) {
          console.warn(`Could not delete ${collectionName}`, e);
        }
        return count;
      };

      const deletedScores = await deleteCollection('match_scores');
      const deletedTeams = await deleteCollection('ranking_teams');
      const deletedUsers = await deleteCollection('ranking_users');
      // On conserve fixture_results si l'historique doit rester, ou on le supprime si c'est vraiment du fully blank
      // The user wants to reset match_score, ranking_teams, and ranking_users
      // If we also delete fixture_results, they won't be able to just "recalculate" without playing new matches.
      // We will also clear duels and active_duels.
      const deletedActiveDuels = await deleteCollection('active_duels');
      const deletedDuels = await deleteCollection('duels');

      setStatus({ 
        type: 'success', 
        message: `Remise à zéro OK ! ${deletedScores} match_scores, ${deletedTeams} ranking_teams, ${deletedUsers} ranking_users, ${deletedActiveDuels} active_duels supprimés.`
      });
    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', message: e.message || 'Erreur lors de la remise à zéro.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueSort = (column: string) => {
    setLeagueSort(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' };
    });
  };

  const getSeasonStatusValue = (item: any, selectedSeason: number) => {
    const seasonInfo = item.seasons?.find((s: any) => s.year === selectedSeason);
    if (!seasonInfo) return 4;
    const now = new Date();
    const start = new Date(seasonInfo.start);
    const end = new Date(seasonInfo.end);
    if (now < start) return 2;
    if (now > end) return 3;
    return 1;
  };

  const filteredLeagues = leagues
    .filter(l => l.league.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.country.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      let valA, valB;
      switch (leagueSort.column) {
        case 'id': valA = a.league.id; valB = b.league.id; break;
        case 'name': valA = a.league.name; valB = b.league.name; break;
        case 'country': valA = a.country.name; valB = b.country.name; break;
        case 'season': valA = getSeasonStatusValue(a, selectedSeason); valB = getSeasonStatusValue(b, selectedSeason); break;
        case 'status': valA = a.league.isActive ? 1 : 0; valB = b.league.isActive ? 1 : 0; break;
        default: valA = a.country.name; valB = b.country.name; break;
      }
      if (valA < valB) return leagueSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return leagueSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="p-6 w-full mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-500" />
          Zone Admin
        </h1>
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 3000);
              } else {
                setConfirmReset(false);
                handleResetAllRankings();
              }
            }} 
            variant={confirmReset ? "destructive" : "outline"} 
            className={`flex items-center gap-2 ${!confirmReset && "text-red-500 border-red-500 hover:bg-red-50"}`}
            disabled={loading}
          >
            {confirmReset ? "Confirmer la suppression ?" : "Effacer Classements & Duels"}
          </Button>

          <Button 
            onClick={handleClearTransactions} 
            variant="outline" 
            className="flex items-center gap-2 text-red-500 border-red-500 hover:bg-red-50"
            disabled={loading}
          >
            <Trash2 className="w-4 h-4" />
            Vider Transactions
          </Button>

          <Button 
            onClick={() => {
              if (!confirmRecalculate) {
                setConfirmRecalculate(true);
                setTimeout(() => setConfirmRecalculate(false), 3000);
              } else {
                setConfirmRecalculate(false);
                handleRecalculateRankings();
              }
            }} 
            variant={confirmRecalculate ? "destructive" : "secondary"} 
            className="flex items-center gap-2" 
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {confirmRecalculate ? "Confirmer le recalcul ?" : "Recalculer Classements"}
          </Button>
        </div>
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
        <button
          className={`pb-2 px-4 font-bold ${activeTab === 'users' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('users')}
        >
          Zone UTILISATEURS
        </button>
        <button
          className={`pb-2 px-4 font-bold ${activeTab === 'duelConfig' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('duelConfig')}
        >
          Config DUEL
        </button>
        <button
          className={`pb-2 px-4 font-bold ${activeTab === 'shop' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('shop')}
        >
          BOUTIQUE 
        </button>
      </div>

      {status && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border animate-in fade-in slide-in-from-top-4 duration-300 ${
          status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
          status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
          'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
           status.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
           <RefreshCw className="w-5 h-5 animate-spin" />}
          <p className="font-bold">{status.message}</p>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-gray-200 mb-6">
            <button
              className={`pb-2 px-4 font-bold text-sm ${activeUserSubTab === 'profiles' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveUserSubTab('profiles')}
            >
              Profils & Rôles
            </button>
            <button
              className={`pb-2 px-4 font-bold text-sm ${activeUserSubTab === 'fervor' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveUserSubTab('fervor')}
            >
              Chemin Ferveur Global
            </button>
            <button
              className={`pb-2 px-4 font-bold text-sm ${activeUserSubTab === 'streak' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveUserSubTab('streak')}
            >
              Série Hebdo
            </button>
            <button
              className={`pb-2 px-4 font-bold text-sm ${activeUserSubTab === 'missions' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveUserSubTab('missions')}
            >
              Missions
            </button>
            <button
              className={`pb-2 px-4 font-bold text-sm ${activeUserSubTab === 'passes' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveUserSubTab('passes')}
            >
              Passes
            </button>
          </div>

          {activeUserSubTab === 'profiles' && (
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Gestion des Utilisateurs</h3>
                  <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px]">Utilisateur</th>
                        <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px]">Email</th>
                        <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px]">Rôle</th>
                        <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px]">Points Ferveur</th>
                        <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.uid} className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                                {(user.pseudo || user.displayName || 'U').charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-white">{user.pseudo || 'Utilisateur'}</span>
                                {user.displayName && <span className="text-[10px] text-gray-400">{user.displayName}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{user.email}</td>
                          <td className="py-3 px-4">
                            <select
                              value={user.role || 'client'}
                              onChange={(e) => handleUpdateUserRole(user.uid, e.target.value as any)}
                              className="p-1.5 bg-gray-800 rounded text-xs font-bold border border-gray-700 text-white"
                            >
                              <option value="client">Client</option>
                              <option value="moderator">Modérateur</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-white">{user.ferveurPoints || 0}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-gray-500 italic">À venir</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}

          {activeUserSubTab === 'fervor' && userFervorConfig && (
            <Card className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Chemin de Ferveur Global</h3>
                <div className="flex gap-2">
                  <Button onClick={handleSaveUserFervorConfig} disabled={loading}>
                    <Save className="w-4 h-4 mr-2" /> Sauvegarder
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userFervorConfig.ranges?.map((range, idx) => (
                  <div key={idx} className="p-4 rounded-xl border bg-gray-900/50 border-blue-900/50 space-y-3 relative">
                    <button 
                      onClick={() => {
                        const newRanges = userFervorConfig.ranges.filter((_, i) => i !== idx);
                        // Re-number levels
                        newRanges.forEach((r, i) => r.level = i + 1);
                        setUserFervorConfig({ ...userFervorConfig, ranges: newRanges });
                      }}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-blue-400">
                        NIVEAU {range.level}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500">Min</label>
                        <input
                          type="number"
                          value={range.min}
                          onChange={(e) => {
                            const newRanges = [...userFervorConfig.ranges];
                            newRanges[idx] = { ...range, min: Number(e.target.value) };
                            setUserFervorConfig({ ...userFervorConfig, ranges: newRanges });
                          }}
                          className="w-full bg-black/50 border border-white/10 rounded p-1 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500">Max</label>
                        <input
                          type="number"
                          value={range.max}
                          onChange={(e) => {
                            const newRanges = [...userFervorConfig.ranges];
                            newRanges[idx] = { ...range, max: Number(e.target.value) };
                            setUserFervorConfig({ ...userFervorConfig, ranges: newRanges });
                          }}
                          className="w-full bg-black/50 border border-white/10 rounded p-1 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500">Pas</label>
                        <input
                          type="number"
                          value={range.step}
                          onChange={(e) => {
                            const newRanges = [...userFervorConfig.ranges];
                            newRanges[idx] = { ...range, step: Number(e.target.value) };
                            setUserFervorConfig({ ...userFervorConfig, ranges: newRanges });
                          }}
                          className="w-full bg-black/50 border border-white/10 rounded p-1 text-sm text-white"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 mt-4">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Récompense de Niveau</label>
                      <RewardSelector
                        reward={range.levelReward}
                        onChange={(reward: any) => {
                          const newRanges = [...userFervorConfig.ranges];
                          newRanges[idx] = { ...range, levelReward: reward };
                          setUserFervorConfig({ ...userFervorConfig, ranges: newRanges });
                        }}
                        fanzTemplates={fanzTemplates}
                        lifeActions={lifeActions}
                        duelCards={duelCards}
                      />
                    </div>

                    <div className="space-y-2 mt-4 pt-4 border-t border-gray-800">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Gain Intermédiaire</label>
                      <RewardSelector
                        reward={range.intermediateReward}
                        onChange={(reward: any) => {
                          const newRanges = [...userFervorConfig.ranges];
                          newRanges[idx] = { ...range, intermediateReward: reward };
                          setUserFervorConfig({ ...userFervorConfig, ranges: newRanges });
                        }}
                        fanzTemplates={fanzTemplates}
                        lifeActions={lifeActions}
                        duelCards={duelCards}
                      />
                    </div>
                  </div>
                ))}
                
                <div 
                  className="p-4 rounded-xl border border-dashed border-gray-700 bg-gray-900/20 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900/50 hover:border-blue-500/50 transition-colors min-h-[200px]"
                  onClick={() => {
                    const lastRange = userFervorConfig.ranges[userFervorConfig.ranges.length - 1];
                    const newLevel = (lastRange?.level || 0) + 1;
                    const newMin = (lastRange?.max || 0) + 1;
                    const newMax = newMin + 9999;
                    const newStep = lastRange?.step || 100;
                    setUserFervorConfig({
                      ...userFervorConfig,
                      ranges: [
                        ...userFervorConfig.ranges,
                        {
                          level: newLevel,
                          min: newMin,
                          max: newMax,
                          step: newStep,
                          levelReward: { type: 'money', amount: 1000 },
                          intermediateReward: { type: 'money', amount: 50 }
                        }
                      ]
                    });
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                    <span className="text-2xl text-blue-400">+</span>
                  </div>
                  <span className="font-bold text-gray-400">Ajouter un Niveau</span>
                </div>
              </div>
            </Card>
          )}

          {activeUserSubTab === 'streak' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Série Hebdomadaire (Cycles)</h3>
                <Button onClick={() => {
                  const newCycle: WeeklyStreakCycle = {
                    id: `cycle-${Date.now()}`,
                    name: 'Nouveau Cycle',
                    isActive: false,
                    days: Array.from({ length: 7 }, (_, i) => ({
                      day: i + 1,
                      reward: { type: 'money', amount: 100 }
                    }))
                  };
                  setEditingCycle(newCycle);
                }}>
                  <Plus className="w-4 h-4 mr-2" /> Nouveau Cycle
                </Button>
              </div>

              {editingCycle && (
                <Card className="p-6">
                  <form onSubmit={handleSaveStreakCycle} className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-lg font-bold text-orange-500">
                        {editingCycle.id.startsWith('cycle-') ? 'Créer un cycle' : 'Modifier le cycle'}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="secondary" onClick={() => setEditingCycle(null)}>Annuler</Button>
                        <Button type="submit" disabled={loading}>
                          <Save className="w-4 h-4 mr-2" /> Sauvegarder
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nom du cycle</label>
                        <input
                          type="text"
                          value={editingCycle.name}
                          onChange={e => setEditingCycle({...editingCycle, name: e.target.value})}
                          className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 text-white"
                          required
                        />
                      </div>
                      <div className="space-y-2 flex items-center pt-8">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingCycle.isActive}
                            onChange={e => setEditingCycle({...editingCycle, isActive: e.target.checked})}
                            className="w-5 h-5 rounded border-gray-700 text-orange-500 focus:ring-orange-500 bg-gray-800"
                          />
                          <span className="text-sm font-medium">Cycle Actif</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="font-bold text-gray-300">Récompenses (7 Jours)</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(editingCycle.days || []).map((config, idx) => (
                          <div key={config.day} className="p-4 bg-gray-900/50 rounded-xl border border-gray-800 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="font-black text-orange-500">JOUR {config.day}</span>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase text-gray-500">Récompense</label>
                              <RewardSelector
                                reward={config.reward}
                                onChange={reward => {
                                  const newDays = [...(editingCycle.days || [])];
                                  newDays[idx] = { ...config, reward };
                                  setEditingCycle({ ...editingCycle, days: newDays });
                                }}
                                fanzTemplates={fanzTemplates}
                                lifeActions={lifeActions}
                                duelCards={duelCards}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-4">
                {streakCycles.map(cycle => (
                  <Card key={cycle.id} className={`p-4 ${cycle.isActive ? 'border-orange-500/50 bg-orange-500/5' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${cycle.isActive ? 'bg-orange-500/20 text-orange-500' : 'bg-gray-800 text-gray-400'}`}>
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white flex items-center gap-2">
                            {cycle.name}
                            {cycle.isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500 text-[10px] uppercase tracking-wider">
                                Actif
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-400">7 jours configurés</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          variant={cycle.isActive ? "secondary" : "primary"}
                          onClick={() => handleToggleActiveCycle(cycle.id, cycle.isActive)}
                        >
                          {cycle.isActive ? 'Désactiver' : 'Activer'}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingCycle(cycle)}>
                          Modifier
                        </Button>
                        <Button variant="outline" className="text-red-500 border-red-500/50 hover:bg-red-500/10" onClick={() => handleDeleteStreakCycle(cycle.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                {streakCycles.length === 0 && (
                  <div className="text-center py-12 bg-gray-900/50 rounded-xl border border-gray-800">
                    <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Aucun cycle configuré</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeUserSubTab === 'missions' && (
            <AdminMissionsTable 
              missions={missions} 
              onRefresh={fetchMissions} 
            />
          )}

          {activeUserSubTab === 'passes' && (
            <div className="space-y-6">
              {editingPass && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
                    <Card className="p-6 relative max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-gray-900 border-white/10 shadow-2xl">
                      <Button variant="outline" size="sm" className="absolute top-4 right-4" onClick={() => setEditingPass(null)}>Fermer</Button>
                      <h3 className="text-xl font-bold mb-4">Éditer les niveaux : {editingPass.name}</h3>
                      <form onSubmit={(e) => { e.preventDefault(); handleSavePass(e as any); }} className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="font-bold text-sm border-b border-gray-800 pb-2 text-white">Niveaux & Récompenses</h4>
                          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {(editingPass.levels || []).map((lvl, idx) => (
                              <div key={idx} className="grid grid-cols-1 md:grid-cols-[100px_1fr_1fr_auto] gap-4 items-end p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-500">NIVEAU {lvl.level}</label>
                                  <input
                                    type="number"
                                    value={lvl.pointsRequired}
                                    onChange={e => {
                                      const newLevels = [...(editingPass.levels || [])];
                                      newLevels[idx] = { ...lvl, pointsRequired: Number(e.target.value) };
                                      setEditingPass({ ...editingPass, levels: newLevels });
                                    }}
                                    className="w-full p-2 bg-black text-white rounded border border-gray-600 text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-500">RECOMPENSE GRATUITE</label>
                                  <RewardSelector
                                    reward={lvl.freeReward}
                                    onChange={reward => {
                                      const newLevels = [...editingPass.levels];
                                      newLevels[idx] = { ...lvl, freeReward: reward };
                                      setEditingPass({ ...editingPass, levels: newLevels });
                                    }}
                                    fanzTemplates={fanzTemplates}
                                    lifeActions={lifeActions}
                                    duelCards={duelCards}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-500">RECOMPENSE PREMIUM</label>
                                  <RewardSelector
                                    reward={lvl.premiumReward}
                                    onChange={reward => {
                                      const newLevels = [...editingPass.levels];
                                      newLevels[idx] = { ...lvl, premiumReward: reward };
                                      setEditingPass({ ...editingPass, levels: newLevels });
                                    }}
                                    fanzTemplates={fanzTemplates}
                                    lifeActions={lifeActions}
                                    duelCards={duelCards}
                                  />
                                </div>
                                <Button type="button" variant="outline" size="sm" className="text-red-400 border-red-900 hover:bg-red-900/30 hover:text-white" onClick={() => {
                                  let newLevels = (editingPass.levels || []).filter((_, i) => i !== idx);
                                  newLevels = newLevels.map((l, i) => ({ ...l, level: i + 1 }));
                                  setEditingPass({ ...editingPass, levels: newLevels });
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => {
                              let nextLevelNum = 1;
                              if ((editingPass.levels || []).length > 0) {
                                nextLevelNum = Math.max(...(editingPass.levels || []).map(l => l.level)) + 1;
                              }
                              const lastPoints = (editingPass.levels || [])[(editingPass.levels || []).length - 1]?.pointsRequired || 0;
                              setEditingPass({
                                ...editingPass,
                                levels: [...(editingPass.levels || []), {
                                  level: nextLevelNum,
                                  pointsRequired: lastPoints + 100,
                                  freeReward: { type: 'money', amount: 50 },
                                  premiumReward: { type: 'gems', amount: 20 }
                                }]
                              });
                            }}>
                              <Plus className="w-4 h-4 mr-2" /> Ajouter un Niveau
                            </Button>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                          <Button type="button" variant="outline" onClick={() => setEditingPass(null)}>Annuler</Button>
                          <Button type="submit">Sauvegarder les Niveaux</Button>
                        </div>
                      </form>
                    </Card>
                </div>
              )}

              <AdminPassesTable 
                passes={passes} 
                onRefresh={fetchPasses} 
                onEditFull={setEditingPass}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'duelConfig' && duelConfig && (
        <Card className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-orange-500" />
              Configuration des Compétences en Duel
            </h3>
            <Button onClick={handleSaveDuelConfig} disabled={loading}>
              <Save className="w-4 h-4 mr-2" /> Sauvegarder la Configuration
            </Button>
          </div>

          <p className="text-sm text-gray-400 italic">
            Ajustez comment chaque compétence influence le déroulement des duels. 
            La formule utilisée est généralement : <code className="bg-gray-800 px-1 rounded text-orange-400">Valeur = Base + (Niveau * Multiplicateur)</code>
          </p>

          <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 space-y-4">
            <h4 className="font-bold text-orange-500 uppercase">Paramètres Globaux</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Temps de base pour 1 pt d'excitation (secondes)</label>
                <input
                  type="number"
                  step="0.1"
                  value={duelConfig.baseExcitementRegenTime || 5}
                  onChange={(e) => setDuelConfig({ ...duelConfig, baseExcitementRegenTime: parseFloat(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Lobby : Délai avant remplissage Bots (secondes)</label>
                <input
                  type="number"
                  value={duelConfig.botFillTimer || 30}
                  onChange={(e) => setDuelConfig({ ...duelConfig, botFillTimer: parseInt(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 space-y-4">
            <h4 className="font-bold text-blue-500 uppercase">Intelligence & Comportement des Bots</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Fréquence de clic (clics par seconde)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={duelConfig.botClickRatePerSec || 1}
                    onChange={(e) => setDuelConfig({ ...duelConfig, botClickRatePerSec: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono text-white w-12">{duelConfig.botClickRatePerSec || 1} /s</span>
                </div>
                <p className="text-[10px] text-gray-500 italic">Nombre moyen de clics qu'un bot effectue chaque seconde.</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Utilisation des Cartes (probabilité % par seconde)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={duelConfig.botCardPlayChance || 30}
                    onChange={(e) => setDuelConfig({ ...duelConfig, botCardPlayChance: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono text-white w-12">{duelConfig.botCardPlayChance || 30}%</span>
                </div>
                <p className="text-[10px] text-gray-500 italic">Probabilité cumulée par seconde qu'un bot joue une carte s'il a assez d'énergie.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {duelConfig.statEffects.map((effect, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      {effect.statName === 'force' && <Flame className="w-5 h-5 text-orange-500" />}
                      {effect.statName === 'endurance' && <Activity className="w-5 h-5 text-green-500" />}
                      {effect.statName === 'mental' && <Brain className="w-5 h-5 text-purple-500" />}
                      {effect.statName === 'bluff' && <Eye className="w-5 h-5 text-yellow-500" />}
                      {effect.statName === 'creativity' && <Star className="w-5 h-5 text-pink-500" />}
                      {effect.statName === 'social' && <Users className="w-5 h-5 text-blue-500" />}
                      {effect.statName === 'intelligence' && <Search className="w-5 h-5 text-cyan-500" />}
                      {effect.statName === 'charisma' && <Trophy className="w-5 h-5 text-amber-500" />}
                    </div>
                    <span className="font-bold uppercase tracking-wider text-sm">{effect.description.split(' : ')[0]}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-1 bg-gray-800 rounded text-gray-400">
                    {effect.effectType}
                  </span>
                </div>

                <p className="text-xs text-gray-400">{effect.description.split(' : ')[1]}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Valeur de Base</label>
                    <input
                      type="number"
                      step="0.001"
                      value={effect.baseValue}
                      onChange={(e) => {
                        const newEffects = [...duelConfig.statEffects];
                        newEffects[idx] = { ...effect, baseValue: parseFloat(e.target.value) };
                        setDuelConfig({ ...duelConfig, statEffects: newEffects });
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Mult. par Niveau</label>
                    <input
                      type="number"
                      step="0.001"
                      value={effect.multiplierPerLevel}
                      onChange={(e) => {
                        const newEffects = [...duelConfig.statEffects];
                        newEffects[idx] = { ...effect, multiplierPerLevel: parseFloat(e.target.value) };
                        setDuelConfig({ ...duelConfig, statEffects: newEffects });
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-800">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500 uppercase font-bold">Exemple Niveau 5 :</span>
                    <span className="text-orange-400 font-black">
                      {(effect.baseValue + (5 * effect.multiplierPerLevel)).toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-gray-800">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-500" />
              Coûts d'Entrée par Type de Duel
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {duelConfig.costs && Object.entries(duelConfig.costs).map(([type, cost]) => (
                <div key={type} className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 space-y-3">
                  <span className="text-[10px] font-black uppercase text-gray-500">{type.replace('_', ' ')}</span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-12">Argent</span>
                      <input
                        type="number"
                        value={cost.money}
                        onChange={(e) => {
                          const newCosts = { ...duelConfig.costs, [type]: { ...cost, money: parseInt(e.target.value) } };
                          setDuelConfig({ ...duelConfig, costs: newCosts });
                        }}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded p-1 text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-12">Excitation</span>
                      <input
                        type="number"
                        value={cost.energy}
                        onChange={(e) => {
                          const newCosts = { ...duelConfig.costs, [type]: { ...cost, energy: parseInt(e.target.value) } };
                          setDuelConfig({ ...duelConfig, costs: newCosts });
                        }}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded p-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Gains d'XP par Type de Duel
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {duelConfig.rewards && Object.entries(duelConfig.rewards).map(([type, reward]) => (
                <div key={type} className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 space-y-3">
                  <span className="text-[10px] font-black uppercase text-gray-500">{type.replace('_', ' ')}</span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-400 w-12">Victoire</span>
                      <input
                        type="number"
                        value={reward.winXp}
                        onChange={(e) => {
                          const newRewards = { ...duelConfig.rewards, [type]: { ...reward, winXp: parseInt(e.target.value) } };
                          setDuelConfig({ ...duelConfig, rewards: newRewards as any });
                        }}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded p-1 text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-400 w-12">Défaite</span>
                      <input
                        type="number"
                        value={reward.loseXp}
                        onChange={(e) => {
                          const newRewards = { ...duelConfig.rewards, [type]: { ...reward, loseXp: parseInt(e.target.value) } };
                          setDuelConfig({ ...duelConfig, rewards: newRewards as any });
                        }}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded p-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      
      {leagueActivationPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <Card className="p-6 max-w-md w-full bg-gray-900 border-white/10 shadow-2xl relative space-y-6">
            <h3 className="text-xl font-bold">Activer la compétition</h3>
            <p className="text-gray-400">
              Vous êtes sur le point d'activer <strong className="text-white">{leagueActivationPrompt.name}</strong>. Que souhaitez-vous créer avec cette compétition ?
            </p>
            <div className="space-y-3">
              <Button className="w-full text-left justify-start font-bold border-blue-500/30 text-blue-400 hover:bg-blue-500/10" variant="outline" onClick={() => handleConfirmLeagueActivation(leagueActivationPrompt.id, leagueActivationPrompt.name, true, 'mission')}>
                Créer une nouvelle MISSION liée
              </Button>
              <Button className="w-full text-left justify-start font-bold border-purple-500/30 text-purple-400 hover:bg-purple-500/10" variant="outline" onClick={() => handleConfirmLeagueActivation(leagueActivationPrompt.id, leagueActivationPrompt.name, true, 'pass')}>
                Créer un nouveau PASS lié
              </Button>
              <Button className="w-full text-left justify-start bg-gray-800 hover:bg-gray-700 text-white border-transparent" variant="outline" onClick={() => handleConfirmLeagueActivation(leagueActivationPrompt.id, leagueActivationPrompt.name, true, 'none')}>
                Rien, juste rendre visible
              </Button>
            </div>
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button variant="outline" onClick={() => setLeagueActivationPrompt(null)}>Annuler</Button>
            </div>
          </Card>
        </div>
      )}
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

          
          <Button
            onClick={handleDisableAllLeagues}
            disabled={loading}
            className="flex items-center gap-2"
            variant="outline"
          >
            Désactiver toutes
          </Button>
          <Button
            onClick={handleActivateOngoingLeagues}
            disabled={loading}
            className="flex items-center gap-2"
            variant="secondary"
          >
            <CheckCircle className="w-4 h-4" />
            Activer toutes les compétitions en cours
          </Button>
        </div>


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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs uppercase bg-black/40 text-gray-500">
              <tr>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleLeagueSort('id')}>
                  <div className="flex items-center gap-1">ID {leagueSort.column === 'id' ? (leagueSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleLeagueSort('name')}>
                  <div className="flex items-center gap-1">Compétition {leagueSort.column === 'name' ? (leagueSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleLeagueSort('country')}>
                  <div className="flex items-center gap-1">Pays {leagueSort.column === 'country' ? (leagueSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                </th>
                <th className="py-3 px-4">
                  Saison
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleLeagueSort('status')}>
                  <div className="flex items-center gap-1">Statut {leagueSort.column === 'status' ? (leagueSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeagues.map((item) => {
                const seasonInfo = item.seasons?.find((s: any) => s.year === selectedSeason);
                let isComing = false;
                let isFinished = false;
                let isOngoing = false;
                if (seasonInfo) {
                  const now = new Date();
                  const start = new Date(seasonInfo.start);
                  const end = new Date(seasonInfo.end);
                  isComing = now < start;
                  isFinished = now > end;
                  isOngoing = !isComing && !isFinished;
                }

                return (
                  <tr key={item.league.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-gray-500">{item.league.id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img src={item.league.logo} alt={item.league.name} className="w-8 h-8 object-contain" />
                        <span className="font-bold text-white">{item.league.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {item.country.flag && <img src={item.country.flag} alt="" className="w-5 h-3.5 object-cover rounded-sm" />}
                        <span>{item.country.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {seasonInfo ? (
                        <div className="flex flex-col gap-1 items-start">
                          <div className="text-[10px] text-gray-400">
                            <strong>{seasonInfo.year}</strong> : {seasonInfo.start} au {seasonInfo.end}
                          </div>
                          {isOngoing && <span className="text-[10px] bg-green-500/20 text-green-500 border border-green-500/30 px-1.5 py-0.5 rounded font-bold uppercase">En cours</span>}
                          {isComing && <span className="text-[10px] bg-blue-500/20 text-blue-500 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold uppercase">À venir</span>}
                          {isFinished && <span className="text-[10px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1.5 py-0.5 rounded font-bold uppercase">Terminée</span>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-500">Saison {selectedSeason}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleCompetition(item.league.id, !!item.league.isActive, item.league.name)}
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded transition-colors ${
                          item.league.isActive ? 'bg-green-500/20 text-green-500 hover:bg-green-500/40' : 'bg-red-500/20 text-red-500 hover:bg-red-500/40'
                        }`}
                      >
                        {item.league.isActive ? 'Visible' : 'Masquée'}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleImportFullLeague(item.league.id)}
                          disabled={loading}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 h-auto text-xs"
                          title="Importer"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" /> Importer
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {activeTab === 'duelCards' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gestion des Cartes DUEL</h2>
            <div className="flex gap-3">
              <Button onClick={handleCreateNewCard} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Plus className="w-5 h-5" /> Nouvelle Carte
              </Button>
            </div>
          </div>


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
                    <label className="text-sm font-medium text-gray-500">Coût Excitation</label>
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
                    <label className="text-sm font-medium text-gray-500">Valeur Ferveur</label>
                    <input
                      type="number"
                      value={editingCard.fervorValue}
                      onChange={e => setEditingCard({...editingCard, fervorValue: Number(e.target.value)})}
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
                    <label className="text-sm font-medium text-gray-500">Prix (Billets)</label>
                    <input
                      type="number"
                      value={editingCard.price?.money || 0}
                      onChange={e => setEditingCard({...editingCard, price: { ...editingCard.price, money: Number(e.target.value) }})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Prix (Gemmes)</label>
                    <input
                      type="number"
                      value={editingCard.price?.gems || 0}
                      onChange={e => setEditingCard({...editingCard, price: { ...editingCard.price, gems: Number(e.target.value) }})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Prix (Points Boost)</label>
                    <input
                      type="number"
                      value={editingCard.price?.boostPoints || 0}
                      onChange={e => setEditingCard({...editingCard, price: { ...editingCard.price, boostPoints: Number(e.target.value) }})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
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
                          <img src={getImageUrl(editingCard.imageUrl)} alt="Preview" className="w-full h-full object-cover" />
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
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <video 
                            key={getImageUrl(editingCard.videoUrl)}
                            src={getImageUrl(editingCard.videoUrl)} 
                            className="w-full h-full object-cover"
                            autoPlay muted loop playsInline
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Son / Bruitage</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingCard.soundUrl || ''}
                        onChange={e => setEditingCard({...editingCard, soundUrl: e.target.value})}
                        className="flex-1 p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                        placeholder="https://..."
                      />
                      {editingCard.soundUrl && (
                        <div className="flex items-center">
                          <audio controls src={getImageUrl(editingCard.soundUrl)} className="h-8 max-w-[200px]" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">ID du Fanz (Optionnel)</label>
                    <input
                      type="text"
                      value={(editingCard.fanzIds || []).join(', ')}
                      onChange={e => setEditingCard({...editingCard, fanzIds: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : [], skinId: undefined})}
                      placeholder="Ex: fanz-001, fanz-002 (Laissez vide pour tous)"
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  {editingCard.fanzIds && editingCard.fanzIds.length === 1 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">Skin spécifique (Optionnel)</label>
                      <select
                        value={editingCard.skinId || ''}
                        onChange={e => setEditingCard({...editingCard, skinId: e.target.value})}
                        className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      >
                        <option value="">Tous les skins du FANZ</option>
                        {fanzTemplates.find(f => f.id === editingCard.fanzIds![0])?.skins?.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Thème de Skin (Optionnel - Pour tous les Fanz)</label>
                    <input
                      type="text"
                      value={editingCard.skinTheme || ''}
                      onChange={e => setEditingCard({...editingCard, skinTheme: e.target.value})}
                      placeholder="Ex: viking (applique la carte à tous les skins contenant ce mot)"
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Fanz Bloqués (Optionnel)</label>
                    <input
                      type="text"
                      value={(editingCard.blockedFanzIds || []).join(', ')}
                      onChange={e => setEditingCard({...editingCard, blockedFanzIds: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : []})}
                      placeholder="Ex: fanz-3, fanz-4 (Laissez vide pour aucun)"
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
                      <div key={idx} className="flex gap-3 items-end p-3 bg-white/5 border border-white/10 rounded-lg">
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
                    <Button type="button" size="sm" onClick={() => setEditingCard({...editingCard, effects: [...(editingCard.effects || []), { type: 'push_rope', value: 5 }]})}>
                      Ajouter Effet
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {(editingCard.effects || []).map((effect, idx) => (
                      <div key={idx} className="flex gap-3 items-end p-3 bg-white/5 border border-white/10 rounded-lg">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Type</label>
                          <select
                            value={effect.type}
                            onChange={e => {
                              const newEffects = [...(editingCard.effects || [])];
                              newEffects[idx] = { ...effect, type: e.target.value as any };
                              setEditingCard({...editingCard, effects: newEffects});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                          >
                            <option value="push_rope">Pousser Corde (%) [Valeur]</option>
                            <option value="drain_energy">Drainer Excitation (Adverse) [Valeur]</option>
                            <option value="refill_energy">Remplir Excitation (Soi) [Valeur]</option>
                            <option value="draw_cards">Piocher Cartes (Soi) [Valeur]</option>
                            <option value="hide_button">Cacher Bouton (Adverse) [Durée]</option>
                            <option value="shrink_button">Réduire Bouton (Adverse) [Durée]</option>
                            <option value="move_button">Bouger Bouton (Adverse) [Durée]</option>
                            <option value="blur_view">Troubler Vue (Adverse) [Durée]</option>
                            <option value="hide_score">Cacher Score [Durée]</option>
                            <option value="discard_enemy_cards">Défausser Cartes (Adverse) [Rien]</option>
                            <option value="shuffle_deck">Mélanger Deck (Adverse) [Rien]</option>
                            <option value="freeze_button">Geler Bouton (Adverse) [Durée]</option>
                            <option value="double_points">Double Ferveur (Soi) [Durée]</option>
                            <option value="shield">Bouclier (Soi) [Rien]</option>
                            <option value="mirror">Miroir (Soi) [Rien]</option>
                            <option value="energy_regen_boost">Boost Regen (Soi) [Durée]</option>
                            <option value="earthquake">Séisme (Adverse) [Durée]</option>
                            <option value="fake_buttons">Boutons Fantômes (Adverse) [Durée]</option>
                            <option value="card_lock">Bloquer Cartes (Adverse) [Durée]</option>
                            <option value="swap_hands">Échanger Mains [Rien]</option>
                            <option value="mimic">Copier Dernière Carte [Rien]</option>
                            <option value="lucky_draw">Tirage Chanceux [Rien]</option>
                            <option value="steal_energy">Voler Excitation (Adverse) [Valeur]</option>
                            <option value="cleanse">Purge (Soi) [Rien]</option>
                            <option value="vampirism">Vampirisme (Soi) [Durée]</option>
                            <option value="fog_of_war">Brouillard de Guerre (Adverse) [Durée]</option>
                            <option value="frenzy">Frénésie (Soi) [Durée]</option>
                            <option value="sabotage">Sabotage (Adverse) [Rien]</option>
                            <option value="immunity">Immunité (Soi) [Durée]</option>
                            <option value="critical_strike">Frappe Critique (Soi) [Rien]</option>
                            <option value="momentum">Momentum (Soi) [Durée]</option>
                            <option value="overload">Surcharge (Soi) [Rien]</option>
                            <option value="invert_rope">Inversion Corde [Rien]</option>
                            <option value="blackout">Coupure de Courant (Adverse) [Durée]</option>
                            <option value="curse">Malédiction (Adverse) [Rien]</option>
                            <option value="blessing">Bénédiction (Soi) [Durée]</option>
                            <option value="confetti">Confettis (Adverse) [Durée]</option>
                            <option value="golden_goal">Action en Or (Soi) [Rien]</option>
                            <option value="hypnosis">Hypnose (Adverse) [Durée]</option>
                            <option value="pacifier_drama">Drame de la Tétine (Tous) [Rien]</option>
                            <option value="mascot_bazooka">Bazooka de la Mascotte (Tous) [Rien]</option>
                            <option value="steal_best_card">Saint Graal (Adverse) [Rien]</option>
                            <option value="discard_random_cards">Défausse Aléatoire (Soi) [Valeur]</option>
                            <option value="trade_stickers">Échange de Doubles (Tous) [Rien]</option>
                          </select>
                        </div>
                        <div className="w-24 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Valeur</label>
                          <input
                            type="number"
                            value={effect.value || 0}
                            onChange={e => {
                              const newEffects = [...(editingCard.effects || [])];
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
                              const newEffects = [...(editingCard.effects || [])];
                              newEffects[idx] = { ...effect, duration: Number(e.target.value) };
                              setEditingCard({...editingCard, effects: newEffects});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                          />
                        </div>
                        <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => {
                          const newEffects = (editingCard.effects || []).filter((_, i) => i !== idx);
                          setEditingCard({...editingCard, effects: newEffects});
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const newId = `card-${Date.now()}`;
                      setEditingCard({
                        ...editingCard,
                        id: newId,
                        name: `${editingCard.name} (Copie)`
                      });
                    }}
                  >
                    Dupliquer
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingCard(null)}>Annuler</Button>
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="flex flex-wrap gap-4 mb-4">
            <select
              value={filterCardType}
              onChange={(e) => setFilterCardType(e.target.value)}
              className="p-2 bg-[#1a1a2e] border border-white/20 rounded-lg text-white font-bold text-sm"
            >
              <option value="all">Tous les types</option>
              <option value="bonus">Bonus</option>
              <option value="malus">Malus</option>
              <option value="neutral">Neutre</option>
            </select>
            <select
              value={filterCardRarity}
              onChange={(e) => setFilterCardRarity(e.target.value)}
              className="p-2 bg-[#1a1a2e] border border-white/20 rounded-lg text-white font-bold text-sm"
            >
              <option value="all">Toutes raretés</option>
              <option value="common">Commune</option>
              <option value="rare">Rare</option>
              <option value="epic">Épique</option>
              <option value="legendary">Légendaire</option>
            </select>
            <select
              value={filterCardFanz}
              onChange={(e) => setFilterCardFanz(e.target.value)}
              className="p-2 bg-[#1a1a2e] border border-white/20 rounded-lg text-white font-bold text-sm"
            >
              <option value="all">Tous les FANZ</option>
              <option value="generic">Cartes Génériques</option>
              {effectiveFanzTemplates.map(fanz => (
                <option key={fanz.id} value={fanz.id}>{fanz.id} - {fanz.name}</option>
              ))}
            </select>

            <div className="flex-1 relative min-w-[200px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher une carte..."
                value={searchCard}
                onChange={(e) => setSearchCard(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1a1a2e] border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex bg-[#1a1a2e] border border-white/20 rounded-lg overflow-hidden ml-auto">
              <button 
                onClick={() => setCardViewMode('grid')}
                className={`p-2 transition-colors ${cardViewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                 <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCardViewMode('list')}
                className={`p-2 transition-colors ${cardViewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                 <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {(() => {
            const sortedDuelCards = duelCards.filter(c => {
               if (filterCardType !== 'all' && c.type !== filterCardType) return false;
               if (filterCardRarity !== 'all' && c.rarity !== filterCardRarity) return false;
               if (filterCardFanz !== 'all') {
                 if (filterCardFanz === 'generic' && c.fanzIds && c.fanzIds.length > 0) return false;
                 if (filterCardFanz !== 'generic' && (!c.fanzIds || !c.fanzIds.includes(filterCardFanz))) return false;
               }
               if (searchCard.trim()) {
                 const q = searchCard.toLowerCase();
                 if (!c.name.toLowerCase().includes(q) && !(c.id || '').toLowerCase().includes(q)) return false;
               }
               return true;
            }).sort((a, b) => {
              if (!cardSort) return 0;
              const { column, direction } = cardSort;
              const aVal = String(a[column as keyof typeof a] || '').toLowerCase();
              const bVal = String(b[column as keyof typeof b] || '').toLowerCase();
              return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            });

            const handleCardSort = (col: string) => {
              if (cardSort?.column === col) {
                setCardSort({ column: col, direction: cardSort.direction === 'asc' ? 'desc' : 'asc' });
              } else {
                setCardSort({ column: col, direction: 'asc' });
              }
            };
            
            return (
              <>
                {cardViewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sortedDuelCards.map((card) => (
              <Card key={card.id} className="p-4 hover:border-blue-500 transition-colors cursor-pointer group" onClick={() => setEditingCard(card)}>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100">
                  {card.videoUrl ? (
                    <video 
                      key={getImageUrl(card.videoUrl)}
                      src={getImageUrl(card.videoUrl)}
                      poster={getImageUrl(card.imageUrl) || undefined}
                      className="w-full h-full object-cover"
                      autoPlay muted loop playsInline
                    />
                  ) : (
                    <img src={getImageUrl(card.imageUrl || '')} alt={card.name} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <img src={LOGOS.energy} alt="Energy" className="w-2.5 h-2.5 object-contain" /> {card.energyCost}
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
                  </div>
                ) : (
                  <div className="bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-black/40 text-xs font-black uppercase text-gray-400">
                          <tr>
                            <th className="px-4 py-3 align-middle text-center w-16">Image</th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white" onClick={() => handleCardSort('name')}>
                              <div className="flex items-center gap-1">Nom {cardSort?.column === 'name' ? (cardSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white" onClick={() => handleCardSort('type')}>
                              <div className="flex items-center gap-1">Type {cardSort?.column === 'type' ? (cardSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white" onClick={() => handleCardSort('rarity')}>
                              <div className="flex items-center gap-1">Rareté {cardSort?.column === 'rarity' ? (cardSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white" onClick={() => handleCardSort('fanzIds')}>
                              <div className="flex items-center gap-1">Fanz {cardSort?.column === 'fanzIds' ? (cardSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white text-center" onClick={() => handleCardSort('energyCost')}>
                              <div className="flex items-center justify-center gap-1">Coût {cardSort?.column === 'energyCost' ? (cardSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle text-center w-16">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-black/20">
                          {sortedDuelCards.map((card) => (
                            <AdminDuelCardRow
                              key={card.id}
                              card={card}
                              onSaved={fetchDuelCards}
                              onDeleted={() => handleDeleteDuelCard(card.id)}
                              onEditFull={(card) => setEditingCard(card)}
                              fanzTemplates={fanzTemplates}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {duelCards.length === 0 && !loading && (
                  <div className="col-span-full text-center p-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                    <Layers className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucune carte DUEL trouvée. Utilisez "Synchroniser Base" pour commencer.</p>
                  </div>
                )}
              </>
            );
          })()}
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
                    <label className="text-sm font-medium text-gray-500">Appartenance FANZ (Optionnel)</label>
                    <select
                      value={editingAction.fanzTemplateId || ''}
                      onChange={e => setEditingAction({...editingAction, fanzTemplateId: e.target.value, skinId: undefined})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    >
                      <option value="">Tous les FANZ</option>
                      {fanzTemplates.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  {editingAction.fanzTemplateId && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">Skin spécifique (Optionnel)</label>
                      <select
                        value={editingAction.skinId || ''}
                        onChange={e => setEditingAction({...editingAction, skinId: e.target.value})}
                        className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      >
                        <option value="">Tous les skins du FANZ</option>
                        {fanzTemplates.find(f => f.id === editingAction.fanzTemplateId)?.skins?.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
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
                          <img src={getImageUrl(editingAction.image)} alt="Preview" className="w-full h-full object-cover" />
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
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <video 
                            key={getImageUrl(editingAction.videoUrl)}
                            src={getImageUrl(editingAction.videoUrl)} 
                            className="w-full h-full object-cover"
                            autoPlay muted loop playsInline
                          />
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
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const newId = `action-${Date.now()}`;
                      setEditingAction({
                        ...editingAction,
                        id: newId,
                        name: `${editingAction.name} (Copie)`
                      });
                    }}
                  >
                    Dupliquer
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingAction(null)}>Annuler</Button>
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="flex flex-wrap gap-4 mb-4">
            <select
              value={filterLifeActionFanz}
              onChange={(e) => setFilterLifeActionFanz(e.target.value)}
              className="p-2 bg-[#1a1a2e] border border-white/20 rounded-lg text-white font-bold text-sm"
            >
              <option value="all">Tous les FANZ</option>
              <option value="generic">Actions Génériques</option>
              {effectiveFanzTemplates.map(fanz => (
                <option key={fanz.id} value={fanz.id}>{fanz.id} - {fanz.name}</option>
              ))}
            </select>

            <div className="flex-1 relative min-w-[200px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher une action..."
                value={searchLifeAction}
                onChange={(e) => setSearchLifeAction(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1a1a2e] border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex bg-[#1a1a2e] border border-white/20 rounded-lg overflow-hidden ml-auto">
              <button 
                onClick={() => setLifeActionViewMode('grid')}
                className={`p-2 transition-colors ${lifeActionViewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                 <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setLifeActionViewMode('list')}
                className={`p-2 transition-colors ${lifeActionViewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                 <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {(() => {
            const sortedLifeActions = lifeActions.filter(action => {
              if (filterLifeActionFanz !== 'all') {
                if (filterLifeActionFanz === 'generic' && action.fanzTemplateId) return false;
                if (filterLifeActionFanz !== 'generic' && action.fanzTemplateId !== filterLifeActionFanz) return false;
              }
              if (searchLifeAction.trim()) {
                const q = searchLifeAction.toLowerCase();
                if (!action.name.toLowerCase().includes(q) && !(action.id || '').toLowerCase().includes(q)) return false;
              }
              return true;
            }).sort((a, b) => {
              if (!lifeActionSort) return 0;
              const { column, direction } = lifeActionSort;
              const aVal = String(a[column as keyof typeof a] || '').toLowerCase();
              const bVal = String(b[column as keyof typeof b] || '').toLowerCase();
              return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            });

            const handleActionSort = (col: string) => {
              if (lifeActionSort?.column === col) {
                setLifeActionSort({ column: col, direction: lifeActionSort.direction === 'asc' ? 'desc' : 'asc' });
              } else {
                setLifeActionSort({ column: col, direction: 'asc' });
              }
            };
            
            return (
              <>
                {lifeActionViewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedLifeActions.map((action) => (
                      <Card key={action.id} className="p-4 hover:border-blue-500 transition-colors cursor-pointer" onClick={() => setEditingAction(action)}>
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                            {action.videoUrl ? (
                              <video 
                                key={getImageUrl(action.videoUrl)}
                                src={getImageUrl(action.videoUrl)}
                                poster={getImageUrl(action.image)}
                                className="w-full h-full object-cover"
                                autoPlay muted loop playsInline
                              />
                            ) : action.image ? (
                              <img src={getImageUrl(action.image)} alt={action.name} className="w-full h-full object-cover" />
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
                  </div>
                ) : (
                  <div className="bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-black/40 text-xs font-black uppercase text-gray-400">
                          <tr>
                            <th className="px-4 py-3 align-middle text-center w-16">Image</th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white" onClick={() => handleActionSort('name')}>
                              <div className="flex items-center gap-1">Nom {lifeActionSort?.column === 'name' ? (lifeActionSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white text-center" onClick={() => handleActionSort('durationMinutes')}>
                              <div className="flex items-center justify-center gap-1">Durée {lifeActionSort?.column === 'durationMinutes' ? (lifeActionSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white" onClick={() => handleActionSort('fanzTemplateId')}>
                              <div className="flex items-center gap-1">Fanz {lifeActionSort?.column === 'fanzTemplateId' ? (lifeActionSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle cursor-pointer hover:text-white" onClick={() => handleActionSort('id')}>
                              <div className="flex items-center gap-1">ID {lifeActionSort?.column === 'id' ? (lifeActionSort.direction === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>) : null}</div>
                            </th>
                            <th className="px-4 py-3 align-middle text-center w-16">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-black/20">
                          {sortedLifeActions.map((action) => (
                            <AdminLifeActionRow
                              key={action.id}
                              action={action}
                              onSaved={fetchLifeActions}
                              onDeleted={() => handleDeleteLifeAction(action.id)}
                              fanzTemplates={fanzTemplates}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {lifeActions.length === 0 && !loading && (
                  <div className="col-span-full text-center p-8 text-gray-500">
                    Aucune action LIFE trouvée dans la base de données.
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
      {activeTab === 'fanz' && (
        <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Modèles FANZ</h2>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1 border border-white/10">
                    <button
                      onClick={() => setFanzViewMode('grid')}
                      className={`p-1.5 rounded-md transition-colors ${fanzViewMode === 'grid' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="Vue Grille"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setFanzViewMode('list')}
                      className={`p-1.5 rounded-md transition-colors ${fanzViewMode === 'list' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="Vue Liste"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  <Button onClick={handleMigrateSkinIds} variant="outline" className="flex items-center gap-2 border-red-500 text-red-500 hover:bg-red-500/10 hidden lg:flex">
                    <Database className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /> Migration IDs
                  </Button>
                  <Button onClick={handleFixFerveurPaths} variant="outline" className="flex items-center gap-2 border-orange-500 text-orange-500 hover:bg-orange-500/10 hidden lg:flex">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /> Maj Ferveur
                  </Button>
                  <Button onClick={handleCreateNewFanz} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                    <Plus className="w-5 h-5" /> Nouveau FANZ
                  </Button>
                </div>
              </div>


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
                    <label className="text-sm font-medium text-gray-500">Description Courte</label>
                    <input
                      type="text"
                      value={editingFanz.shortDescription || ''}
                      onChange={e => setEditingFanz({...editingFanz, shortDescription: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Description Longue</label>
                    <textarea
                      value={editingFanz.longDescription || ''}
                      onChange={e => setEditingFanz({...editingFanz, longDescription: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none h-24"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Cri de Guerre</label>
                    <input
                      type="text"
                      value={editingFanz.battleCry || ''}
                      onChange={e => setEditingFanz({...editingFanz, battleCry: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
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
                    <label className="text-sm font-medium text-gray-500">Prix (Billets)</label>
                    <input
                      type="number"
                      value={editingFanz.price?.money || 0}
                      onChange={e => setEditingFanz({...editingFanz, price: { ...editingFanz.price, money: Number(e.target.value) }})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Prix (Gemmes)</label>
                    <input
                      type="number"
                      value={editingFanz.price?.gems || 0}
                      onChange={e => setEditingFanz({...editingFanz, price: { ...editingFanz.price, gems: Number(e.target.value) }})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Excitation de Base (1-10)</label>
                    <input
                      type="number"
                      value={editingFanz.baseExcitement || 5}
                      onChange={e => setEditingFanz({...editingFanz, baseExcitement: Number(e.target.value)})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      min="1"
                      max="10"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <input
                      type="checkbox"
                      id="fanz-active"
                      checked={editingFanz.isActive ?? true}
                      onChange={e => setEditingFanz({...editingFanz, isActive: e.target.checked})}
                      className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <label htmlFor="fanz-active" className="text-sm font-medium text-gray-700">
                      FANZ Actif (disponible pour les joueurs)
                    </label>
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
                          <img src={getImageUrl(editingFanz.image)} alt="Preview" className="w-full h-full object-cover" />
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
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <video 
                            key={getImageUrl(editingFanz.video)}
                            src={getImageUrl(editingFanz.video)} 
                            className="w-full h-full object-cover"
                            autoPlay muted loop playsInline
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Vidéo Victoire (Skin 000)</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingFanz.victoryVideoUrl || ''}
                        onChange={e => setEditingFanz({...editingFanz, victoryVideoUrl: e.target.value})}
                        className="flex-1 p-2 bg-green-100 text-gray-900 rounded-lg border-none"
                        placeholder="https://..."
                      />
                      {editingFanz.victoryVideoUrl && (
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <video 
                            key={getImageUrl(editingFanz.victoryVideoUrl)}
                            src={getImageUrl(editingFanz.victoryVideoUrl)} 
                            className="w-full h-full object-cover"
                            autoPlay muted loop playsInline
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">URL Vidéo Défaite (Skin 000)</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={editingFanz.defeatVideoUrl || ''}
                        onChange={e => setEditingFanz({...editingFanz, defeatVideoUrl: e.target.value})}
                        className="flex-1 p-2 bg-red-100 text-gray-900 rounded-lg border-none"
                        placeholder="https://..."
                      />
                      {editingFanz.defeatVideoUrl && (
                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <video 
                            key={getImageUrl(editingFanz.defeatVideoUrl)}
                            src={getImageUrl(editingFanz.defeatVideoUrl)} 
                            className="w-full h-full object-cover"
                            autoPlay muted loop playsInline
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
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

                {/* Special Attacks Section */}
                <div className="space-y-4 pt-4 border-t border-gray-100 flex-shrink-0">
                  <h4 className="font-bold flex items-center gap-2">
                    <Target className="w-5 h-5 text-red-500" /> Attaques Spéciales (Deck)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Attaque #{idx + 1}</label>
                        <select
                          value={editingFanz.specialAttackIds?.[idx] || ''}
                          onChange={e => {
                            const currentIds = editingFanz.specialAttackIds || ['', '', ''];
                            const newIds = [...currentIds];
                            // Ensure it has 3 elements
                            while (newIds.length < 3) newIds.push('');
                            newIds[idx] = e.target.value;
                            setEditingFanz({ ...editingFanz, specialAttackIds: newIds });
                          }}
                          className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none text-xs"
                        >
                          <option value="">Sélectionner une carte</option>
                          {duelCards
                            .filter(card => card.fanzIds?.includes(editingFanz.id))
                            .map(card => (
                            <option key={card.id} value={card.id}>{card.name} ({card.rarity})</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skill-Linked LIFE Actions Section */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h4 className="font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" /> Actions LIFE Liées (Compétences)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(['force', 'endurance', 'mental', 'bluff', 'creativity', 'social', 'intelligence', 'charisma'] as (keyof FanzStats)[]).map((stat) => (
                      <div key={stat} className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-400">{stat}</label>
                        <select
                          value={editingFanz.lifeActionIds?.[stat] || ''}
                          onChange={e => {
                            setEditingFanz({
                              ...editingFanz,
                              lifeActionIds: {
                                ...(editingFanz.lifeActionIds || {}),
                                [stat]: e.target.value
                              }
                            });
                          }}
                          className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none text-xs"
                        >
                          <option value="">Sélectionner une action</option>
                          {lifeActions
                            .filter(action => action.fanzTemplateId === editingFanz.id)
                            .map(action => (
                            <option key={action.id} value={action.id}>{action.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold flex items-center gap-2">
                       <img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /> Chemin de la Ferveur (Spécifique à ce FANZ)
                    </h4>
                    {!editingFanz.ferveurConfig && (
                      <Button type="button" size="sm" onClick={() => {
                        setEditingFanz({
                          ...editingFanz, 
                          ferveurConfig: fanzFervorConfig ? JSON.parse(JSON.stringify(fanzFervorConfig)) : { id: 'fervor-1', ranges: [] }
                        });
                      }}>
                        Personnaliser à partir du Global
                      </Button>
                    )}
                    {editingFanz.ferveurConfig && (
                      <div className="flex gap-2">
                         <Button type="button" size="sm" variant="outline" className="text-red-500" onClick={() => {
                            setEditingFanz({...editingFanz, ferveurConfig: undefined});
                         }}>
                            Réinitialiser (Utiliser le Global)
                         </Button>
                      </div>
                    )}
                  </div>
                  
                  {!editingFanz.ferveurConfig ? (
                    <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800 text-center text-sm text-gray-500 italic">
                      Ce FANZ utilise la configuration de ferveur par défaut. Cliquez sur "Personnaliser à partir du Global" pour modifier les paliers spécifiquement pour ce FANZ.
                    </div>
                  ) : (
                    <FanzFerveurTable 
                      ranges={editingFanz.ferveurConfig.ranges || []} 
                      onChange={ranges => setEditingFanz({ ...editingFanz, ferveurConfig: { ...editingFanz.ferveurConfig!, ranges } })} 
                      fanzId={editingFanz.id} 
                      fanzTemplates={effectiveFanzTemplates}
                      lifeActions={lifeActions}
                      duelCards={duelCards}
                    />
                  )}
                </div>

                <div className="flex justify-end mt-4">
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold flex items-center gap-2">
                      <Star className="w-5 h-5 text-purple-500" /> Skins du Fanz
                    </h4>
                  </div>
                  <FanzSkinsTable 
                    skins={editingFanz.skins || []} 
                    onChange={skins => setEditingFanz({...editingFanz, skins})} 
                    lifeActions={lifeActions} 
                    duelCards={duelCards} 
                    fanzId={editingFanz.id} 
                  />
                </div>

                <div className="flex justify-end mt-4">
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-yellow-500" /> Emotes du Fanz
                    </h4>
                  </div>
                  <FanzEmotesTable 
                    emotes={editingFanz.emotes || []} 
                    onChange={emotes => setEditingFanz({...editingFanz, emotes})} 
                    fanzId={editingFanz.id} 
                  />
                </div>

                <div className="flex justify-end mt-4">
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" /> Récompenses de Rang (1-10)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 10 }).map((_, rIdx) => {
                      const rankNum = rIdx + 1;
                      const slotId = `rank-${rankNum}`;
                      const reward = editingFanz.rankRewards?.[slotId] || { id: slotId, type: 'money', amount: 0 };
                      const cost = editingFanz.rankCosts?.[slotId] || { money: rankNum * 1000, boostPoints: rankNum * 50 };
                      
                      return (
                        <div key={rankNum} className="p-4 bg-gray-900/50 rounded-xl space-y-3 border border-gray-800">
                          <div className="flex justify-between items-center">
                            <div className="font-black italic uppercase text-sm text-gray-400">Rang {rankNum}</div>
                            <Trophy className="w-4 h-4 text-orange-500" />
                          </div>
                          
                          {rankNum > 1 && (
                            <div className="space-y-2 pb-3 border-b border-gray-800">
                              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Coût pour débloquer</div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-400 flex items-center gap-1"><img src={LOGOS.money} alt="Money" className="w-3 h-3" /> Argent</label>
                                  <input 
                                    type="number" 
                                    value={cost.money ?? ''}
                                    onChange={e => {
                                      const newCosts = { ...(editingFanz.rankCosts || {}) };
                                      newCosts[slotId] = { ...cost, money: e.target.value === '' ? undefined : Number(e.target.value) };
                                      setEditingFanz({...editingFanz, rankCosts: newCosts});
                                    }}
                                    className="w-full p-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-400 flex items-center gap-1"><img src={LOGOS.boost} alt="Boost" className="w-3 h-3" /> Boost</label>
                                  <input 
                                    type="number" 
                                    value={cost.boostPoints ?? ''}
                                    onChange={e => {
                                      const newCosts = { ...(editingFanz.rankCosts || {}) };
                                      newCosts[slotId] = { ...cost, boostPoints: e.target.value === '' ? undefined : Number(e.target.value) };
                                      setEditingFanz({...editingFanz, rankCosts: newCosts});
                                    }}
                                    className="w-full p-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Récompense unique</div>
                            <RewardSelector
                              reward={reward as any}
                              onChange={newReward => {
                                const newRewards = { ...(editingFanz.rankRewards || {}) };
                                newRewards[slotId] = newReward as any;
                                setEditingFanz({...editingFanz, rankRewards: newRewards});
                              }}
                              fanzTemplates={effectiveFanzTemplates}
                              lifeActions={lifeActions}
                              duelCards={duelCards}
                              theme="light"
                              isFanzContext={true}
                              currentFanzId={editingFanz.id}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const newId = `fanz-${Date.now()}`;
                      setEditingFanz({
                        ...editingFanz,
                        id: newId,
                        name: `${editingFanz.name} (Copie)`,
                        skins: editingFanz.skins?.map(skin => ({ ...skin, id: `skin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, fanzId: newId })),
                        emotes: editingFanz.emotes?.map(emote => ({ ...emote, id: `emote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, fanzId: newId }))
                      });
                    }}
                  >
                    Dupliquer
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingFanz(null)}>Annuler</Button>
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {fanzViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sortedFanzTemplates.map((template) => (
                <Card 
                  key={template.id} 
                  className={`p-4 hover:border-blue-500 transition-colors cursor-pointer group ${template.isActive === false ? 'opacity-50' : ''}`} 
                  onClick={() => {
                    const defaultPath: FerveurLevel[] = [
                      { level: 1, pointsRequired: 249, reward: { type: 'money' as const, amount: 100 } },
                      { level: 2, pointsRequired: 499, reward: { type: 'money' as const, amount: 100 } },
                      { level: 3, pointsRequired: 749, reward: { type: 'money' as const, amount: 100 } },
                      { level: 4, pointsRequired: 999, reward: { type: 'money' as const, amount: 100 } },
                      { level: 5, pointsRequired: 1000, reward: { type: 'money' as const, amount: 100 } }
                    ];
                    setEditingFanz({
                      ...template,
                      ferveurPath: template.ferveurPath && template.ferveurPath.length > 0 ? template.ferveurPath : defaultPath
                    });
                  }}
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100">
                    {template.video ? (
                      <video 
                        key={getImageUrl(template.video)}
                        src={getImageUrl(template.video)}
                        poster={getImageUrl(template.image)}
                        className="w-full h-full object-cover"
                        autoPlay muted loop playsInline
                      />
                    ) : (
                      <img src={getImageUrl(template.image)} alt={template.name} className="w-full h-full object-cover" />
                    )}
                    <div className={`absolute top-2 left-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                      template.rarity === 'legendary' ? 'bg-yellow-500' : template.rarity === 'epic' ? 'bg-purple-500' : template.rarity === 'rare' ? 'bg-blue-500' : 'bg-gray-500'
                    }`}>
                      {template.rarity}
                    </div>
                    {template.isActive === false && (
                      <div className="absolute top-2 right-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500 text-white">
                        Inactif
                      </div>
                    )}
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
          ) : (
            <Card className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 uppercase text-xs font-black">
                      <th className="py-3 px-2 w-16">Média</th>
                      <th className="py-3 px-2 cursor-pointer hover:text-white" onClick={() => handleFanzSort('id')}>
                        <div className="flex items-center gap-1">ID {fanzSort.column === 'id' ? (fanzSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                      </th>
                      <th className="py-3 px-2 cursor-pointer hover:text-white" onClick={() => handleFanzSort('name')}>
                        <div className="flex items-center gap-1">Nom {fanzSort.column === 'name' ? (fanzSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                      </th>
                      <th className="py-3 px-2 cursor-pointer hover:text-white" onClick={() => handleFanzSort('rarity')}>
                        <div className="flex items-center gap-1">Rareté {fanzSort.column === 'rarity' ? (fanzSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                      </th>
                      <th className="py-3 px-2 cursor-pointer hover:text-white" onClick={() => handleFanzSort('skins')}>
                        <div className="flex items-center gap-1">Skins {fanzSort.column === 'skins' ? (fanzSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                      </th>
                      <th className="py-3 px-2 cursor-pointer hover:text-white" onClick={() => handleFanzSort('emotes')}>
                        <div className="flex items-center gap-1">Emotes {fanzSort.column === 'emotes' ? (fanzSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                      </th>
                      <th className="py-3 px-2 cursor-pointer hover:text-white" onClick={() => handleFanzSort('isActive')}>
                        <div className="flex items-center gap-1">Statut {fanzSort.column === 'isActive' ? (fanzSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
                      </th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFanzTemplates.map(template => {
                      const isModified = modifiedFanzIds.has(template.id);
                      return (
                      <tr 
                        key={template.id} 
                        className={`border-b border-gray-800/50 hover:bg-white/5 cursor-pointer transition-colors ${template.isActive === false ? 'opacity-50' : ''}`}
                        onClick={() => {
                          const defaultPath: FerveurLevel[] = [
                            { level: 1, pointsRequired: 249, reward: { type: 'money' as const, amount: 100 } },
                            { level: 2, pointsRequired: 499, reward: { type: 'money' as const, amount: 100 } },
                            { level: 3, pointsRequired: 749, reward: { type: 'money' as const, amount: 100 } },
                            { level: 4, pointsRequired: 999, reward: { type: 'money' as const, amount: 100 } },
                            { level: 5, pointsRequired: 1000, reward: { type: 'money' as const, amount: 100 } }
                          ];
                          setEditingFanz({
                            ...template,
                            ferveurPath: template.ferveurPath && template.ferveurPath.length > 0 ? template.ferveurPath : defaultPath
                          });
                        }}
                      >
                        <td className="py-2 px-2">
                          <div className="w-10 h-10 rounded overflow-hidden">
                            {template.video ? (
                              <video src={getImageUrl(template.video)} className="w-full h-full object-cover" muted loop playsInline />
                            ) : (
                              <img src={getImageUrl(template.image)} className="w-full h-full object-cover" />
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs text-gray-400">{template.id}</td>
                        <td className="py-2 px-2" onClick={e => e.stopPropagation()}>
                          <input 
                            type="text" 
                            value={template.name} 
                            onChange={(e) => handleLocalFanzChange(template.id, { name: e.target.value })}
                            className="bg-transparent border-b border-dashed border-gray-600 focus:border-orange-500 focus:outline-none w-full font-bold px-1"
                          />
                        </td>
                        <td className="py-2 px-2" onClick={e => e.stopPropagation()}>
                          <select 
                            value={template.rarity}
                            onChange={(e) => handleLocalFanzChange(template.id, { rarity: e.target.value as any })}
                            className={`text-[10px] font-black uppercase px-2 py-1 rounded border-none appearance-none cursor-pointer outline-none ${
                              template.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-500' : template.rarity === 'epic' ? 'bg-purple-500/20 text-purple-500' : template.rarity === 'rare' ? 'bg-blue-500/20 text-blue-500' : 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            <option value="common" className="bg-gray-900">COMMON</option>
                            <option value="rare" className="bg-gray-900">RARE</option>
                            <option value="epic" className="bg-gray-900">EPIC</option>
                            <option value="legendary" className="bg-gray-900">LEGENDARY</option>
                          </select>
                        </td>
                        <td className="py-2 px-2 text-gray-400 font-bold text-center">{template.skins?.length || 0}</td>
                        <td className="py-2 px-2 text-gray-400 font-bold text-center">{template.emotes?.length || 0}</td>
                        <td className="py-2 px-2 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleLocalFanzChange(template.id, { isActive: template.isActive === false ? true : false })}
                            className={`text-[10px] font-black uppercase px-2 py-1 rounded transition-colors ${
                              template.isActive === false ? 'bg-red-500/20 text-red-500 hover:bg-red-500/40' : 'bg-green-500/20 text-green-500 hover:bg-green-500/40'
                            }`}
                          >
                            {template.isActive === false ? 'Inactif' : 'Actif'}
                          </button>
                        </td>
                        <td className="py-2 px-2" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            {isModified && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-green-500 hover:text-green-400 border-green-500/30 hover:bg-green-500/10 px-2"
                                onClick={(e) => handleQuickSaveFanz(e, template)}
                                title="Sauvegarder"
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-blue-500 hover:text-blue-400 border-blue-500/30 hover:bg-blue-500/10 px-2"
                              onClick={(e) => handleDuplicateFanz(e, template)}
                              title="Dupliquer"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-500 hover:text-red-400 border-red-500/30 hover:bg-red-500/10 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFanzTemplate(template.id);
                              }}
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )})}
                    {fanzTemplates.length === 0 && !loading && (
                      <tr className="border-b-0 h-32">
                        <td colSpan={8} className="text-center text-gray-500 py-8">
                          Aucun FANZ trouvé dans la base de données. Utilisez "Nouveau FANZ" pour commencer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {fanzFervorConfig && (
            <Card className="p-6 space-y-6 mt-12 bg-gray-900 border-orange-500/30">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black italic uppercase text-white flex items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-orange-500" />
                    Chemin de Ferveur FANZ
                  </h3>
                  <p className="text-sm text-gray-400">
                    Configuration globale servant de modèle par défaut pour tous les FANZ.
                  </p>
                </div>
                <Button 
                  onClick={handleSaveFanzFervorConfig} 
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black uppercase italic px-8 py-4 h-auto flex flex-col items-center gap-1 rounded-2xl shadow-xl shadow-orange-500/20"
                >
                  <Save className="w-6 h-6" />
                  <span className="text-xs">Sauvegarder</span>
                </Button>
              </div>

              <div className="mt-4">
                <FanzFerveurTable 
                  ranges={fanzFervorConfig.ranges || []} 
                  onChange={ranges => setFanzFervorConfig({ ...fanzFervorConfig, ranges })} 
                  fanzId="global" 
                  fanzTemplates={fanzTemplates}
                  lifeActions={lifeActions}
                  duelCards={duelCards}
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'shop' && shopConfig && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Packs Ferveur (Boutique)</h3>
              <Button onClick={() => handleSaveShopConfig(shopConfig)} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Sauvegarder la config
              </Button>
            </div>
            
            <div className="space-y-6">
              {shopConfig.ferveurPacks.map((pack: any, index: number) => (
                <div key={pack.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-white/5 border-white/10">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom du pack</label>
                    <input
                      type="text"
                      value={pack.name}
                      onChange={e => {
                        const newPacks = [...shopConfig.ferveurPacks];
                        newPacks[index].name = e.target.value;
                        setShopConfig({ ...shopConfig, ferveurPacks: newPacks });
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Prix (Gemmes)</label>
                    <input
                      type="number"
                      value={pack.price}
                      onChange={e => {
                        const newPacks = [...shopConfig.ferveurPacks];
                        newPacks[index].price = parseInt(e.target.value) || 0;
                        setShopConfig({ ...shopConfig, ferveurPacks: newPacks });
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nb. d'objets</label>
                    <input
                      type="number"
                      value={pack.numberOfRewards}
                      onChange={e => {
                        const newPacks = [...shopConfig.ferveurPacks];
                        newPacks[index].numberOfRewards = parseInt(e.target.value) || 1;
                        setShopConfig({ ...shopConfig, ferveurPacks: newPacks });
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      value={pack.description}
                      onChange={e => {
                        const newPacks = [...shopConfig.ferveurPacks];
                        newPacks[index].description = e.target.value;
                        setShopConfig({ ...shopConfig, ferveurPacks: newPacks });
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Boosts Management */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Boosts (Boutique)</h3>
              <Button onClick={() => handleSaveShopConfig(shopConfig)} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Sauvegarder la config
              </Button>
            </div>
            
            <div className="space-y-6">
              {(shopConfig.boosts || []).map((boost: any, index: number) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-white/5 border-white/10">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type d'effet</label>
                    <select
                      value={boost.id}
                      onChange={e => {
                        const newBoosts = [...(shopConfig.boosts || [])];
                        newBoosts[index].id = e.target.value;
                        if (e.target.value === 'b1') newBoosts[index].color = 'blue';
                        else if (e.target.value === 'b2') newBoosts[index].color = 'yellow';
                        else if (e.target.value === 'b3') newBoosts[index].color = 'green';
                        setShopConfig({ ...shopConfig, boosts: newBoosts });
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                    >
                      <option value="b1" className="bg-black">Boost XP x2</option>
                      <option value="b2" className="bg-black">Énergie Infinie</option>
                      <option value="b3" className="bg-black">Bouclier Anti-Malus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom affiché</label>
                    <input
                      type="text"
                      value={boost.name}
                      onChange={e => {
                        const newBoosts = [...(shopConfig.boosts || [])];
                        newBoosts[index].name = e.target.value;
                        setShopConfig({ ...shopConfig, boosts: newBoosts });
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Prix (Boosts)</label>
                    <input
                      type="number"
                      value={boost.price}
                      onChange={e => {
                        const newBoosts = [...(shopConfig.boosts || [])];
                        newBoosts[index].price = parseInt(e.target.value) || 0;
                        setShopConfig({ ...shopConfig, boosts: newBoosts });
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Durée (ex: 24h)</label>
                    <input
                      type="text"
                      value={boost.duration}
                      onChange={e => {
                        const newBoosts = [...(shopConfig.boosts || [])];
                        newBoosts[index].duration = e.target.value;
                        setShopConfig({ ...shopConfig, boosts: newBoosts });
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <Button 
                      onClick={() => {
                        const newBoosts = (shopConfig.boosts || []).filter((_: any, i: number) => i !== index);
                        setShopConfig({ ...shopConfig, boosts: newBoosts });
                      }}
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4 md:mr-2" /> <span className="md:inline hidden">Supprimer</span>
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  onClick={() => {
                    const newBoosts = [...(shopConfig.boosts || []), { id: `b1`, name: 'Boost XP x2', duration: '24h', price: 100, currency: 'boost', color: 'blue' }];
                    setShopConfig({ ...shopConfig, boosts: newBoosts });
                  }}
                  variant="outline"
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-2" /> Ajouter un Boost
                </Button>
              </div>
            </div>
          </Card>

          {/* Real Money Packs Management */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Packs Argent Réel (Boutique)</h3>
              <Button onClick={() => handleSaveShopConfig(shopConfig)} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Sauvegarder la config
              </Button>
            </div>
            
            <div className="space-y-6">
              {(shopConfig.realMoneyPacks || []).map((pack: any, index: number) => (
                <div key={index} className="flex flex-col gap-4 p-4 border rounded-lg bg-white/5 border-white/10">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">ID du pack</label>
                      <input
                        type="text"
                        value={pack.id}
                        onChange={e => {
                          const newPacks = [...(shopConfig.realMoneyPacks || [])];
                          newPacks[index].id = e.target.value;
                          setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                        }}
                        className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Nom affiché</label>
                      <input
                        type="text"
                        value={pack.name}
                        onChange={e => {
                          const newPacks = [...(shopConfig.realMoneyPacks || [])];
                          newPacks[index].name = e.target.value;
                          setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                        }}
                        className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Prix (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pack.priceEur}
                        onChange={e => {
                          const newPacks = [...(shopConfig.realMoneyPacks || [])];
                          newPacks[index].priceEur = parseFloat(e.target.value) || 0;
                          setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                        }}
                        className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Populaire ?</label>
                      <select
                        value={pack.popular ? 'yes' : 'no'}
                        onChange={e => {
                          const newPacks = [...(shopConfig.realMoneyPacks || [])];
                          newPacks[index].popular = e.target.value === 'yes';
                          setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                        }}
                        className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white"
                      >
                        <option value="no" className="bg-black">Non</option>
                        <option value="yes" className="bg-black">Oui</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Récompenses du pack</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex bg-black/50 rounded overflow-hidden border border-white/20">
                        <span className="bg-white/10 px-2 py-2 text-xs flex items-center justify-center font-bold">Argent ($)</span>
                        <input 
                          type="number" 
                          value={pack.rewards.find((r: any) => r.type === 'money')?.amount || 0}
                          onChange={e => {
                            const newPacks = [...(shopConfig.realMoneyPacks || [])];
                            let rewards = [...newPacks[index].rewards];
                            const moneyRew = rewards.find(r => r.type === 'money');
                            if (moneyRew) moneyRew.amount = parseInt(e.target.value) || 0;
                            else rewards.push({ type: 'money', amount: parseInt(e.target.value) || 0 });
                            newPacks[index].rewards = rewards.filter(r => r.amount && r.amount > 0);
                            setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                          }}
                          className="w-full bg-transparent px-2 text-white" 
                        />
                      </div>
                      <div className="flex bg-black/50 rounded overflow-hidden border border-white/20">
                        <span className="bg-white/10 px-2 py-2 text-xs flex items-center justify-center font-bold">Gemmes</span>
                        <input 
                          type="number" 
                          value={pack.rewards.find((r: any) => r.type === 'gems')?.amount || 0}
                          onChange={e => {
                            const newPacks = [...(shopConfig.realMoneyPacks || [])];
                            let rewards = [...newPacks[index].rewards];
                            const gemsRew = rewards.find(r => r.type === 'gems');
                            if (gemsRew) gemsRew.amount = parseInt(e.target.value) || 0;
                            else rewards.push({ type: 'gems', amount: parseInt(e.target.value) || 0 });
                            newPacks[index].rewards = rewards.filter(r => r.amount && r.amount > 0);
                            setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                          }}
                          className="w-full bg-transparent px-2 text-white" 
                        />
                      </div>
                      <div className="flex bg-black/50 rounded overflow-hidden border border-white/20">
                        <span className="bg-white/10 px-2 py-2 text-xs flex items-center justify-center font-bold">Points Boost</span>
                        <input 
                          type="number" 
                          value={pack.rewards.find((r: any) => r.type === 'boost')?.amount || 0}
                          onChange={e => {
                            const newPacks = [...(shopConfig.realMoneyPacks || [])];
                            let rewards = [...newPacks[index].rewards];
                            const boostRew = rewards.find(r => r.type === 'boost');
                            if (boostRew) boostRew.amount = parseInt(e.target.value) || 0;
                            else rewards.push({ type: 'boost', amount: parseInt(e.target.value) || 0 });
                            newPacks[index].rewards = rewards.filter(r => r.amount && r.amount > 0);
                            setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                          }}
                          className="w-full bg-transparent px-2 text-white" 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button 
                      onClick={() => {
                        const newPacks = (shopConfig.realMoneyPacks || []).filter((_: any, i: number) => i !== index);
                        setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                      }}
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Supprimer ce Pack
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  onClick={() => {
                    const newPacks = [...(shopConfig.realMoneyPacks || []), { 
                      id: `pack-${Date.now()}`, 
                      name: 'Nouveau Pack', 
                      priceEur: 9.99, 
                      rewards: [{ type: 'gems', amount: 100 }],
                      image: '💎',
                      bgColor: '#1e3a8a',
                      popular: false
                    }];
                    setShopConfig({ ...shopConfig, realMoneyPacks: newPacks });
                  }}
                  variant="outline"
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-2" /> Ajouter un Pack
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
