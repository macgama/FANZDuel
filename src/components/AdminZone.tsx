import React, { useState, useEffect } from 'react';
import { footballApi } from '../services/footballApi';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, collection, getDocs, writeBatch, deleteDoc, query, where, getDoc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { League, Team, Standing, Fixture, LifeAction, Card as DuelCard, FanzTemplate, FerveurLevel, RankReward, FanzStats, Fanz, UserProfile, Mission, Pass, GlobalFervorConfig, WeeklyStreakConfig, WeeklyStreakCycle, DuelConfig, FanzSkin, PassLevel } from '../types';
import { Database, Download, RefreshCw, CheckCircle, AlertCircle, Search, Plus, Save, Trash2, Activity, Video, Layers, Users, Trophy, Star, Shield, Brain, Eye, Info, Flame, MessageCircle, Calendar, Gift, Target, CreditCard, UserCog, List, LayoutGrid, ChevronUp, ChevronDown, Copy, Megaphone, Newspaper } from 'lucide-react';
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
import { translateCountryName } from '../utils/countryTranslations';
import { getSearchVariations } from '../utils/teamSearch';
import { logTransaction } from '../services/transactionService';

import { footballDataService } from '../services/footballDataService';

const getTranslationValue = (field: any, lang: string): string => {
  if (!field) return '';
  if (typeof field === 'string') {
    return lang === 'fr' ? field : '';
  }
  return field[lang] || '';
};

const setTranslationValue = (field: any, lang: string, value: string) => {
  if (!field || typeof field === 'string') {
    const frVal = typeof field === 'string' ? field : '';
    return { fr: frVal, en: '', es: '', [lang]: value };
  }
  return { ...field, [lang]: value };
};

const renderTrans = (field: any, preferredLang: string = 'fr'): string => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field[preferredLang] || field['fr'] || field['en'] || field['es'] || Object.values(field)[0] || '';
  }
  return String(field);
};

