import React, { useState, useEffect } from 'react';
import { footballApi } from '../services/footballApi';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, collection, getDocs, writeBatch, deleteDoc, query, where, getDoc, updateDoc } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { League, Team, Standing, Fixture, LifeAction, Card as DuelCard, FanzTemplate, FerveurLevel, RankReward, FanzStats, Fanz, UserProfile, Mission, Pass, GlobalFervorConfig, WeeklyStreakConfig, WeeklyStreakCycle, DuelConfig, FanzSkin, PassLevel } from '../types';
import { Database, Download, RefreshCw, CheckCircle, AlertCircle, Search, Plus, Save, Trash2, Activity, Video, Layers, Users, Trophy, Star, Shield, Brain, Eye, Info, Flame, MessageCircle, Calendar, Gift, Target, CreditCard, UserCog } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { RewardSelector } from './RewardSelector';
import { BASE_CARDS } from '../constants/cards';
import { ALL_FANZ } from '../constants/fanz';
import { LOGOS } from '../constants';

import { footballDataService } from '../services/footballDataService';

export function AdminZone() {
  const [activeTab, setActiveTab] = useState<'football' | 'lifeActions' | 'duelCards' | 'fanz' | 'users' | 'duelConfig'>('football');
  const [activeUserSubTab, setActiveUserSubTab] = useState<'profiles' | 'fervor' | 'streak' | 'missions' | 'passes'>('profiles');
  
  // Duel Config state
  const [duelConfig, setDuelConfig] = useState<DuelConfig | null>(null);
  
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

  // User Management state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [userFervorConfig, setUserFervorConfig] = useState<GlobalFervorConfig | null>(null);
  const [streakCycles, setStreakCycles] = useState<WeeklyStreakCycle[]>([]);
  const [editingCycle, setEditingCycle] = useState<WeeklyStreakCycle | null>(null);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [editingPass, setEditingPass] = useState<Pass | null>(null);

  useEffect(() => {
    if (activeTab === 'lifeActions') {
      fetchLifeActions();
    } else if (activeTab === 'duelCards') {
      fetchDuelCards();
    } else if (activeTab === 'fanz') {
      fetchFanzTemplates();
    } else if (activeTab === 'users') {
      fetchUserData();
    } else if (activeTab === 'duelConfig') {
      fetchDuelConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      if (activeUserSubTab === 'profiles') fetchUsers();
      if (activeUserSubTab === 'missions') fetchMissions();
      if (activeUserSubTab === 'passes') fetchPasses();
      if (activeUserSubTab === 'fervor') fetchUserFervorConfig();
      if (activeUserSubTab === 'streak') fetchStreakCycles();
    }
  }, [activeUserSubTab, activeTab]);

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
      const querySnapshot = await getDocs(collection(db, 'users'));
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
      
      // 1. Fetch Fanz-1 (Bébé Fanzzy)
      const fanzRef = doc(db, 'fanz_templates', 'fanz-1');
      const fanzSnap = await getDoc(fanzRef);
      
      if (!fanzSnap.exists()) {
        setStatus({ type: 'error', message: 'Le Fanz Bébé Fanzzy (fanz-1) n\'existe pas.' });
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
            fanzId: 'fanz-1',
            name: `Skin WC26 - Équipe ${i}`,
            imageUrl: `gs://thebestfanonlinegas.firebasestorage.app/public/fanz/wc26/equipe${i}.png`,
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
      if (fervorDoc) {
        setUserFervorConfig({ id: fervorDoc.id, ...fervorDoc.data() } as GlobalFervorConfig);
      } else {
        // Initialize if missing
        const defaultConfig: GlobalFervorConfig = {
          id: 'user_fervor',
          ranges: [
            { level: 1, min: 0, max: 499, step: 10, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 2, min: 500, max: 1549, step: 15, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 3, min: 1550, max: 5099, step: 50, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 4, min: 5100, max: 10099, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 5, min: 10100, max: 15099, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 6, min: 15100, max: 20099, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 7, min: 20100, max: 25099, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 8, min: 25100, max: 30199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 9, min: 30200, max: 40199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 10, min: 40200, max: 50199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 11, min: 50200, max: 60199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 12, min: 60200, max: 70199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 13, min: 70200, max: 80199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 14, min: 80200, max: 90199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
            { level: 15, min: 90200, max: 99999, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
          ]
        };
        setUserFervorConfig(defaultConfig);
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
      await setDoc(configRef, duelConfig);
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
      await setDoc(configRef, userFervorConfig);
      setStatus({ type: 'success', message: 'Chemin de ferveur global sauvegardé !' });
    } catch (err) {
      console.error("Error saving user fervor config", err);
      handleFirestoreError(err, OperationType.WRITE, 'global_configs/user_fervor');
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
      await setDoc(ref, editingCycle);
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
    if (!window.confirm('Voulez-vous vraiment supprimer ce cycle ?')) return;
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
      await setDoc(ref, editingMission);
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
      await setDoc(ref, editingPass);
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

  const handleFixFerveurPaths = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Réparation des chemins de ferveur...' });
    try {
      const querySnapshot = await getDocs(collection(db, 'fanz_templates'));
      const batch = writeBatch(db);
      let count = 0;

      const defaultPath: FerveurLevel[] = [];
      for (let pts = 25; pts <= 1000; pts += 25) {
        if (pts === 250) {
          defaultPath.push({ level: 2, pointsRequired: 250, reward: { type: 'money' as const, amount: 100 } });
        } else if (pts === 500) {
          defaultPath.push({ level: 3, pointsRequired: 500, reward: { type: 'money' as const, amount: 100 } });
        } else if (pts === 750) {
          defaultPath.push({ level: 4, pointsRequired: 750, reward: { type: 'money' as const, amount: 100 } });
        } else if (pts === 1000) {
          defaultPath.push({ level: 5, pointsRequired: 1000, reward: { type: 'money' as const, amount: 100 } });
        } else {
          defaultPath.push({ isIntermediate: true, pointsRequired: pts, reward: { type: 'money' as const, amount: 25 } });
        }
      }

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        if (!data.ferveurPath || data.ferveurPath.length === 0) {
          batch.update(docSnap.ref, { ferveurPath: defaultPath });
          count++;
        }
      }

      await batch.commit();
      setStatus({ type: 'success', message: `${count} chemins de ferveur réparés !` });
      fetchFanzTemplates();
    } catch (err) {
      console.error("Error fixing ferveur paths", err);
      handleFirestoreError(err, OperationType.WRITE, 'fanz_templates');
      setStatus({ type: 'error', message: 'Erreur lors de la réparation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewFanz = () => {
    const newId = `fanz-${Date.now()}`;
    
    const defaultPath: FerveurLevel[] = [];
    for (let pts = 25; pts <= 1000; pts += 25) {
      if (pts === 250) {
        defaultPath.push({ level: 2, pointsRequired: 250, reward: { type: 'money' as const, amount: 100 } });
      } else if (pts === 500) {
        defaultPath.push({ level: 3, pointsRequired: 500, reward: { type: 'money' as const, amount: 100 } });
      } else if (pts === 750) {
        defaultPath.push({ level: 4, pointsRequired: 750, reward: { type: 'money' as const, amount: 100 } });
      } else if (pts === 1000) {
        defaultPath.push({ level: 5, pointsRequired: 1000, reward: { type: 'money' as const, amount: 100 } });
      } else {
        defaultPath.push({ isIntermediate: true, pointsRequired: pts, reward: { type: 'money' as const, amount: 25 } });
      }
    }

    setEditingFanz({
      id: newId,
      name: 'Nouveau FANZ',
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
      skins: [],
      emotes: [],
      ferveurPath: defaultPath,
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
      energyCost: 5,
      fervorValue: 0,
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
      </div>

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
                  <div key={idx} className="p-4 rounded-xl border bg-gray-900/50 border-blue-900/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-blue-400">
                        NIVEAU {range.level}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">De {range.min} à {range.max} (pas de {range.step})</span>
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
                        {editingCycle.days.map((config, idx) => (
                          <div key={config.day} className="p-4 bg-gray-900/50 rounded-xl border border-gray-800 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="font-black text-orange-500">JOUR {config.day}</span>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase text-gray-500">Récompense</label>
                              <RewardSelector
                                reward={config.reward}
                                onChange={reward => {
                                  const newDays = [...editingCycle.days];
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
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Système de Missions</h3>
                <Button onClick={() => setEditingMission({
                  id: `mission-${Date.now()}`,
                  title: 'Nouvelle Mission',
                  description: 'Description...',
                  type: 'duel_count',
                  target: 1,
                  reward: { type: 'money', amount: 100 },
                  isActive: true
                })}>
                  <Plus className="w-4 h-4 mr-2" /> Nouvelle Mission
                </Button>
              </div>

              {editingMission && (
                <Card className="p-6">
                  <form onSubmit={handleSaveMission} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Titre</label>
                        <input
                          type="text"
                          value={editingMission.title}
                          onChange={e => setEditingMission({...editingMission, title: e.target.value})}
                          className="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Type</label>
                        <select
                          value={editingMission.type}
                          onChange={e => setEditingMission({...editingMission, type: e.target.value as any})}
                          className="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="duel_count">Nombre de Duels</option>
                          <option value="win_count">Nombre de Victoires</option>
                          <option value="fanz_duel">Duel avec chaque FANZ</option>
                          <option value="life_action">Actions LIFE réalisées</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Cible (Nombre)</label>
                        <input
                          type="number"
                          value={editingMission.target}
                          onChange={e => setEditingMission({...editingMission, target: Number(e.target.value)})}
                          className="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-gray-300">Récompense</label>
                        <RewardSelector
                          reward={editingMission.reward}
                          onChange={reward => setEditingMission({ ...editingMission, reward })}
                          fanzTemplates={fanzTemplates}
                          lifeActions={lifeActions}
                          duelCards={duelCards}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setEditingMission(null)}>Annuler</Button>
                      <Button type="submit">Sauvegarder</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {missions.map(mission => (
                  <Card key={mission.id} className="p-4 hover:border-blue-500 cursor-pointer bg-gray-900/40" onClick={() => setEditingMission(mission)}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white">{mission.title}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${mission.isActive ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                        {mission.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">{mission.description}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-blue-400">Objectif: {mission.target}</span>
                      <span className="font-bold text-orange-400">+{mission.reward.amount} {mission.reward.type}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeUserSubTab === 'passes' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Système de Passes (Saisonniers)</h3>
                <div className="flex gap-2">
                  <Button onClick={generateWCPass} variant="outline" className="border-blue-500 text-blue-500">
                    <Star className="w-4 h-4 mr-2" /> Générer Pass WC 2026
                  </Button>
                  <Button onClick={() => setEditingPass({
                    id: `pass-${Date.now()}`,
                    name: 'Nouveau Pass',
                    description: 'Description...',
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
                    isActive: true
                  })}>
                    <Plus className="w-4 h-4 mr-2" /> Nouveau Pass
                  </Button>
                </div>
              </div>

              {editingPass && (
                <Card className="p-6">
                  <form onSubmit={handleSavePass} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Nom du Pass</label>
                        <input
                          type="text"
                          value={editingPass.name}
                          onChange={e => setEditingPass({...editingPass, name: e.target.value})}
                          className="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Prix Premium (Argent)</label>
                        <input
                          type="number"
                          value={editingPass.premiumPrice?.money || 0}
                          onChange={e => setEditingPass({
                            ...editingPass, 
                            premiumPrice: { ...editingPass.premiumPrice, money: Number(e.target.value) }
                          })}
                          className="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Prix Premium (Gemmes)</label>
                        <input
                          type="number"
                          value={editingPass.premiumPrice?.gems || 0}
                          onChange={e => setEditingPass({
                            ...editingPass, 
                            priceGems: Number(e.target.value),
                            premiumPrice: { ...editingPass.premiumPrice, gems: Number(e.target.value) }
                          })}
                          className="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-sm border-b border-gray-800 pb-2 text-white">Niveaux & Récompenses</h4>
                      <div className="space-y-4">
                        {editingPass.levels.map((lvl, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500">NIVEAU {lvl.level}</label>
                              <input
                                type="number"
                                value={lvl.pointsRequired}
                                onChange={e => {
                                  const newLevels = [...editingPass.levels];
                                  newLevels[idx] = { ...lvl, pointsRequired: Number(e.target.value) };
                                  setEditingPass({ ...editingPass, levels: newLevels });
                                }}
                                className="w-full p-1 bg-gray-800 text-white rounded border border-gray-700 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
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
                            <div className="space-y-1">
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
                            <Button type="button" variant="outline" size="sm" className="text-red-400 border-red-900 hover:bg-red-900/30" onClick={() => {
                              const newLevels = editingPass.levels.filter((_, i) => i !== idx);
                              setEditingPass({ ...editingPass, levels: newLevels });
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => {
                          const nextLevel = editingPass.levels.length + 1;
                          const lastPoints = editingPass.levels[editingPass.levels.length - 1]?.pointsRequired || 0;
                          setEditingPass({
                            ...editingPass,
                            levels: [...editingPass.levels, {
                              level: nextLevel,
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

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setEditingPass(null)}>Annuler</Button>
                      <Button type="submit">Sauvegarder</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {passes.map(pass => (
                  <Card key={pass.id} className="p-4 hover:border-blue-500 cursor-pointer bg-gray-900/40" onClick={() => setEditingPass(pass)}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white">{pass.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${pass.isActive ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                        {pass.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-4">
                      <span className="text-gray-400">{pass.levels.length} Niveaux</span>
                      <span className="font-bold text-purple-400">
                        {pass.premiumPrice?.money ? `${pass.premiumPrice.money} 💰 ` : ''}
                        {pass.premiumPrice?.gems ? `${pass.premiumPrice.gems} 💎` : ''}
                        {!pass.premiumPrice?.money && !pass.premiumPrice?.gems && `${pass.priceGems} 💎`}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
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
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Temps de base pour 1 pt d'excitation (secondes)</label>
                <input
                  type="number"
                  step="0.1"
                  value={duelConfig.baseExcitementRegenTime || 5}
                  onChange={(e) => setDuelConfig({ ...duelConfig, baseExcitementRegenTime: parseFloat(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm font-mono"
                />
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
                <img src={item.league.logo} alt={item.league.name} className="w-10 h-10 object-contain" />
                <div>
                  <div className="font-bold text-sm">{item.league.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    {item.country.flag && <img src={item.country.flag} alt="" className="w-4 h-3 object-cover rounded-sm" />}
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
              <Button onClick={async () => {
                setLoading(true);
                setStatus({ type: 'info', message: 'Mise à jour des coûts...' });
                try {
                  const cardsSnap = await getDocs(collection(db, 'cards'));
                  const batch = writeBatch(db);
                  cardsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.energyCost > 10) {
                      batch.update(doc.ref, { energyCost: Math.max(1, Math.round(data.energyCost / 10)) });
                    }
                  });
                  await batch.commit();
                  setStatus({ type: 'success', message: 'Coûts d\'excitation divisés par 10 !' });
                  fetchDuelCards();
                } catch (err) {
                  console.error(err);
                  setStatus({ type: 'error', message: 'Erreur lors de la mise à jour.' });
                } finally {
                  setLoading(false);
                }
              }} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" /> Diviser Coûts par 10
              </Button>
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
                    <label className="text-sm font-medium text-gray-500">ID du Fanz (Optionnel)</label>
                    <input
                      type="text"
                      value={editingCard.fanzIds?.join(', ') || ''}
                      onChange={e => setEditingCard({...editingCard, fanzIds: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')})}
                      placeholder="Ex: fanz-1, fanz-2 (Laissez vide pour tous)"
                      className="w-full p-2 bg-gray-100 text-gray-900 rounded-lg border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Fanz Bloqués (Optionnel)</label>
                    <input
                      type="text"
                      value={editingCard.blockedFanzIds?.join(', ') || ''}
                      onChange={e => setEditingCard({...editingCard, blockedFanzIds: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')})}
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
                            <option value="drain_energy">Drainer Excitation (Adverse)</option>
                            <option value="refill_energy">Remplir Excitation (Soi)</option>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {duelCards.map((card) => (
              <Card key={card.id} className="p-4 hover:border-blue-500 transition-colors cursor-pointer group" onClick={() => setEditingCard(card)}>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100">
                  {card.videoUrl ? (
                    <video 
                      key={getImageUrl(card.videoUrl)}
                      src={getImageUrl(card.videoUrl)}
                      poster={getImageUrl(card.imageUrl || '')}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lifeActions.map((action) => (
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
              <Button onClick={handleFixFerveurPaths} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" /> Réparer Ferveur
              </Button>
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
                      <img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /> Chemin de la Ferveur
                    </h4>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditingFanz({
                        ...editingFanz,
                        ferveurPath: [...(editingFanz.ferveurPath || []), { 
                          id: `inter-${Date.now()}`,
                          isIntermediate: true,
                          pointsRequired: 0,
                          reward: { type: 'money', amount: 100 }
                        } as FerveurLevel].sort((a, b) => a.pointsRequired - b.pointsRequired)
                      })}>
                        Ajouter Gain Intermédiaire
                      </Button>
                      <Button type="button" size="sm" onClick={() => {
                        const currentLevels = (editingFanz.ferveurPath || []).filter(p => !p.isIntermediate);
                        const nextLevel = currentLevels.length + 1;
                        setEditingFanz({
                          ...editingFanz,
                          ferveurPath: [...(editingFanz.ferveurPath || []), { 
                            level: nextLevel, 
                            pointsRequired: nextLevel * 100,
                            reward: { type: 'money', amount: 100 }
                          } as FerveurLevel].sort((a, b) => a.pointsRequired - b.pointsRequired)
                        });
                      }}>
                        Ajouter Palier
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(editingFanz.ferveurPath || []).map((path, idx) => (
                      <div key={path.id || idx} className={`flex gap-3 items-end p-3 rounded-lg border ${path.isIntermediate ? 'bg-gray-100 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="w-24 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Niv.</label>
                          <div className={`w-full p-2 rounded text-sm font-bold ${path.isIntermediate ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                            {path.isIntermediate ? 'INTER' : path.level}
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Points Requis</label>
                          <input
                            type="number"
                            value={path.pointsRequired}
                            onChange={e => {
                              const newPath = [...(editingFanz.ferveurPath || [])];
                              newPath[idx] = { ...path, pointsRequired: Number(e.target.value) };
                              newPath.sort((a, b) => a.pointsRequired - b.pointsRequired);
                              setEditingFanz({...editingFanz, ferveurPath: newPath});
                            }}
                            className="w-full p-2 bg-white text-gray-900 rounded border-none text-sm"
                            min="1"
                            max="1000"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Récompense Type</label>
                          <RewardSelector
                            reward={path.reward}
                            onChange={reward => {
                              const newPath = [...(editingFanz.ferveurPath || [])];
                              newPath[idx] = { ...path, reward };
                              setEditingFanz({...editingFanz, ferveurPath: newPath});
                            }}
                            fanzTemplates={fanzTemplates}
                            lifeActions={lifeActions}
                            duelCards={duelCards}
                            theme="light"
                          />
                        </div>
                        <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => {
                          let newPath = (editingFanz.ferveurPath || []).filter((_, i) => i !== idx);
                          // Renumber regular levels
                          let currentLevel = 1;
                          newPath = newPath.map(p => {
                            if (!p.isIntermediate) {
                              return { ...p, level: currentLevel++ };
                            }
                            return p;
                          });
                          setEditingFanz({...editingFanz, ferveurPath: newPath});
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold flex items-center gap-2">
                      <Star className="w-5 h-5 text-purple-500" /> Skins du Fanz
                    </h4>
                    <Button type="button" size="sm" onClick={() => {
                      const newSkins = [...(editingFanz.skins || []), { id: `skin-${Date.now()}`, fanzId: editingFanz.id, name: 'Nouveau Skin', imageUrl: '', videoUrl: '', price: { money: 1000 } }];
                      setEditingFanz({...editingFanz, skins: newSkins});
                    }}>
                      Ajouter Skin
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(editingFanz.skins || []).map((skin, sIdx) => (
                      <div key={sIdx} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-200 relative">
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const newSkins = [...editingFanz.skins, { ...skin, id: `skin-${Date.now()}`, name: `${skin.name} (Copie)` }];
                              setEditingFanz({...editingFanz, skins: newSkins});
                            }}
                          >
                            Dupliquer
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => {
                              const newSkins = editingFanz.skins.filter((_, i) => i !== sIdx);
                              setEditingFanz({...editingFanz, skins: newSkins});
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-6">
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
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={skin.videoUrl || ''}
                                onChange={e => {
                                  const newSkins = [...editingFanz.skins];
                                  newSkins[sIdx] = { ...skin, videoUrl: e.target.value };
                                  setEditingFanz({...editingFanz, skins: newSkins});
                                }}
                                className="flex-1 p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                              />
                              {skin.videoUrl && (
                                <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                                  <video 
                                    key={getImageUrl(skin.videoUrl)}
                                    src={getImageUrl(skin.videoUrl)} 
                                    className="w-full h-full object-cover"
                                    autoPlay muted loop playsInline
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Argent</label>
                            <input
                              type="number"
                              value={skin.price.money || 0}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, price: { ...skin.price, money: Number(e.target.value) } };
                                setEditingFanz({...editingFanz, skins: newSkins});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Gemmes</label>
                            <input
                              type="number"
                              value={skin.price.gems || 0}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, price: { ...skin.price, gems: Number(e.target.value) } };
                                setEditingFanz({...editingFanz, skins: newSkins});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Boost</label>
                            <input
                              type="number"
                              value={skin.price.boostPoints || 0}
                              onChange={e => {
                                const newSkins = [...editingFanz.skins];
                                newSkins[sIdx] = { ...skin, price: { ...skin.price, boostPoints: Number(e.target.value) } };
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
                      const newEmotes = [...(editingFanz.emotes || []), { id: `emote-${Date.now()}`, fanzId: editingFanz.id, name: 'Nouvel Emote', imageUrl: '', price: { money: 500 } }];
                      setEditingFanz({...editingFanz, emotes: newEmotes});
                    }}>
                      Ajouter Emote
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(editingFanz.emotes || []).map((emote, eIdx) => (
                      <div key={eIdx} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-200 relative">
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const newEmotes = [...editingFanz.emotes, { ...emote, id: `emote-${Date.now()}`, name: `${emote.name} (Copie)` }];
                              setEditingFanz({...editingFanz, emotes: newEmotes});
                            }}
                          >
                            Dupliquer
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => {
                              const newEmotes = editingFanz.emotes.filter((_, i) => i !== eIdx);
                              setEditingFanz({...editingFanz, emotes: newEmotes});
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-6">
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
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Image URL</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={emote.imageUrl || ''}
                                onChange={e => {
                                  const newEmotes = [...editingFanz.emotes];
                                  newEmotes[eIdx] = { ...emote, imageUrl: e.target.value };
                                  setEditingFanz({...editingFanz, emotes: newEmotes});
                                }}
                                className="flex-1 p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                                placeholder="gs://... ou https://..."
                              />
                              {emote.imageUrl && (
                                <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                                  <img src={getImageUrl(emote.imageUrl)} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Video URL</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={emote.videoUrl || ''}
                                onChange={e => {
                                  const newEmotes = [...editingFanz.emotes];
                                  newEmotes[eIdx] = { ...emote, videoUrl: e.target.value };
                                  setEditingFanz({...editingFanz, emotes: newEmotes});
                                }}
                                className="flex-1 p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                                placeholder="gs://... ou https://..."
                              />
                              {emote.videoUrl && (
                                <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                                  <video 
                                    key={getImageUrl(emote.videoUrl)}
                                    src={getImageUrl(emote.videoUrl)} 
                                    className="w-full h-full object-cover"
                                    autoPlay muted loop playsInline
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Argent</label>
                            <input
                              type="number"
                              value={emote.price?.money || 0}
                              onChange={e => {
                                const newEmotes = [...editingFanz.emotes];
                                newEmotes[eIdx] = { ...emote, price: { ...(emote.price || {}), money: Number(e.target.value) } };
                                setEditingFanz({...editingFanz, emotes: newEmotes});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Gemmes</label>
                            <input
                              type="number"
                              value={emote.price?.gems || 0}
                              onChange={e => {
                                const newEmotes = [...editingFanz.emotes];
                                newEmotes[eIdx] = { ...emote, price: { ...(emote.price || {}), gems: Number(e.target.value) } };
                                setEditingFanz({...editingFanz, emotes: newEmotes});
                              }}
                              className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Boost</label>
                            <input
                              type="number"
                              value={emote.price?.boostPoints || 0}
                              onChange={e => {
                                const newEmotes = [...editingFanz.emotes];
                                newEmotes[eIdx] = { ...emote, price: { ...(emote.price || {}), boostPoints: Number(e.target.value) } };
                                setEditingFanz({...editingFanz, emotes: newEmotes});
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
                              <option value="team_slot">Emplacement Équipe</option>
                              <option value="fanz">FANZ</option>
                            </select>
                            {reward.type === 'fanz' && (
                              <select
                                value={reward.fanzId || ''}
                                onChange={e => {
                                  const newRewards = { ...(editingFanz.rankRewards || {}) };
                                  newRewards[slotId] = { ...reward, fanzId: e.target.value };
                                  setEditingFanz({...editingFanz, rankRewards: newRewards});
                                }}
                                className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                              >
                                <option value="">Sélectionner un FANZ...</option>
                                {fanzTemplates.map(f => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                              </select>
                            )}
                            {reward.type === 'card' && (
                              <select
                                value={reward.cardId || ''}
                                onChange={e => {
                                  const newRewards = { ...(editingFanz.rankRewards || {}) };
                                  newRewards[slotId] = { ...reward, cardId: e.target.value };
                                  setEditingFanz({...editingFanz, rankRewards: newRewards});
                                }}
                                className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                              >
                                <option value="">Sélectionner une carte...</option>
                                {duelCards.map(card => (
                                  <option key={card.id} value={card.id}>{card.name}</option>
                                ))}
                              </select>
                            )}
                            {reward.type === 'skin' && (
                              <select
                                value={reward.skinId || ''}
                                onChange={e => {
                                  const newRewards = { ...(editingFanz.rankRewards || {}) };
                                  newRewards[slotId] = { ...reward, skinId: e.target.value };
                                  setEditingFanz({...editingFanz, rankRewards: newRewards});
                                }}
                                className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                              >
                                <option value="">Sélectionner un skin...</option>
                                {editingFanz.skins.map(skin => (
                                  <option key={skin.id} value={skin.id}>{skin.name}</option>
                                ))}
                              </select>
                            )}
                            {reward.type === 'emote' && (
                              <select
                                value={reward.emoteId || ''}
                                onChange={e => {
                                  const newRewards = { ...(editingFanz.rankRewards || {}) };
                                  newRewards[slotId] = { ...reward, emoteId: e.target.value };
                                  setEditingFanz({...editingFanz, rankRewards: newRewards});
                                }}
                                className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-xs"
                              >
                                <option value="">Sélectionner une emote...</option>
                                {editingFanz.emotes.map(emote => (
                                  <option key={emote.id} value={emote.id}>{emote.name}</option>
                                ))}
                              </select>
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
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const newId = `fanz-${Date.now()}`;
                      setEditingFanz({
                        ...editingFanz,
                        id: newId,
                        name: `${editingFanz.name} (Copie)`
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {fanzTemplates.map((template) => (
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
        </div>
      )}
    </div>
  );
}
