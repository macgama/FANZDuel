import React, { useState, useEffect } from 'react';
import { UserProfile, Fanz, FanzTemplate } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, query, collection, where, onSnapshot, getDoc } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { X, User as UserIcon, Check } from 'lucide-react';
import { FLAG_AVATARS, FANZ_AVATARS, SKIN_AVATARS, LANGUAGES } from '../constants/avatars';
import { getImageUrl } from '../lib/utils';

interface UserProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
}

export function UserProfileModal({ profile, onClose }: UserProfileModalProps) {
  const [pseudo, setPseudo] = useState(profile.pseudo);
  const [language, setLanguage] = useState(profile.language || 'fr');
  const [dataSaver, setDataSaver] = useState(profile.dataSaver || false);
  const [isMuted, setIsMuted] = useState(profile.isMuted || false);
  const [photoURL, setPhotoURL] = useState(profile.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [avatarTab, setAvatarTab] = useState<'flags' | 'fanz' | 'skins'>('flags');
  const [defaultFanzUrl, setDefaultFanzUrl] = useState<string | null>(null);
  const [ownedTemplateIds, setOwnedTemplateIds] = useState<string[]>([]);
  const [ownedSkinIds, setOwnedSkinIds] = useState<string[]>([]);

  useEffect(() => {
    if (!profile.uid) return;

    const q = query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const templates = new Set<string>();
        const skins = new Set<string>();

        snapshot.docs.forEach(d => {
          const data = d.data() as Fanz;
          if (data.templateId) templates.add(data.templateId);
          if (data.unlockedSkins) {
             data.unlockedSkins.forEach(s => skins.add(s));
          }
        });

        setOwnedTemplateIds(Array.from(templates));
        setOwnedSkinIds(Array.from(skins));
        
        const sortedDocs = [...snapshot.docs].sort((a, b) => {
          const dataA = a.data() as Fanz;
          const dataB = b.data() as Fanz;
          // Prefer Fanz with equipped skin
          if (dataA.equippedSkin && !dataB.equippedSkin) return -1;
          if (!dataA.equippedSkin && dataB.equippedSkin) return 1;
          // Then by level, xp, id
          if ((dataB.level || 0) !== (dataA.level || 0)) return (dataB.level || 0) - (dataA.level || 0);
          if ((dataB.xp || 0) !== (dataA.xp || 0)) return (dataB.xp || 0) - (dataA.xp || 0);
          return a.id.localeCompare(b.id);
        });
        const activeFanzDoc = sortedDocs.find(d => d.id === (profile.activeFanzId || profile.activeAction?.fanzId)) || sortedDocs[0];
        const fanzData = activeFanzDoc.data() as Fanz;
        
        let imageUrl = fanzData.imageUrl;

        if (fanzData.templateId) {
          try {
            const templateDoc = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
            if (templateDoc.exists()) {
              const templateData = templateDoc.data() as FanzTemplate;
              const equippedSkinData = templateData.skins?.find(s => s.id === fanzData.equippedSkin);
              
              let currentImageUrl = templateData.image;
              if (fanzData.imageUrl) currentImageUrl = fanzData.imageUrl;
              if (equippedSkinData) {
                currentImageUrl = equippedSkinData.imageUrl || currentImageUrl;
              }
              imageUrl = currentImageUrl;
            }
          } catch (error) {
            console.error("Error fetching template for avatar", error);
          }
        }
        
        const finalImageUrl = getImageUrl(imageUrl);
        setDefaultFanzUrl(finalImageUrl ? imageUrl : null);
      }
    }, (error) => {
      console.error("Error in UserProfileModal fanz listener:", error);
    });

    return () => unsubscribe();
  }, [profile.uid, profile.activeFanzId, profile.activeAction?.fanzId]);

  const handleSave = async () => {
    if (!pseudo.trim()) {
      setError('Le pseudo ne peut pas être vide.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const docRef = doc(db, 'users', profile.uid);
      await setDoc(docRef, { pseudo, language, photoURL, dataSaver, isMuted }, { merge: true });
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      setError(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setLoading(false);
    }
  };

  if (isAvatarPickerOpen) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-hidden">
        <Card className="w-full lg:max-w-[450px] h-full max-h-[90vh] relative flex flex-col p-4 sm:p-6 overflow-hidden">
          <button 
            onClick={() => setIsAvatarPickerOpen(false)}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter mb-4 sm:mb-6 pr-8">
            Choisir un avatar
          </h2>

          <div className="flex gap-4 mb-4 sm:mb-6 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
            <button 
              className={`font-bold uppercase text-xs sm:text-sm whitespace-nowrap ${avatarTab === 'flags' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-white'}`}
              onClick={() => setAvatarTab('flags')}
            >
              Drapeaux
            </button>
            <button 
              className={`font-bold uppercase text-xs sm:text-sm whitespace-nowrap ${avatarTab === 'fanz' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-white'}`}
              onClick={() => setAvatarTab('fanz')}
            >
              FANZ
            </button>
            <button 
              className={`font-bold uppercase text-xs sm:text-sm whitespace-nowrap ${avatarTab === 'skins' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-white'}`}
              onClick={() => setAvatarTab('skins')}
            >
              Skins
            </button>
          </div>

          <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {(avatarTab === 'flags' ? FLAG_AVATARS : 
                 avatarTab === 'fanz' ? FANZ_AVATARS.filter(f => ownedTemplateIds.includes(f.id.replace('avatar-', ''))) : 
                 SKIN_AVATARS.filter(s => ownedSkinIds.includes(s.id.replace('avatar-skin-', '')))).map(avatar => (
                <button
                  key={avatar.id}
                  onClick={() => {
                    setPhotoURL(avatar.url);
                    setIsAvatarPickerOpen(false);
                  }}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    photoURL === avatar.url ? 'border-orange-500 scale-105' : 'border-transparent hover:border-white/20'
                  }`}
                  title={avatar.label}
                >
                  <img src={getImageUrl(avatar.url)} alt={avatar.label} className="w-full h-full object-cover" />
                  {photoURL === avatar.url && (
                    <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                      <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white drop-shadow-md" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-hidden">
      <Card className="w-full lg:max-w-[450px] relative max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="p-2">
          <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter mb-6">
            Mon Profil
          </h2>

          <div className="space-y-6">
          {/* Avatar Selection */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-orange-500 shadow-xl shadow-orange-500/20 relative bg-black/50 flex items-center justify-center">
              {photoURL || defaultFanzUrl ? (
                <img src={getImageUrl(photoURL || defaultFanzUrl!)} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-12 h-12 text-gray-500" />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsAvatarPickerOpen(true)} className="text-xs py-1">
                Changer d'avatar
              </Button>
              {photoURL && (
                <Button variant="outline" onClick={() => setPhotoURL('')} className="text-xs py-1 text-red-400 hover:text-red-300 border-red-500/30 hover:bg-red-500/10">
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Pseudo</label>
              <input 
                type="text" 
                value={pseudo} 
                onChange={(e) => setPseudo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Email</label>
              <input 
                type="text" 
                value={profile.email} 
                disabled
                className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Langue</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-orange-500 outline-none appearance-none"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-gray-900 text-white">
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
              <div>
                <label className="block text-sm font-bold text-white mb-0.5">Mode Économie</label>
                <p className="text-xs text-gray-400">Désactive les vidéos pour économiser les données et la batterie.</p>
              </div>
              <button
                onClick={() => setDataSaver(!dataSaver)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dataSaver ? 'bg-orange-500' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dataSaver ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
              <div>
                <label className="block text-sm font-bold text-white mb-0.5">Musique & Ambiance</label>
                <p className="text-xs text-gray-400">Active le son pendant les parties et événements importants.</p>
              </div>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!isMuted ? 'bg-orange-500' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${!isMuted ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </div>
      </div>
      </Card>
    </div>
  );
}