export function AdminZone() {
  const [activeTab, setActiveTab] = useState<'football' | 'lifeActions' | 'duelCards' | 'fanz' | 'users' | 'duelConfig' | 'shop' | 'news'>('football');
  const [activeUserSubTab, setActiveUserSubTab] = useState<'profiles' | 'fervor' | 'streak' | 'missions' | 'passes'>('profiles');
  const [confirmRecalculate, setConfirmRecalculate] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  
  // News state
  const [newsList, setNewsList] = useState<any[]>([]);
  const [editingNews, setEditingNews] = useState<any | null>(null);
  const [showCreateNewsModal, setShowCreateNewsModal] = useState(false);
  
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
  const [fanzEditLang, setFanzEditLang] = useState<'fr' | 'en' | 'es'>('fr');
  const [shopEditLang, setShopEditLang] = useState<'fr' | 'en' | 'es'>('fr');
  const [cardEditLang, setCardEditLang] = useState<'fr' | 'en' | 'es'>('fr');
  const [actionEditLang, setActionEditLang] = useState<'fr' | 'en' | 'es'>('fr');
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
  const [selectedUserForAdmin, setSelectedUserForAdmin] = useState<UserProfile | null>(null);
  const [userFanz, setUserFanz] = useState<Fanz[]>([]);
  const [loadingUserFanz, setLoadingUserFanz] = useState<boolean>(false);
  const [userAdminSearchTerm, setUserAdminSearchTerm] = useState<string>('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [userFervorConfig, setUserFervorConfig] = useState<GlobalFervorConfig | null>(null);
  const [fanzFervorConfig, setFanzFervorConfig] = useState<GlobalFervorConfig | null>(null);
  const [streakCycles, setStreakCycles] = useState<WeeklyStreakCycle[]>([]);
  const [editingCycle, setEditingCycle] = useState<WeeklyStreakCycle | null>(null);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [editingPass, setEditingPass] = useState<Pass | null>(null);
  const [shopConfig, setShopConfig] = useState<any | null>(null);

  // States et Effects de recherche d'équipes favorites pour l'administration
  const [cachedTeams, setCachedTeams] = useState<Record<string, {name: string, logo?: string}>>({});
  const [adminTeamSearchQuery, setAdminTeamSearchQuery] = useState('');
  const [adminTeamSearchResults, setAdminTeamSearchResults] = useState<any[]>([]);
  const [isAdminTeamSearching, setIsAdminTeamSearching] = useState(false);

  useEffect(() => {
    if (!selectedUserForAdmin?.favoriteTeams || selectedUserForAdmin.favoriteTeams.length === 0) return;
    const fetchFavoriteTeamsDetails = async () => {
      const favoriteTeams = selectedUserForAdmin.favoriteTeams;
      const newCached = { ...cachedTeams };
      let changed = false;

      for (const teamId of favoriteTeams) {
        if (!teamId) continue;
        const idStr = teamId.toString();
        if (!newCached[idStr]) {
          try {
            const teamDoc = await getDoc(doc(db, 'teams', idStr));
            if (teamDoc.exists()) {
              newCached[idStr] = {
                name: teamDoc.data().name || idStr,
                logo: teamDoc.data().logo
              };
              changed = true;
            } else {
              if (!isNaN(Number(idStr))) {
                try {
                  const res = await footballApi.getTeamInfo(Number(idStr));
                  if (res && res.team) {
                    newCached[idStr] = {
                      name: res.team.name,
                      logo: res.team.logo
                    };
                    await setDoc(doc(db, 'teams', idStr), {
                      name: res.team.name,
                      logo: res.team.logo,
                      updatedAt: new Date().toISOString()
                    }, { merge: true });
                    changed = true;
                  }
                } catch (apiErr) {
                  console.error(`Error resolving team from API for ${idStr}:`, apiErr);
                }
              } else {
                newCached[idStr] = { name: idStr };
                changed = true;
              }
            }
          } catch (err) {
            console.error(`Error loading team doc for ${idStr}:`, err);
          }
        }
      }

      if (changed) {
        setCachedTeams(newCached);
      }
    };

    fetchFavoriteTeamsDetails();
  }, [selectedUserForAdmin?.favoriteTeams]);

  useEffect(() => {
    const search = async () => {
      if (adminTeamSearchQuery.length < 3) {
        setAdminTeamSearchResults([]);
        return;
      }
      setIsAdminTeamSearching(true);
      try {
        const variations = getSearchVariations(adminTeamSearchQuery);
        let results: any[] = [];
        const queryPromises = variations.map(v => footballApi.searchTeams(v).catch(() => []));
        const allRes = await Promise.all(queryPromises);
        const seenIds = new Set<number>();
        allRes.forEach((resList) => {
          if (resList) {
            resList.forEach((item: any) => {
              if (item?.team?.id && !seenIds.has(item.team.id)) {
                seenIds.add(item.team.id);
                results.push(item);
              }
            });
          }
        });
        setAdminTeamSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setIsAdminTeamSearching(false);
      }
    };

    const timeoutId = setTimeout(search, 500);
    return () => clearTimeout(timeoutId);
  }, [adminTeamSearchQuery]);



  const fetchNews = async () => {
    try {
      setStatus({ type: 'loading', message: 'Chargement des actualités...' });
      setLoading(true);
      const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNewsList(list);
      setStatus({ type: 'success', message: 'Actualités chargées avec succès !' });
    } catch (error) {
      console.error("fetchNews error:", error);
      setStatus({ type: 'error', message: 'Erreur lors du chargement des actualités.' });
      handleFirestoreError(error, OperationType.GET, 'news');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNews = async (newsData: any) => {
    if (!newsData.title || !newsData.message) {
      setStatus({ type: 'error', message: 'Veuillez remplir le titre et le message.' });
      return;
    }
    setLoading(true);
    setStatus({ type: 'loading', message: "Enregistrement de l'actualité..." });
    try {
      const docRef = doc(db, 'news', newsData.id);
      await setDoc(docRef, {
        ...newsData,
        createdAt: newsData.createdAt || new Date().toISOString(),
        isActive: newsData.isActive !== false
      });
      setStatus({ type: 'success', message: 'Actualité enregistrée avec succès !' });
      setShowCreateNewsModal(false);
      setEditingNews(null);
      await fetchNews();
    } catch (error) {
      console.error("handleSaveNews error:", error);
      setStatus({ type: 'error', message: "Erreur lors de l'enregistrement de l'actualité." });
      handleFirestoreError(error, OperationType.WRITE, `news/${newsData.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNews = async (newsId: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette actualité ?')) return;
    setLoading(true);
    setStatus({ type: 'loading', message: "Suppression de l'actualité..." });
    try {
      await deleteDoc(doc(db, 'news', newsId));
      setStatus({ type: 'success', message: 'Actualité supprimée !' });
      await fetchNews();
    } catch (error) {
      console.error("handleDeleteNews error:", error);
      setStatus({ type: 'error', message: "Erreur lors de la suppression." });
      handleFirestoreError(error, OperationType.DELETE, `news/${newsId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNewsActive = async (newsItem: any) => {
    setLoading(true);
    setStatus({ type: 'loading', message: 'Mise à jour du statut...' });
    try {
      const docRef = doc(db, 'news', newsItem.id);
      const newStatus = newsItem.isActive === false ? true : false;
      await updateDoc(docRef, { isActive: newStatus });
      setStatus({ type: 'success', message: 'Statut mis à jour !' });
      await fetchNews();
    } catch (error) {
      console.error("handleToggleNewsActive error:", error);
      setStatus({ type: 'error', message: 'Erreur lors de la mise à jour.' });
      handleFirestoreError(error, OperationType.UPDATE, `news/${newsItem.id}`);
    } finally {
      setLoading(false);
    }
  };

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
    } else if (activeTab === 'news') {
      fetchNews();
      if (fanzTemplates.length === 0) fetchFanzTemplates();
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
      if (selectedUserForAdmin?.uid === uid) {
        refreshSelectedUser(uid);
      }
    } catch (err) {
      console.error("Error updating user role", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserFanz = async (uid: string) => {
    setLoadingUserFanz(true);
    try {
      const q = query(collection(db, 'fanz'), where('ownerUid', '==', uid));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fanz));
      setUserFanz(list);
    } catch (err) {
      console.error("Error loading user fanz", err);
      handleFirestoreError(err, OperationType.GET, 'fanz');
    } finally {
      setLoadingUserFanz(false);
    }
  };

  const handleAddFanzToUser = async (templateId: string) => {
    if (!selectedUserForAdmin) return;
    const template = fanzTemplates.find(t => t.id === templateId);
    if (!template) return;

    setLoading(true);
    try {
      const newFanzId = `fanz-${Date.now()}`;
      const newFanz = {
        id: newFanzId,
        templateId: templateId,
        ownerUid: selectedUserForAdmin.uid,
        name: template.name,
        sport: template.sport || 'Football',
        imageUrl: template.image || '',
        videoUrl: template.video || '',
        stats: template.baseStats || { force: 10, endurance: 10, mental: 10, bluff: 10, creativity: 10, social: 10, intelligence: 10, charisma: 10 },
        xp: 0,
        level: 1,
        rank: 1,
        ferveurPoints: 0,
        ferveurLevel: 1,
        energy: 100,
        equippedCards: [],
        deck: [],
        unlockedSkins: [],
        unlockedEmotes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'fanz', newFanzId), newFanz);
      setStatus({ type: 'success', message: `FANZ ${template.name} attribué avec succès !` });
      fetchUserFanz(selectedUserForAdmin.uid);
    } catch (err) {
      console.error("Error adding fanz", err);
      handleFirestoreError(err, OperationType.WRITE, `fanz`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUserFanzItem = async (fanzId: string) => {
    if (!selectedUserForAdmin) return;
    if (!window.confirm("Voulez-vous vraiment supprimer définitivement cette carte FANZ du compte de l'utilisateur ?")) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'fanz', fanzId));
      setStatus({ type: 'success', message: 'Carte FANZ retirée avec succès !' });
      fetchUserFanz(selectedUserForAdmin.uid);
    } catch (err) {
      console.error("Error deleting user fanz", err);
      handleFirestoreError(err, OperationType.DELETE, `fanz/${fanzId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserFanzItem = async (fanzId: string, updates: Partial<Fanz>) => {
    if (!selectedUserForAdmin) return;

    setLoading(true);
    try {
      const fanzRef = doc(db, 'fanz', fanzId);
      await updateDoc(fanzRef, updates);
      setStatus({ type: 'success', message: 'Statistiques du FANZ mises à jour !' });
      fetchUserFanz(selectedUserForAdmin.uid);
    } catch (err) {
      console.error("Error updating user fanz", err);
      handleFirestoreError(err, OperationType.WRITE, `fanz/${fanzId}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshSelectedUser = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const updatedUser = { ...snap.data() } as UserProfile;
        setSelectedUserForAdmin(updatedUser);
        setUsers(prev => prev.map(u => u.uid === uid ? updatedUser : u));
      }
    } catch (err) {
      console.error("Error refreshing selected user", err);
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

  const handleTranslateEmotes = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir traduire automatiquement le nom de toutes les emotes de tous les FANZ ?")) return;
    setLoading(true);
    setStatus({ type: 'info', message: 'Traduction des emotes en cours...' });
    
    const EMOTE_TRANSLATIONS: Record<string, {en: string, es: string}> = {
      'pleure': { en: 'Cry', es: 'Llora' },
      'rigole': { en: 'Laugh', es: 'Ríe' },
      'colère': { en: 'Angry', es: 'Enfadado' },
      'dégoût': { en: 'Disgust', es: 'Asco' },
      'dort': { en: 'Sleep', es: 'Duerme' },
      'surpris': { en: 'Surprised', es: 'Sorprendido' },
      'confus': { en: 'Confused', es: 'Confuso' },
      'peur': { en: 'Scared', es: 'Miedo' },
      'triste': { en: 'Sad', es: 'Triste' },
      'heureux': { en: 'Happy', es: 'Feliz' },
      'content': { en: 'Happy', es: 'Feliz' },
      'choqué': { en: 'Shocked', es: 'Conmocionado' },
      "clin d'oeil": { en: 'Wink', es: 'Guiño' },
      'bisou': { en: 'Kiss', es: 'Beso' },
      'fête': { en: 'Party', es: 'Fiesta' },
      'applaudit': { en: 'Clap', es: 'Aplaude' },
      'gêné': { en: 'Embarrassed', es: 'Avergonzado' },
      'siffle': { en: 'Whistle', es: 'Silba' },
      'furieux': { en: 'Furious', es: 'Furioso' },
      'love': { en: 'Love', es: 'Amor' },
      'cool': { en: 'Cool', es: 'Genial' },
      'mort': { en: 'Dead', es: 'Muerto' }
    };

    try {
      let updatedCount = 0;
      for (const fanz of fanzTemplates) {
        if (!fanz.emotes || fanz.emotes.length === 0) continue;
        
        let changed = false;
        const newEmotes = fanz.emotes.map((emote: any) => {
          if (typeof emote.name === 'string') {
            const frName = emote.name.trim();
            const lower = frName.toLowerCase();
            const trans = EMOTE_TRANSLATIONS[lower];
            
            changed = true;
            if (trans) {
              return { ...emote, name: { fr: frName, en: trans.en, es: trans.es } };
            } else {
              return { ...emote, name: { fr: frName, en: frName, es: frName } };
            }
          }
          return emote;
        });
        
        if (changed) {
          await updateDoc(doc(db, 'fanz_templates', fanz.id), { emotes: newEmotes });
          updatedCount++;
        }
      }
      setStatus({ type: 'success', message: `${updatedCount} modèles FANZ mis à jour avec les traductions d'emotes !` });
      fetchFanzTemplates(); // Reload to see changes
    } catch (err) {
      console.error("Error translating emotes", err);
      setStatus({ type: 'error', message: 'Erreur lors de la traduction des emotes.' });
    } finally {
      setLoading(false);
    }
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
    setLoading(true);
    setStatus({ type: 'info', message: `${!currentStatus ? 'Activation' : 'Désactivation'} de la compétition ${leagueName}...` });
    try {
      const leagueRef = doc(db, 'leagues', leagueId.toString());
      await setDoc(leagueRef, { isActive: !currentStatus }, { merge: true });
      
      setLeagues(prev => prev.map(l => {
        if (l.league.id === leagueId) {
          return { ...l, league: { ...l.league, isActive: !currentStatus } };
        }
        return l;
      }));

      setStatus({ type: 'success', message: `Compétition ${leagueId} ${!currentStatus ? 'activée' : 'désactivée'}.` });
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
    .filter(l => l.league.name.toLowerCase().includes(searchTerm.toLowerCase()) || translateCountryName(l.country.name).toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      let valA, valB;
      switch (leagueSort.column) {
        case 'id': valA = a.league.id; valB = b.league.id; break;
        case 'name': valA = a.league.name; valB = b.league.name; break;
        case 'country': valA = translateCountryName(a.country.name); valB = translateCountryName(b.country.name); break;
        case 'season': valA = getSeasonStatusValue(a, selectedSeason); valB = getSeasonStatusValue(b, selectedSeason); break;
        case 'status': valA = a.league.isActive ? 1 : 0; valB = b.league.isActive ? 1 : 0; break;
        default: valA = translateCountryName(a.country.name); valB = translateCountryName(b.country.name); break;
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
        <button
          className={`pb-2 px-4 font-bold ${activeTab === 'news' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('news')}
        >
          ACTUALITÉS
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
            <div className="space-y-6">
              {!selectedUserForAdmin ? (
                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                          <Users className="w-5 h-5 text-blue-500" /> Gestion des Utilisateurs
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">Recherchez et gérez les comptes, les avoirs, les bannissements et les collections des joueurs.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="shrink-0 bg-gray-900 border-white/10 hover:bg-white/5">
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
                      </Button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Rechercher par pseudo ou adresse email..."
                        value={userAdminSearchTerm}
                        onChange={(e) => setUserAdminSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all font-sans"
                      />
                    </div>

                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <th className="py-3 px-4 text-white">Utilisateur</th>
                            <th className="py-3 px-4">Adresse Email</th>
                            <th className="py-3 px-4 text-center">Rôle</th>
                            <th className="py-3 px-4 text-center font-mono">Pièces & Gemmes</th>
                            <th className="py-3 px-4 text-center">Statut</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {users
                            .filter(user => 
                              (user.pseudo || '').toLowerCase().includes(userAdminSearchTerm.toLowerCase()) ||
                              (user.email || '').toLowerCase().includes(userAdminSearchTerm.toLowerCase())
                            )
                            .map(user => (
                              <tr key={user.uid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm uppercase">
                                      {(user.pseudo || user.displayName || 'U').charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="font-bold text-white text-xs sm:text-sm uppercase italic tracking-wide">{user.pseudo || 'Sans Pseudo'}</span>
                                      <span className="text-[9px] font-mono text-gray-500">UID: {user.uid.substring(0, 10)}...</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-xs text-gray-300 font-sans">{user.email}</td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    user.role === 'admin' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                    user.role === 'moderator' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                    'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  }`}>
                                    {user.role || 'client'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center text-xs font-mono font-bold text-orange-400">
                                  🪙 {user.money?.toLocaleString() || 0} / 💎 {user.gems?.toLocaleString() || 0}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {user.isBanned ? (
                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600 text-white animate-pulse">
                                      BANNI
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                                      Actif
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Button 
                                    size="sm" 
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase italic text-[10px] tracking-wider py-1 px-3 h-8"
                                    onClick={() => {
                                      setSelectedUserForAdmin(user);
                                      fetchUserFanz(user.uid);
                                    }}
                                  >
                                    <UserCog className="w-3.5 h-3.5 mr-1" /> Administrer
                                  </Button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Banner / Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-950 p-6 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">{selectedUserForAdmin.pseudo || 'Joueur'}</h2>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase italic ${selectedUserForAdmin.role === 'admin' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                          {selectedUserForAdmin.role || 'client'}
                        </span>
                        {selectedUserForAdmin.isBanned && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-700 text-white">Banni</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span>Email : <strong className="text-white font-sans">{selectedUserForAdmin.email}</strong></span>
                        <span className="hidden md:inline font-mono text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-500">UID : {selectedUserForAdmin.uid}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => refreshSelectedUser(selectedUserForAdmin.uid)} className="bg-gray-900 border-white/10 hover:bg-white/5 h-10 px-4">
                        <RefreshCw className="w-4 h-4 mr-1 text-gray-400" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedUserForAdmin(null)}
                        className="bg-gray-900 border-white/10 text-white hover:bg-white/5 font-black uppercase italic tracking-wider h-10 px-4"
                      >
                        Retour à la liste
                      </Button>
                    </div>
                  </div>

                  {/* Actions Rapides & Modératrices */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6 space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Statut & Modération
                      </h4>
                      <p className="text-xs text-gray-400">Contrôlez les autorisations et le niveau d'accès du compte.</p>
                      
                      <div className="flex flex-wrap gap-3 pt-2">
                        {/* Ban / Unban */}
                        <button
                          onClick={async () => {
                            const newStatus = !selectedUserForAdmin.isBanned;
                            await setDoc(doc(db, 'users', selectedUserForAdmin.uid), { isBanned: newStatus }, { merge: true });
                            setStatus({ type: 'success', message: `Le compte a été ${newStatus ? 'Banni' : 'Débanni'} !` });
                            refreshSelectedUser(selectedUserForAdmin.uid);
                          }}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider italic text-xs transition duration-200 cursor-pointer border ${
                            selectedUserForAdmin.isBanned
                              ? 'bg-green-600/25 border-green-500/40 text-green-400 hover:bg-green-600/40' 
                              : 'bg-red-600/25 border-red-500/40 text-red-400 hover:bg-red-600/40'
                          }`}
                        >
                          {selectedUserForAdmin.isBanned ? 'Débannir le Compte' : 'Bannir le Compte'}
                        </button>

                        {/* Mute / Unmute */}
                        <button
                          onClick={async () => {
                            const newStatus = !selectedUserForAdmin.isMuted;
                            await setDoc(doc(db, 'users', selectedUserForAdmin.uid), { isMuted: newStatus }, { merge: true });
                            setStatus({ type: 'success', message: `${newStatus ? 'Sourdine activée' : 'Partie vocale réactivée'} !` });
                            refreshSelectedUser(selectedUserForAdmin.uid);
                          }}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider italic text-xs transition duration-200 cursor-pointer border ${
                            selectedUserForAdmin.isMuted
                              ? 'bg-purple-600/25 border-purple-500/40 text-purple-400 hover:bg-purple-600/40' 
                              : 'bg-gray-800 border-white/10 text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          {selectedUserForAdmin.isMuted ? 'Enlever Sourdine' : 'Mettre en Sourdine'}
                        </button>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Attribuer un Rôle de sécurité :</label>
                        <select
                          value={selectedUserForAdmin.role || 'client'}
                          onChange={(e) => handleUpdateUserRole(selectedUserForAdmin.uid, e.target.value as any)}
                          className="w-full p-2.5 bg-black border border-white/10 rounded-xl text-sm font-bold text-white uppercase italic tracking-wide"
                        >
                          <option value="client">Client (Joueur normal)</option>
                          <option value="moderator">Modérateur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </div>
                    </Card>

                    {/* Quick Adjustments */}
                    <Card className="p-6 space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Ajusteurs Rapides d'Économie
                      </h4>
                      <p className="text-xs text-gray-400">Appliquez des actions prédéfinies d'ajustement de ressources.</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        <Button 
                          onClick={async () => {
                            const userRef = doc(db, 'users', selectedUserForAdmin.uid);
                            const maxEn = selectedUserForAdmin.maxEnergy || 100;
                            await setDoc(userRef, { energy: maxEn }, { merge: true });
                            await logTransaction(selectedUserForAdmin.uid, 'energy', maxEn - (selectedUserForAdmin.energy || 0), 'Recharge complète énergie admin');
                            setStatus({ type: 'success', message: 'Énergie rechargée à son maximum !' });
                            refreshSelectedUser(selectedUserForAdmin.uid);
                          }}
                          className="bg-blue-600/10 border-blue-500/20 text-blue-400 text-xs font-bold font-sans uppercase italic h-11 hover:bg-blue-600/20"
                        >
                          ⚡ Énergie à 100%
                        </Button>

                        <Button 
                          onClick={async () => {
                            const userRef = doc(db, 'users', selectedUserForAdmin.uid);
                            await setDoc(userRef, { 
                              money: (selectedUserForAdmin.money || 0) + 1000,
                              gems: (selectedUserForAdmin.gems || 0) + 100
                            }, { merge: true });
                            await logTransaction(selectedUserForAdmin.uid, 'money', 1000, 'Pack Admin Rapide : Argent');
                            await logTransaction(selectedUserForAdmin.uid, 'gems', 100, 'Pack Admin Rapide : Gemmes');
                            setStatus({ type: 'success', message: '+1000 Argent & +100 Gemmes ajoutés !' });
                            refreshSelectedUser(selectedUserForAdmin.uid);
                          }}
                          className="bg-yellow-500/10 border-yellow-500/20 text-yellow-400 text-xs font-bold font-sans uppercase italic h-11 hover:bg-yellow-500/20"
                        >
                          🪙 +1K Argent & 100 💎
                        </Button>

                        <Button 
                          onClick={async () => {
                            const userRef = doc(db, 'users', selectedUserForAdmin.uid);
                            const newFerv = (selectedUserForAdmin.ferveurPoints || 0) + 500;
                            // Estimate level increment
                            const currentLvl = selectedUserForAdmin.level || 1;
                            const nextLvl = Math.floor(newFerv / 1000) + 1;
                            await setDoc(userRef, { 
                              ferveurPoints: newFerv,
                              level: nextLvl > currentLvl ? nextLvl : currentLvl
                            }, { merge: true });
                            await logTransaction(selectedUserForAdmin.uid, 'ferveur_general', 500, 'Ferveur ajoutée par admin');
                            setStatus({ type: 'success', message: '+500 Ferveur générale ajoutée !' });
                            refreshSelectedUser(selectedUserForAdmin.uid);
                          }}
                          className="bg-red-500/10 border-red-500/20 text-red-400 text-xs font-bold font-sans uppercase italic h-11 hover:bg-red-500/20"
                        >
                          🔥 +500 Ferveur
                        </Button>

                        <Button 
                          onClick={async () => {
                            if (!window.confirm("Voulez-vous débloquer l'ensemble des skins, emotes et cartes duel pour ce joueur ?")) return;
                            const allSkins: string[] = [];
                            const allEmotes: string[] = [];
                            fanzTemplates.forEach(t => {
                              t.skins?.forEach(s => allSkins.push(s.id));
                              t.emotes?.forEach(e => allEmotes.push(e.id));
                            });
                            const allCards = BASE_CARDS.map(c => c.id);

                            await setDoc(doc(db, 'users', selectedUserForAdmin.uid), {
                              skins: Array.from(new Set([...(selectedUserForAdmin.skins || []), ...allSkins])),
                              emotes: Array.from(new Set([...(selectedUserForAdmin.emotes || []), ...allEmotes])),
                              cards: Array.from(new Set([...(selectedUserForAdmin.cards || []), ...allCards]))
                            }, { merge: true });

                            setStatus({ type: 'success', message: 'Toutes les collections ont été débloquées !' });
                            refreshSelectedUser(selectedUserForAdmin.uid);
                          }}
                          className="bg-purple-500/10 border-purple-500/20 text-purple-400 text-xs font-bold font-sans uppercase italic h-11 hover:bg-purple-500/20 animate-pulse"
                        >
                          ⭐️ Tout débloquer (Skins/Emotes)
                        </Button>
                      </div>
                    </Card>
                  </div>

                  {/* Formulaire complet d'Avoirs / Argent et Energie */}
                  <Card className="p-6">
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const moneyVal = Number(formData.get('money'));
                        const gemsVal = Number(formData.get('gems'));
                        const boostVal = Number(formData.get('boostPoints'));
                        const energyVal = Number(formData.get('energy'));
                        const maxEnVal = Number(formData.get('maxEnergy'));
                        const fervorVal = Number(formData.get('ferveurPoints'));
                        const levelVal = Number(formData.get('level'));
                        const teamSlotsVal = Number(formData.get('teamSlots'));

                        const prevMoney = selectedUserForAdmin.money || 0;
                        const prevGems = selectedUserForAdmin.gems || 0;
                        const prevBoost = selectedUserForAdmin.boostPoints || 0;
                        const prevEnergy = selectedUserForAdmin.energy || 0;
                        const prevFervor = selectedUserForAdmin.ferveurPoints || 0;

                        setLoading(true);
                        try {
                          if (moneyVal !== prevMoney) await logTransaction(selectedUserForAdmin.uid, 'money', moneyVal - prevMoney, 'Modification Admin d\'Avoir');
                          if (gemsVal !== prevGems) await logTransaction(selectedUserForAdmin.uid, 'gems', gemsVal - prevGems, 'Modification Admin d\'Avoir');
                          if (boostVal !== prevBoost) await logTransaction(selectedUserForAdmin.uid, 'boost', boostVal - prevBoost, 'Modification Admin d\'Avoir');
                          if (energyVal !== prevEnergy) await logTransaction(selectedUserForAdmin.uid, 'energy', energyVal - prevEnergy, 'Modification Admin d\'Avoir');
                          if (fervorVal !== prevFervor) await logTransaction(selectedUserForAdmin.uid, 'ferveur_general', fervorVal - prevFervor, 'Modification Admin de Ferveur');

                          await setDoc(doc(db, 'users', selectedUserForAdmin.uid), {
                            money: moneyVal,
                            gems: gemsVal,
                            boostPoints: boostVal,
                            energy: energyVal,
                            maxEnergy: maxEnVal,
                            ferveurPoints: fervorVal,
                            level: levelVal,
                            teamSlots: teamSlotsVal
                          }, { merge: true });

                          setStatus({ type: 'success', message: 'Avoirs et ressources sauvegardés avec succès !' });
                          refreshSelectedUser(selectedUserForAdmin.uid);
                        } catch (err) {
                          console.error(err);
                          handleFirestoreError(err, OperationType.WRITE, `users/${selectedUserForAdmin.uid}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <h4 className="text-sm font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Gérer Ressources & Économie Générale
                      </h4>
                      <p className="text-xs text-gray-400">Modifiez précisément les valeurs bancaires, d'énergie, de ferveur et de niveau du profil.</p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Argent 🪙</label>
                          <input 
                            type="number" 
                            name="money" 
                            defaultValue={selectedUserForAdmin.money || 0}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-sm font-mono text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Gemmes 💎</label>
                          <input 
                            type="number" 
                            name="gems" 
                            defaultValue={selectedUserForAdmin.gems || 0}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-sm font-mono text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Points Boost ⭐</label>
                          <input 
                            type="number" 
                            name="boostPoints" 
                            defaultValue={selectedUserForAdmin.boostPoints || 0}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-sm font-mono text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Énergie Joueur ⚡</label>
                          <input 
                            type="number" 
                            name="energy" 
                            defaultValue={selectedUserForAdmin.energy || 0}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-sm font-mono text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Énergie Max Joueur</label>
                          <input 
                            type="number" 
                            name="maxEnergy" 
                            defaultValue={selectedUserForAdmin.maxEnergy || 100}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-sm font-mono text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">XP Ferveur Général 🔥</label>
                          <input 
                            type="number" 
                            name="ferveurPoints" 
                            defaultValue={selectedUserForAdmin.ferveurPoints || 0}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-sm font-mono text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Niveau Général</label>
                          <input 
                            type="number" 
                            name="level" 
                            defaultValue={selectedUserForAdmin.level || 1}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-sm font-mono text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre Slots Équipe</label>
                          <input 
                            type="number" 
                            name="teamSlots" 
                            defaultValue={selectedUserForAdmin.teamSlots || 5}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-sm font-mono text-white" 
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={loading} className="font-bold uppercase italic tracking-widest bg-yellow-500 hover:bg-yellow-600 text-black">
                          <Save className="w-4 h-4 mr-2" /> Enregistrer les Ressources de l'Utilisateur
                        </Button>
                      </div>
                    </form>
                  </Card>

                  {/* Gestion des Équipes Favorites */}
                  <Card className="p-6 space-y-4">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                        <Trophy className="w-4 h-4" /> Équipes Favorites ({selectedUserForAdmin.favoriteTeams?.length || 0} / {selectedUserForAdmin.teamSlots || 5})
                      </h4>
                      <p className="text-xs text-gray-400">Modifiez le catalogue des clubs supportés par l'utilisateur.</p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {(selectedUserForAdmin.favoriteTeams || []).map(teamId => {
                        const idStr = teamId.toString();
                        const teamInfo = cachedTeams[idStr];
                        return (
                          <div key={teamId} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 border border-white/10 text-white font-bold uppercase italic text-[10px]">
                            {teamInfo?.logo && (
                              <img 
                                src={getImageUrl(teamInfo.logo, 40)} 
                                alt="" 
                                className="w-4 h-4 object-contain" 
                                referrerPolicy="no-referrer" 
                              />
                            )}
                            <span>{teamInfo?.name ? translateCountryName(teamInfo.name) : idStr}</span>
                            <span className="text-white/30 text-[8px] font-mono">({idStr})</span>
                            <button 
                              onClick={async () => {
                                const updated = (selectedUserForAdmin.favoriteTeams || []).filter(id => id !== teamId);
                                await setDoc(doc(db, 'users', selectedUserForAdmin.uid), { favoriteTeams: updated }, { merge: true });
                                setStatus({ type: 'success', message: 'Équipe favorite retirée !' });
                                refreshSelectedUser(selectedUserForAdmin.uid);
                              }}
                              className="text-red-500 hover:text-red-400 cursor-pointer ml-1 font-sans"
                              title="Retirer cette équipe"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                      {(selectedUserForAdmin.favoriteTeams || []).length === 0 && (
                        <div className="text-gray-500 text-xs italic">Aucune équipe favorite enregistrée.</div>
                      )}
                    </div>

                    {/* Dynamic Team Search (Same as FavoriteTeamsPage) */}
                    <div className="pt-4 border-t border-white/5 space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                          <Search className="w-3 h-3" /> Rechercher et ajouter une équipe :
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="text"
                            value={adminTeamSearchQuery}
                            onChange={(e) => setAdminTeamSearchQuery(e.target.value)}
                            placeholder="Entrez le nom d'un club ou pays (ex: Paris, Real, Marseille, France...)"
                            className="w-full bg-black border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>

                      {isAdminTeamSearching && (
                        <div className="text-center py-4 text-gray-500 font-bold animate-pulse text-xs uppercase tracking-widest italic col-span-full">
                          Recherche en cours...
                        </div>
                      )}

                      {adminTeamSearchResults.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                          {adminTeamSearchResults.map((result) => {
                            const resultIdStr = result.team.id.toString();
                            const isAlreadyFav = selectedUserForAdmin?.favoriteTeams?.some(t => t.toString() === resultIdStr);
                            
                            return (
                              <div 
                                key={result.team.id}
                                className="bg-black/40 border border-white/10 rounded-xl p-2.5 flex items-center justify-between hover:border-blue-500/50 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 shrink-0 bg-white/5 rounded-lg p-1 flex items-center justify-center">
                                    <img src={getImageUrl(result.team.logo, 60)} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  </div>
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-white text-xs truncate">{translateCountryName(result.team.name)}</h5>
                                    <p className="text-[10px] text-gray-500 truncate">{translateCountryName(result.team.country)}</p>
                                  </div>
                                </div>
                                <Button 
                                  onClick={async () => {
                                    if (isAlreadyFav) return;
                                    const favoriteTeams = selectedUserForAdmin.favoriteTeams || [];
                                    const updated = [...favoriteTeams, resultIdStr];
                                    
                                    // Instantly update local cache state
                                    setCachedTeams(prev => ({
                                      ...prev,
                                      [resultIdStr]: {
                                        name: result.team.name,
                                        logo: result.team.logo
                                      }
                                    }));
                                    
                                    // Fetch leagues and create/update team record in Firestore teams collection
                                    try {
                                      const teamRef = doc(db, 'teams', resultIdStr);
                                      const teamDoc = await getDoc(teamRef);
                                      if (!teamDoc.exists()) {
                                        let leagueIds: number[] = [];
                                        try {
                                          const leaguesData = await footballApi.getLeaguesByTeam(result.team.id);
                                          leagueIds = leaguesData.map((l: any) => l.league.id);
                                        } catch (e) {
                                          console.error("Failed to fetch leagues in admin", e);
                                        }
                                        await setDoc(teamRef, {
                                          name: result.team.name,
                                          logo: result.team.logo,
                                          userCount: 1,
                                          averageFerveur: 10,
                                          ferveurEarned: 0,
                                          totalScoreGiven: 0,
                                          matchesPlayed: 0,
                                          leagueIds: leagueIds,
                                          updatedAt: new Date().toISOString()
                                        });
                                      }
                                    } catch (saveErr) {
                                      console.error("Error creating/updating team doc:", saveErr);
                                    }

                                    await setDoc(doc(db, 'users', selectedUserForAdmin.uid), { favoriteTeams: updated }, { merge: true });
                                    setStatus({ type: 'success', message: `${result.team.name} ajouté aux favoris de l'utilisateur !` });
                                    refreshSelectedUser(selectedUserForAdmin.uid);
                                    setAdminTeamSearchQuery('');
                                    setAdminTeamSearchResults([]);
                                  }}
                                  disabled={isAlreadyFav}
                                  className={`shrink-0 ml-2 font-extrabold uppercase text-[9px] px-2.5 py-1.5 h-auto ${
                                    isAlreadyFav 
                                      ? 'bg-gray-800 text-gray-500 border-transparent cursor-not-allowed' 
                                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                                  }`}
                                >
                                  {isAlreadyFav ? 'Acquis' : 'Ajouter'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Gestion des FANZ (Ferveur par fanz, etc.) */}
                  <Card className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
                          <Flame className="w-5 h-5 text-orange-500" /> Cartes Fanz du Joueur & Ferveur de FANZ
                        </h4>
                        <p className="text-xs text-gray-400">Gérez le niveau d'XP de combat (XP), le rang de carte, les points de ferveur spécifiques et le niveau de ferveur pour chaque carte FANZ appartenant à l'utilisateur.</p>
                      </div>
                      <div className="w-64 space-y-1 shrink-0">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Attribuer un nouveau FANZ :</label>
                        <select
                          onChange={async (e) => {
                            const val = e.target.value;
                            if (!val) return;
                            await handleAddFanzToUser(val);
                            e.target.value = '';
                          }}
                          className="w-full p-2 bg-black border border-white/10 rounded-lg text-xs font-bold text-white uppercase italic"
                        >
                          <option value="">-- Choisir un FANZ à injecter --</option>
                          {fanzTemplates
                            .filter(t => !userFanz.find(f => f.templateId === t.id))
                            .map(t => (
                              <option key={t.id} value={t.id}>{renderTrans(t.name)} (Rareté : {t.rarity || 'commune'})</option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {loadingUserFanz ? (
                      <div className="flex justify-center py-6">
                        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                      </div>
                    ) : userFanz.length === 0 ? (
                      <div className="text-center text-sm py-8 text-gray-500 bg-black/40 border border-white/5 rounded-2xl border-dashed">
                        Cet utilisateur ne possède pas encore de cartes FANZ. Sélectionnez un FANZ dans le menu ci-dessus pour lui en assigner un.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {userFanz.map(fanz => {
                          const template = fanzTemplates.find(t => t.id === fanz.templateId);
                          return (
                            <div key={fanz.id} className="bg-black/60 border border-white/10 rounded-2xl p-5 space-y-4 hover:border-orange-500/30 transition shadow-xl relative overflow-hidden flex flex-col justify-between">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-2xl rounded-full" />
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 relative z-10">
                                  <img 
                                    src={fanz.imageUrl || template?.image || ''} 
                                    alt="" 
                                    className="w-12 h-12 object-contain rounded-xl bg-white/5 p-1 border border-white/10 shrink-0" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <h5 className="font-extrabold uppercase italic inline-block text-white text-base tracking-wide">{renderTrans(fanz.name)}</h5>
                                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                        fanz.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                        fanz.rarity === 'epic' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                        fanz.rarity === 'rare' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                        'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                                      }`}>
                                        {fanz.rarity || 'common'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{fanz.sport} • ID : {fanz.id.substring(0, 10)}...</p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteUserFanzItem(fanz.id)}
                                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-xl border border-transparent transition cursor-pointer"
                                    title="Supprimer cette carte FANZ du compte joueur"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 xs:grid-cols-3 gap-2.5 pt-2">
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-orange-400 uppercase tracking-widest">Niveau (FANZ)</label>
                                    <input 
                                      type="number"
                                      id={`fanz-level-${fanz.id}`}
                                      defaultValue={fanz.level || 1}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl p-2 text-xs font-mono font-bold text-white text-center"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">XP combat (FANZ)</label>
                                    <input 
                                      type="number"
                                      id={`fanz-xp-${fanz.id}`}
                                      defaultValue={fanz.xp || 0}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl p-2 text-xs font-mono font-bold text-white text-center"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-yellow-400 uppercase tracking-widest">Rang (FANZ)</label>
                                    <input 
                                      type="number"
                                      id={`fanz-rank-${fanz.id}`}
                                      defaultValue={fanz.rank || 1}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl p-2 text-xs font-mono font-bold text-white text-center"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-orange-500 uppercase tracking-widest">Ferveur FANZ (XP)</label>
                                    <input 
                                      type="number"
                                      id={`fanz-fervpoints-${fanz.id}`}
                                      defaultValue={fanz.ferveurPoints || 0}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl p-2 text-xs font-mono font-bold text-white text-center"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-blue-400 uppercase tracking-widest">Niv Ferveur FANZ</label>
                                    <input 
                                      type="number"
                                      id={`fanz-fervlvl-${fanz.id}`}
                                      defaultValue={fanz.ferveurLevel || 1}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl p-2 text-xs font-mono font-bold text-white text-center"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-green-400 uppercase tracking-widest">Énergie (FANZ)</label>
                                    <input 
                                      type="number"
                                      id={`fanz-energy-${fanz.id}`}
                                      defaultValue={fanz.energy !== undefined ? fanz.energy : 100}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl p-2 text-xs font-mono font-bold text-white text-center"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 flex justify-end">
                                <Button
                                  onClick={async () => {
                                    const lvl = Number((document.getElementById(`fanz-level-${fanz.id}`) as HTMLInputElement)?.value);
                                    const xpVal = Number((document.getElementById(`fanz-xp-${fanz.id}`) as HTMLInputElement)?.value);
                                    const rnk = Number((document.getElementById(`fanz-rank-${fanz.id}`) as HTMLInputElement)?.value);
                                    const fPts = Number((document.getElementById(`fanz-fervpoints-${fanz.id}`) as HTMLInputElement)?.value);
                                    const fLvl = Number((document.getElementById(`fanz-fervlvl-${fanz.id}`) as HTMLInputElement)?.value);
                                    const enVal = Number((document.getElementById(`fanz-energy-${fanz.id}`) as HTMLInputElement)?.value);

                                    await handleUpdateUserFanzItem(fanz.id, {
                                      level: lvl,
                                      xp: xpVal,
                                      rank: rnk,
                                      ferveurPoints: fPts,
                                      ferveurLevel: fLvl,
                                      energy: enVal
                                    });
                                  }}
                                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-black uppercase italic tracking-widest text-[10px] py-2 px-4 h-9"
                                >
                                  Sauvegarder les Stats du FANZ
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  {/* Gestion des déblocages de skins / emotes / cartes duel */}
                  <Card className="p-6 space-y-6">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest text-[#a855f7] flex items-center gap-2">
                        <Layers className="w-5 h-5 text-[#a855f7]" /> Déblocages de Collections Globales
                      </h4>
                      <p className="text-xs text-gray-400">Cochez ou décochez les éléments spéciaux pour les déverrouiller instantanément sur le compte du joueur.</p>
                    </div>

                    <div className="space-y-4">
                      {/* SKINS COCHABLES */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 flex items-center gap-2">
                          🖌️ Skins Débloqués ({(selectedUserForAdmin.skins || []).length} actifs)
                        </span>
                        <div className="max-h-60 overflow-y-auto border border-white/5 bg-black/30 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 no-scrollbar">
                          {fanzTemplates.flatMap(t => t.skins?.map(skin => ({ ...skin, templateName: renderTrans(t.name) })) || []).map((skin, idx) => {
                            const isUnlocked = selectedUserForAdmin.skins?.includes(skin.id);
                            return (
                              <label key={`${skin.id}-${idx}`} className="flex items-center gap-2.5 p-2 bg-neutral-900/60 border border-white/5 rounded-lg hover:bg-neutral-800/80 transition-colors cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={isUnlocked}
                                  onChange={async () => {
                                    const current = selectedUserForAdmin.skins || [];
                                    const updated = current.includes(skin.id) 
                                      ? current.filter(id => id !== skin.id)
                                      : [...current, skin.id];
                                    await setDoc(doc(db, 'users', selectedUserForAdmin.uid), { skins: updated }, { merge: true });
                                    setStatus({ type: 'success', message: `Skin ${renderTrans(skin.name)} mis à jour !` });
                                    refreshSelectedUser(selectedUserForAdmin.uid);
                                  }}
                                  className="rounded border-zinc-700 text-purple-600 focus:ring-purple-600 cursor-pointer w-4 h-4"
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold text-white uppercase italic text-[10px]">{renderTrans(skin.name)}</span>
                                  <span className="text-[8px] text-zinc-500 font-sans tracking-wide shrink-0">({skin.templateName})</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* EMOTES COCHABLES */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#3b82f6] flex items-center gap-2">
                          💬 Emotes Débloquées ({(selectedUserForAdmin.emotes || []).length} actives)
                        </span>
                        <div className="max-h-60 overflow-y-auto border border-white/5 bg-black/30 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 no-scrollbar">
                          {fanzTemplates.flatMap(t => t.emotes?.map(emote => ({ ...emote, templateName: renderTrans(t.name) })) || []).map((emote, idx) => {
                            const isUnlocked = selectedUserForAdmin.emotes?.includes(emote.id);
                            return (
                              <label key={`${emote.id}-${idx}`} className="flex items-center gap-2.5 p-2 bg-neutral-900/60 border border-white/5 rounded-lg hover:bg-neutral-800/80 transition-colors cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={isUnlocked}
                                  onChange={async () => {
                                    const current = selectedUserForAdmin.emotes || [];
                                    const updated = current.includes(emote.id) 
                                      ? current.filter(id => id !== emote.id)
                                      : [...current, emote.id];
                                    await setDoc(doc(db, 'users', selectedUserForAdmin.uid), { emotes: updated }, { merge: true });
                                    setStatus({ type: 'success', message: `Emote ${renderTrans(emote.name)} mise à jour !` });
                                    refreshSelectedUser(selectedUserForAdmin.uid);
                                  }}
                                  className="rounded border-zinc-700 text-blue-600 focus:ring-blue-600 cursor-pointer w-4 h-4"
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold text-white uppercase italic text-[10px]">{renderTrans(emote.name)}</span>
                                  <span className="text-[8px] text-zinc-500 font-sans shrink-0">({emote.templateName})</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* CARTES DUEL COCHABLES */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#eab308] flex items-center gap-2">
                          🃏 Cartes Duel Débloquées ({(selectedUserForAdmin.cards || []).length} actives)
                        </span>
                        <div className="max-h-60 overflow-y-auto border border-white/5 bg-black/30 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 no-scrollbar">
                          {(duelCards.length > 0 ? duelCards : BASE_CARDS).map((card, idx) => {
                            const isUnlocked = selectedUserForAdmin.cards?.includes(card.id);
                            return (
                              <label key={`${card.id}-${idx}`} className="flex items-center gap-2.5 p-2 bg-neutral-900/60 border border-white/5 rounded-lg hover:bg-neutral-800/80 transition-colors cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={isUnlocked}
                                  onChange={async () => {
                                    const current = selectedUserForAdmin.cards || [];
                                    const updated = current.includes(card.id) 
                                      ? current.filter(id => id !== card.id)
                                      : [...current, card.id];
                                    await setDoc(doc(db, 'users', selectedUserForAdmin.uid), { cards: updated }, { merge: true });
                                    setStatus({ type: 'success', message: `Carte ${card.name} mise à jour !` });
                                    refreshSelectedUser(selectedUserForAdmin.uid);
                                  }}
                                  className="rounded border-zinc-700 text-yellow-600 focus:ring-yellow-600 cursor-pointer w-4 h-4"
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold text-white uppercase italic text-[10px]">{card.name}</span>
                                  <span className="text-[8px] text-zinc-500 font-sans italic tracking-wide shrink-0">({card.rarity})</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
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
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleLeagueSort('season')}>
                  <div className="flex items-center gap-1">Saison {leagueSort.column === 'season' ? (leagueSort.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : null}</div>
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
                        <span>{translateCountryName(item.country.name)}</span>
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  {editingCard.id.startsWith('card-') ? 'Créer' : 'Modifier'} la carte
                </h3>
                <div className="flex gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
                  {(['fr', 'en', 'es'] as const).map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setCardEditLang(l)}
                      className={`px-3 py-1 rounded uppercase font-bold text-xs transition-colors ${cardEditLang === l ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
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
                    <label className="text-sm font-medium text-gray-500">Nom de la carte ({cardEditLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={getTranslationValue(editingCard.name, cardEditLang)}
                      onChange={e => setEditingCard({...editingCard, name: setTranslationValue(editingCard.name, cardEditLang, e.target.value)})}
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
                    <label className="text-sm font-medium text-gray-500">Catégorie</label>
                    <select
                      value={editingCard.category || ''}
                      onChange={e => setEditingCard({...editingCard, category: e.target.value})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    >
                      <option value="">Aucune</option>
                      <option value="Objet">Objet</option>
                      <option value="Action">Action</option>
                      <option value="Chant">Chant</option>
                      <option value="Sort">Sort</option>
                      <option value="Piège">Piège</option>
                      <option value="Compagnon">Compagnon</option>
                      <option value="Consommable">Consommable</option>
                      <option value="Environnement">Environnement</option>
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
                    <label className="text-sm font-medium text-gray-500">Description ({cardEditLang.toUpperCase()})</label>
                    <textarea
                      value={getTranslationValue(editingCard.description, cardEditLang)}
                      onChange={e => setEditingCard({...editingCard, description: setTranslationValue(editingCard.description, cardEditLang, e.target.value)})}
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
                      {editingCard.videoUrl && editingCard.videoUrl !== 'undefined' && (
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
                            <option value="stun">Assommer (Adverse) [Durée]</option>
                            <option value="heavy_ball_boost">Bonus Ballon en Cuir (Soi) [Durée]</option>
                            <option value="throat_tackle">Tacle à la Gorge (Adverse) [Valeur]</option>
                            <option value="mammoth_charge">Charge de Mammouth (Détruit Boucliers) [Rien]</option>
                            <option value="mascot_bone_drum">Tambour en Os de Mascotte (Adverse -50% Clics) [Durée]</option>
                            <option value="scarves_wall">Mur d'Écharpes (Soi -50% Dégâts) [Durée]</option>
                            <option value="virage_host">L'Ost du Virage (Soi +1 Supporter) [Valeur]</option>
                            <option value="chainsaw_megaphone">Mégaphone-Tronçonneuse (Détruit Bouclier + Recul) [Rien]</option>
                            <option value="burning_seats">Pluie de Sièges Enflammés (Dégâts Zone + Défausse) [Rien]</option>
                            <option value="var_temporelle">VAR Temporelle (Rembobine au Tour Précédent) [Rien]</option>
                            <option value="tifo_holographique">Tifo Holographique 3D (Absorbe & Renvoie Dégâts) [Rien]</option>
                            <option value="capo_megaphone">Mégaphone du Capo (Ferveur du Plateau Doublée) [Durée]</option>
                            <option value="craquage_massif">Craquage Massif (Zone + Brouillard Inciblable) [Durée]</option>
                            <option value="var_illusion">VAR Miracle / Illusion (Contre & Annule l'effet adverse) [Rien]</option>
                            <option value="grimoire_chants">Grimoire des Chants Oubliés (Génère un Chant aléatoire) [Rien]</option>
                            <option value="buvette_grail">Graal de la Buvette (Corde soignée / bonus) [Rien]</option>
                            <option value="luminescent_standard">Étendard Luminescent (Immunité Totale des cartes adjacentes) [Durée]</option>
                            <option value="locker_room_curse">La Malédiction des Vestiaires (Piège ferveur adverse) [Rien]</option>
                            <option value="pumpkin_fog">Fumigène Citrouille Toxique (Brouillard de combat) [Durée]</option>
                            <option value="clapping_odin">Le Clapping d'Odin (Bonus x3 clics de la tribune) [Durée]</option>
                            <option value="corne_drakkar">Corne de Brume de Drakkar (Silence Chants & Sorts) [Durée]</option>
                            <option value="steal_object_card">Abordage du Parcage Visiteur (Vole Objet du Deck/Main) [Rien]</option>
                            <option value="parrot_taunt">Perroquet Insolent (Provoc / détournement d'attention) [Durée]</option>
                            <option value="vol_ballon">Vol de Ballon (Bouton adverse bloqué & attaque annulée) [Durée]</option>
                            <option value="regard_chien_battu">Regard de Chien Battu (Annule malus + régén. Endurance) [Valeur]</option>
                            <option value="zoomies_chaos">Les Zoomies du Chaos (Défausse et pioche pour les deux) [Rien]</option>
                            <option value="cancel_last_attack">Le Script est avec moi (Annule la dernière attaque reçue) [Rien]</option>
                            <option value="rage_quit_discard">Rage Quit Téléphonique (Défausse Action Rapide + Passe tour) [Durée]</option>
                            <option value="meta_update">Nouvelle Méta (Équilibrage moins de 3 / plus de 5) [Durée]</option>
                            <option value="stealth_jacket_flip">Retournement de Veste Furtif (Copie la carte la plus forte adverse) [Rien]</option>
                            <option value="desert_crossing">La Traversée du Désert (Piège perte ferveur si dominé) [Valeur]</option>
                            <option value="half_half_scarf">L'Écharpe Half-Half (Lie et immunise deux cartes) [Durée]</option>
                            <option value="megaphone_echo">L'Écho du Mégaphone (Galvaniser Supporters: +2 Ferveur/Attaque ce tour) [Valeur]</option>
                            <option value="biological_curfew">Le Couvre-Feu Biologique (Carte engagée/bloquée pour l'adversaire ou soi) [Durée]</option>
                            <option value="early_craquage">Le Craquage Précoce (Attaques ont 50% de chances d'échouer) [Durée]</option>
                            <option value="laser_relaunch">La Relance Laser (Joue gratuit Action Rapide/Attaquant) [Rien]</option>
                            <option value="pro_tantrum">Le Coup de Sang du Pro (Ramasseur de balles vers deck + -1 PV) [Rien]</option>
                            <option value="multiball_chaos">Le Multi-Ballon Maléfique (Interrompt et renvoie les dernières cartes) [Rien]</option>
                            <option value="mental_main_courante">Le Mental de la Main Courante (Immunité contre Climat et Terrain) [Durée]</option>
                            <option value="heritage_weight">Le Poids de l'Héritage (Bloque les cartes Modernes) [Durée]</option>
                            <option value="buvette_alert">Alerte Buvette (Saucisse-Frites) (Passer son tour pour récupérer +3 Ferveur/Vie) [Rien]</option>
                            <option value="tiktok_highlight">L'Highlight TikTok (Double dégâts, détruit si contré) [Rien]</option>
                            <option value="boucher_district">Le Boucher du District (Détruit le Prodige adverse + défausse 1 Énergie) [Rien]</option>
                            <option value="faux_rebond_excuse">L'Excuse du Faux Rebond (Annule phase ratée, carte conservée) [Rien]</option>
                            <option value="prime_goat">Le Prime (G.O.A.T) (Joueur gagne +4 de puissance ce tour, ignore ses stats) [Durée]</option>
                            <option value="attention_swipe">Perte d'Attention (Swipe) (Défausse une carte au hasard) [Rien]</option>
                            <option value="sterile_debate">Le Débat Stérile sur les Réseaux (Clash Ratio : pari de carte, coût max gagne) [Rien]</option>
                            <option value="transfusion_tactique">Transfusion Tactique (Vol de Vie) [Durée]</option>
                            <option value="eclipse_artificielle">Éclipse Artificielle (Annulation météo & boost) [Durée]</option>
                            <option value="coup_d_envoi_13h">Coup d'Envoi à 13h00 (Aveuglement + Dégâts) [Durée]</option>
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
                <option key={fanz.id} value={fanz.id}>{fanz.id} - {renderTrans(fanz.name)}</option>
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
                 if (!renderTrans(c.name).toLowerCase().includes(q) && !(c.id || '').toLowerCase().includes(q)) return false;
               }
               return true;
            }).sort((a, b) => {
              if (!cardSort) return 0;
              const { column, direction } = cardSort;
              const aVal = column === 'name' ? renderTrans(a.name).toLowerCase() : String(a[column as keyof typeof a] || '').toLowerCase();
              const bVal = column === 'name' ? renderTrans(b.name).toLowerCase() : String(b[column as keyof typeof b] || '').toLowerCase();
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
                  {card.videoUrl && card.videoUrl !== 'undefined' ? (
                    <video 
                      key={getImageUrl(card.videoUrl)}
                      src={getImageUrl(card.videoUrl)}
                      poster={getImageUrl(card.imageUrl) || undefined}
                      className="w-full h-full object-cover"
                      autoPlay muted loop playsInline
                    />
                  ) : (
                    <img src={getImageUrl(card.imageUrl || '')} alt={renderTrans(card.name)} className="w-full h-full object-cover" />
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
                    <h4 className="font-black italic uppercase text-sm">{renderTrans(card.name)}</h4>
                    <p className="text-[10px] text-gray-500 line-clamp-1">{renderTrans(card.description)}</p>
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  {editingAction.id.startsWith('action-') ? 'Créer' : 'Modifier'} l'action
                </h3>
                <div className="flex gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
                  {(['fr', 'en', 'es'] as const).map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setActionEditLang(l)}
                      className={`px-3 py-1 rounded uppercase font-bold text-xs transition-colors ${actionEditLang === l ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
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
                        <option key={f.id} value={f.id}>{renderTrans(f.name)}</option>
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
                          <option key={s.id} value={s.id}>{renderTrans(s.name)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Nom de l'action ({actionEditLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={getTranslationValue(editingAction.name, actionEditLang)}
                      onChange={e => setEditingAction({...editingAction, name: setTranslationValue(editingAction.name, actionEditLang, e.target.value)})}
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
                <option key={fanz.id} value={fanz.id}>{fanz.id} - {renderTrans(fanz.name)}</option>
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
                if (!renderTrans(action.name).toLowerCase().includes(q) && !(action.id || '').toLowerCase().includes(q)) return false;
              }
              return true;
            }).sort((a, b) => {
              if (!lifeActionSort) return 0;
              const { column, direction } = lifeActionSort;
              const aVal = column === 'name' ? renderTrans(a.name).toLowerCase() : String(a[column as keyof typeof a] || '').toLowerCase();
              const bVal = column === 'name' ? renderTrans(b.name).toLowerCase() : String(b[column as keyof typeof b] || '').toLowerCase();
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
                              <img src={getImageUrl(action.image)} alt={renderTrans(action.name)} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Activity className="w-8 h-8 text-gray-400" /></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg">{renderTrans(action.name)}</h4>
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
                  <Button onClick={handleTranslateEmotes} variant="outline" className="flex items-center gap-2 border-indigo-500 text-indigo-500 hover:bg-indigo-500/10 hidden lg:flex">
                    <MessageCircle className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /> Traduire Emotes
                  </Button>
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  {editingFanz.id.startsWith('fanz-') ? 'Créer' : 'Modifier'} le FANZ
                </h3>
                <div className="flex gap-1 bg-white/5 p-1 rounded border border-white/10 text-sm">
                  {(['fr', 'en', 'es'] as const).map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setFanzEditLang(l)}
                      className={`px-3 py-1 rounded uppercase font-bold transition-colors ${fanzEditLang === l ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
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
                    <label className="text-sm font-medium text-gray-500">Nom du FANZ ({fanzEditLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={getTranslationValue(editingFanz.name, fanzEditLang)}
                      onChange={e => setEditingFanz({...editingFanz, name: setTranslationValue(editingFanz.name, fanzEditLang, e.target.value)})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Description Courte ({fanzEditLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={getTranslationValue(editingFanz.shortDescription, fanzEditLang)}
                      onChange={e => setEditingFanz({...editingFanz, shortDescription: setTranslationValue(editingFanz.shortDescription, fanzEditLang, e.target.value)})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Description Longue ({fanzEditLang.toUpperCase()})</label>
                    <textarea
                      value={getTranslationValue(editingFanz.longDescription, fanzEditLang)}
                      onChange={e => setEditingFanz({...editingFanz, longDescription: setTranslationValue(editingFanz.longDescription, fanzEditLang, e.target.value)})}
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none h-24"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Cri de Guerre ({fanzEditLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={getTranslationValue(editingFanz.battleCry, fanzEditLang)}
                      onChange={e => setEditingFanz({...editingFanz, battleCry: setTranslationValue(editingFanz.battleCry, fanzEditLang, e.target.value)})}
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
                    <label className="text-sm font-medium text-gray-500">Description ({fanzEditLang.toUpperCase()})</label>
                    <textarea
                      value={getTranslationValue(editingFanz.description, fanzEditLang)}
                      onChange={e => setEditingFanz({...editingFanz, description: setTranslationValue(editingFanz.description, fanzEditLang, e.target.value)})}
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
                            <option key={card.id} value={card.id}>{renderTrans(card.name)} ({card.rarity})</option>
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
                            <option key={action.id} value={action.id}>{renderTrans(action.name)}</option>
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
                      <img src={getImageUrl(template.image)} alt={renderTrans(template.name)} className="w-full h-full object-cover" />
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
                      <h4 className="font-bold text-lg">{renderTrans(template.name)}</h4>
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
                            value={renderTrans(template.name)} 
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
          <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-white/10">
            <div>
              <h3 className="text-lg font-bold text-white">Langue d'édition de la Boutique</h3>
              <p className="text-xs text-gray-400">Sélectionne la langue pour éditer les noms et descriptions des produits.</p>
            </div>
            <div className="flex gap-1 bg-white/5 p-1 rounded border border-white/10 text-sm">
              {(['fr', 'en', 'es'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setShopEditLang(l)}
                  className={`px-3 py-1 rounded uppercase font-bold transition-colors ${shopEditLang === l ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

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
                    <label className="block text-sm font-medium mb-1">Nom du pack ({shopEditLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={getTranslationValue(pack.name, shopEditLang)}
                      onChange={e => {
                        const newPacks = [...shopConfig.ferveurPacks];
                        newPacks[index].name = setTranslationValue(pack.name, shopEditLang, e.target.value);
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
                    <label className="block text-sm font-medium mb-1">Description ({shopEditLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={getTranslationValue(pack.description, shopEditLang)}
                      onChange={e => {
                        const newPacks = [...shopConfig.ferveurPacks];
                        newPacks[index].description = setTranslationValue(pack.description, shopEditLang, e.target.value);
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
                    <label className="block text-sm font-medium mb-1">Nom affiché ({shopEditLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={getTranslationValue(boost.name, shopEditLang)}
                      onChange={e => {
                        const newBoosts = [...(shopConfig.boosts || [])];
                        newBoosts[index].name = setTranslationValue(boost.name, shopEditLang, e.target.value);
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
                      <label className="block text-sm font-medium mb-1">Nom affiché ({shopEditLang.toUpperCase()})</label>
                      <input
                        type="text"
                        value={getTranslationValue(pack.name, shopEditLang)}
                        onChange={e => {
                          const newPacks = [...(shopConfig.realMoneyPacks || [])];
                          newPacks[index].name = setTranslationValue(pack.name, shopEditLang, e.target.value);
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

      {activeTab === 'news' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-gray-950 border border-gray-800 p-6 rounded-3xl">
            <div>
              <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                <Newspaper className="w-5 h-5 mr-1" /> Système d'Actualités Officielles
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Créez, gérez et diffusez de superbes actualités pour annoncer des nouveautés (compétitions, fanz, skins, emotes, packs, etc.).
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingNews({
                  id: `news-${Date.now()}`,
                  type: 'general',
                  title: '📢 Grande Nouveauté !',
                  message: '',
                  itemId: '',
                  fanzId: '',
                  imageUrl: '',
                  videoUrl: '',
                  createdAt: new Date().toISOString(),
                  isActive: true
                });
                setShowCreateNewsModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 font-bold"
            >
              <Plus className="w-4 h-4 mr-2" /> Créer une Actualité
            </Button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl p-6">
            {newsList.length === 0 ? (
              <div className="p-8 text-center text-gray-505">
                <div className="mb-2 text-3xl">📰</div>
                Aucune actualité enregistrée pour le moment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4">Type de Nouveauté</th>
                      <th className="py-3 px-4">Titre & Message</th>
                      <th className="py-3 px-4">Média Preview</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newsList.map(item => (
                      <tr key={item.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleNewsActive(item)}
                            className={`px-2.5 py-1 text-[10px] uppercase font-black tracking-wider rounded-full ${
                              item.isActive !== false ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {item.isActive !== false ? '● En Ligne' : '○ Masqué'}
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded text-[9px] uppercase font-bold ${
                            item.type === 'competition' ? 'bg-purple-900/40 text-purple-400 border border-purple-800' :
                            item.type === 'fanz' ? 'bg-orange-900/40 text-orange-400 border border-orange-800' :
                            item.type === 'skin' ? 'bg-pink-900/40 text-pink-400 border border-pink-800' :
                            item.type === 'emote' ? 'bg-teal-900/40 text-teal-400 border border-teal-800' :
                            item.type === 'pack' ? 'bg-yellow-900/40 text-yellow-500 border border-yellow-800' :
                            'bg-gray-800 text-gray-300 border border-gray-700'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="py-4 px-4 max-w-sm">
                          <div className="font-bold text-white mb-1">{item.title}</div>
                          <div className="text-gray-400 text-[11px] leading-relaxed truncate-2-lines line-clamp-2">{item.message}</div>
                          <div className="text-[9px] text-gray-600 mt-1">Publié le {new Date(item.createdAt).toLocaleString('fr-FR')}</div>
                        </td>
                         <td className="py-4 px-4">
                           {item.videoUrl ? (
                             <div className="flex flex-col items-center gap-1">
                               <video src={getImageUrl(item.videoUrl)} className="w-12 h-12 object-cover bg-black/40 border border-white/10 rounded-lg p-1" muted playsInline />
                               <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded uppercase font-black">Vidéo</span>
                             </div>
                           ) : item.imageUrl ? (
                             item.imageUrl.length < 5 ? (
                               <span className="text-xl p-2 bg-black/40 border border-white/10 rounded-lg">{item.imageUrl}</span>
                             ) : (
                               <img src={getImageUrl(item.imageUrl)} alt="Preview" className="w-12 h-12 object-contain bg-black/40 border border-white/10 rounded-lg p-1" referrerPolicy="no-referrer" />
                             )
                           ) : (
                             <span className="text-gray-600">Aucun média</span>
                           )}
                         </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button 
                              onClick={() => {
                                setEditingNews(item);
                                setShowCreateNewsModal(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-blue-400 border-blue-400/20 hover:bg-blue-400/10"
                            >
                              Éditer
                            </Button>
                            <Button 
                              onClick={() => handleDeleteNews(item.id)}
                              variant="destructive"
                              size="sm"
                            >
                              Supprimer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateNewsModal && editingNews && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg bg-gray-905 border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 text-white">
            <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
              <Newspaper className="w-5 h-5 mr-1" /> {editingNews.id.includes('news-') ? 'Publier une actualité' : 'Modifier l\'actualité'}
            </h3>

            <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-2">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Catégorie de nouveauté</label>
                <select
                  value={editingNews.type}
                  onChange={e => {
                    const t = e.target.value as any;
                    setEditingNews({ ...editingNews, type: t, itemId: '', fanzId: '' });
                  }}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="general">Général (Actualités de l'app)</option>
                  <option value="competition">Nouvelle COMPÉTITION</option>
                  <option value="fanz">Nouveau FANZ disponible</option>
                  <option value="skin">Nouveau SKIN disponible</option>
                  <option value="emote">Nouvel EMOTE disponible</option>
                  <option value="pack">Nouveau PACK Boutique</option>
                </select>
              </div>

              {/* Fanz Selector for contextual fanz/skin/emote */}
              {(editingNews.type === 'fanz' || editingNews.type === 'skin' || editingNews.type === 'emote') && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    {editingNews.type === 'fanz' ? 'Sélectionner le Fanz Template' : 'Sélectionner le Fanz associé'}
                  </label>
                  <select
                    value={editingNews.type === 'fanz' ? editingNews.itemId : editingNews.fanzId}
                    onChange={e => {
                      const selectedId = e.target.value;
                      const matchedFanz = fanzTemplates.find(f => f.id === selectedId);
                      
                      if (editingNews.type === 'fanz') {
                        setEditingNews({
                          ...editingNews,
                          itemId: selectedId,
                          title: `🔥 NOUVEAU FANZ DISPONIBLE : ${matchedFanz ? matchedFanz.name : ''} !`,
                          message: `Découvrez notre légendaire FANZ ${matchedFanz ? matchedFanz.name : ''} ! Rejoignez les Kops et combattez pour les couleurs de votre club !`,
                          imageUrl: matchedFanz ? matchedFanz.image || '' : ''
                        });
                      } else {
                        setEditingNews({
                          ...editingNews,
                          fanzId: selectedId,
                          itemId: '' // Reset choice
                        });
                      }
                    }}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  >
                    <option value="">-- Choisir un Fanz Template --</option>
                    {fanzTemplates.map(f => (
                      <option key={f.id} value={f.id}>{renderTrans(f.name)} ({f.rarity})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Skin or emote selection list */}
              {(editingNews.type === 'skin' || editingNews.type === 'emote') && editingNews.fanzId && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    {editingNews.type === 'skin' ? 'Sélectionner le Skin' : 'Sélectionner l\'Emote'}
                  </label>
                  <select
                    value={editingNews.itemId}
                    onChange={e => {
                      const itemId = e.target.value;
                      const fanz = fanzTemplates.find(f => f.id === editingNews.fanzId);
                      const list = editingNews.type === 'skin' ? (fanz?.skins || []) : (fanz?.emotes || []);
                      const selectedItem = list.find((i: any) => i.id === itemId);
                      const sName = selectedItem ? renderTrans(selectedItem.name) : '';

                      setEditingNews({
                        ...editingNews,
                        itemId,
                        title: editingNews.type === 'skin' ? `🎭 NOUVEAU SKIN : ${sName} !` : `💬 NOUVEL EMOTE : ${sName} !`,
                        message: `Un magnifique ${editingNews.type === 'skin' ? 'skin' : 'emote'} "${sName}" est désormais activable ! Personnalisez vos duels dès maintenant !`,
                        imageUrl: selectedItem?.imageUrl || (selectedItem as any)?.image || ''
                      });
                    }}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  >
                    <option value="">-- Choisir un item dans la liste --</option>
                    {((fanzTemplates.find(f => f.id === editingNews.fanzId))?.[editingNews.type === 'skin' ? 'skins' : 'emotes'] || []).map((i: any) => (
                      <option key={i.id} value={i.id}>{renderTrans(i.name)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pack list helper if pack type selected */}
              {editingNews.type === 'pack' && shopConfig?.realMoneyPacks && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Sélectionner un Pack Boutique</label>
                  <select
                    value={editingNews.itemId}
                    onChange={e => {
                      const selectedId = e.target.value;
                      const matchedPack = shopConfig.realMoneyPacks.find((p: any) => p.id === selectedId);
                      const packName = matchedPack ? renderTrans(matchedPack.name) : '';

                      setEditingNews({
                        ...editingNews,
                        itemId: selectedId,
                        title: `💎 NOUVEAU PACK DE LA BOUTIQUE : ${packName} !`,
                        message: `Profitez d'une offre exclusive avec le pack "${packName}" disponible dès aujourd'hui dans la boutique officielle !`,
                        imageUrl: matchedPack ? matchedPack.image || '' : ''
                      });
                    }}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  >
                    <option value="">-- Sélectionner un Pack existant --</option>
                    {shopConfig.realMoneyPacks.map((p: any) => (
                      <option key={p.id} value={p.id}>{renderTrans(p.name)} ({p.priceEur}€)</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Competition automatic help title */}
              {editingNews.type === 'competition' && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Noms de Ligue Préréglés</label>
                  <select
                    onChange={e => {
                      const leagueName = e.target.value;
                      if (!leagueName) return;
                      setEditingNews({
                        ...editingNews,
                        title: `🏆 NOUVELLE COMPÉTITION DISPONIBLE : ${leagueName} !`,
                        message: `La compétition ${leagueName} est désormais disponible pour s'affronter en duel ! Rejoignez le Kop de vos équipes préférées et grimpez le classement mondial !`
                      });
                    }}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  >
                    <option value="">-- Remplir automatiquement avec une ligue globale --</option>
                    <option value="Ligue 1 McDonald's">Ligue 1 McDonald's</option>
                    <option value="UEFA Champions League">UEFA Champions League</option>
                    <option value="Premier League">Premier League</option>
                    <option value="LaLiga EA Sports">LaLiga EA Sports</option>
                    <option value="Serie A Enilive">Serie A Enilive</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Titre de la News</label>
                <input
                  type="text"
                  value={editingNews.title}
                  onChange={e => setEditingNews({ ...editingNews, title: e.target.value })}
                  placeholder="ex: 🏆 Nouvelle compétition disponible !"
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Message d'annonce</label>
                <textarea
                  value={editingNews.message}
                  onChange={e => setEditingNews({ ...editingNews, message: e.target.value })}
                  placeholder="Écrivez le message de l'annonce..."
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 outline-none focus:border-blue-500 h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">URL de l'image (Média)</label>
                <input
                  type="text"
                  value={editingNews.imageUrl || ''}
                  onChange={e => setEditingNews({ ...editingNews, imageUrl: e.target.value })}
                  placeholder="ex: /fanz/image-name.png ou emoji 💎"
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">URL de la vidéo (Média - Optionnel)</label>
                <input
                  type="text"
                  value={editingNews.videoUrl || ''}
                  onChange={e => setEditingNews({ ...editingNews, videoUrl: e.target.value })}
                  placeholder="ex: /fanz/video-name.mp4"
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 bg-white/5 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="newsActiveInput"
                  checked={editingNews.isActive !== false}
                  onChange={e => setEditingNews({ ...editingNews, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-500 accent-blue-500 rounded focus:ring-0 cursor-pointer"
                />
                <label htmlFor="newsActiveInput" className="text-sm cursor-pointer select-none font-medium">Activer et diffuser immédiatement</label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingNews(null);
                  setShowCreateNewsModal(false);
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={() => handleSaveNews(editingNews)}
                className="bg-blue-600 hover:bg-blue-700 font-bold"
                disabled={loading || !editingNews.title || !editingNews.message}
              >
                Enregistrer l'Actualité
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
