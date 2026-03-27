import React, { useState } from 'react';
import { UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
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
  const [photoURL, setPhotoURL] = useState(profile.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [avatarTab, setAvatarTab] = useState<'flags' | 'fanz' | 'skins'>('flags');

  const handleSave = async () => {
    if (!pseudo.trim()) {
      setError('Le pseudo ne peut pas être vide.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const docRef = doc(db, 'users', profile.uid);
      await setDoc(docRef, { pseudo, language, photoURL }, { merge: true });
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
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <Card className="w-full max-w-2xl relative max-h-[80vh] flex flex-col">
          <button 
            onClick={() => setIsAvatarPickerOpen(false)}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-6">
            Choisir un avatar
          </h2>

          <div className="flex gap-4 mb-6 border-b border-white/10 pb-2">
            <button 
              className={`font-bold uppercase text-sm ${avatarTab === 'flags' ? 'text-orange-500' : 'text-gray-500 hover:text-white'}`}
              onClick={() => setAvatarTab('flags')}
            >
              Drapeaux
            </button>
            <button 
              className={`font-bold uppercase text-sm ${avatarTab === 'fanz' ? 'text-orange-500' : 'text-gray-500 hover:text-white'}`}
              onClick={() => setAvatarTab('fanz')}
            >
              FANZ
            </button>
            <button 
              className={`font-bold uppercase text-sm ${avatarTab === 'skins' ? 'text-orange-500' : 'text-gray-500 hover:text-white'}`}
              onClick={() => setAvatarTab('skins')}
            >
              Skins
            </button>
          </div>

          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {(avatarTab === 'flags' ? FLAG_AVATARS : avatarTab === 'fanz' ? FANZ_AVATARS : SKIN_AVATARS).map(avatar => (
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
                  <img src={getImageUrl(avatar.url)} alt={avatar.label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {photoURL === avatar.url && (
                    <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                      <Check className="w-8 h-8 text-white drop-shadow-md" />
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <Card className="w-full max-w-md relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-6">
          Mon Profil
        </h2>

        <div className="space-y-6">
          {/* Avatar Selection */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-orange-500 shadow-xl shadow-orange-500/20 relative bg-black/50 flex items-center justify-center">
              {photoURL ? (
                <img src={getImageUrl(photoURL)} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-12 h-12 text-gray-500" />
              )}
            </div>
            <Button variant="outline" onClick={() => setIsAvatarPickerOpen(true)} className="text-xs py-1">
              Changer d'avatar
            </Button>
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

            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
