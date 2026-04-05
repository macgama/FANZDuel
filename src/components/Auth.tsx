import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';
import { Card, Button } from './Layout';
import { INITIAL_USER_DATA } from '../constants';
import { footballApi } from '../services/footballApi';
import { Search, ChevronLeft, Star } from 'lucide-react';
import { useAlert } from '../context/AlertContext';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const { showAlert } = useAlert();
  const [step, setStep] = useState<'initial' | 'login' | 'register'>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudo, setPseudo] = useState('');
  
  const [teamSearch, setTeamSearch] = useState('');
  const [teamResults, setTeamResults] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [isSearchingTeam, setIsSearchingTeam] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    // Only auto-redirect to register if we are sure the user is authenticated 
    // but has no profile (this is handled by App.tsx rendering this component)
    // We don't want to force 'register' step if they just landed here.
  }, []);

  useEffect(() => {
    const searchTeams = async () => {
      if (teamSearch.length < 3) {
        setTeamResults([]);
        return;
      }
      setIsSearchingTeam(true);
      try {
        const results = await footballApi.searchTeams(teamSearch);
        setTeamResults(results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingTeam(false);
      }
    };
    
    const timeoutId = setTimeout(searchTeams, 500);
    return () => clearTimeout(timeoutId);
  }, [teamSearch]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        onAuthSuccess();
      } else {
        setStep('register');
        if (user.email) setEmail(user.email);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onAuthSuccess();
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('Compte introuvable. Voulez-vous vous inscrire ?');
      } else if (err.code === 'auth/wrong-password') {
        setError('Mot de passe incorrect.');
      } else {
        setError('Erreur de connexion. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) {
      setError('Veuillez sélectionner une équipe favorite.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      let user = auth.currentUser;
      
      if (!user) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      }

      const teamName = selectedTeam.team.name;
      const teamId = selectedTeam.team.id.toString();

      const teamPath = `teams/${teamId}`;
      let ferveurBonus = 0;
      let initialCards: string[] = [];
      let isFirstFan = false;

      try {
        const teamRef = doc(db, teamPath);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) {
          ferveurBonus = 10;
          initialCards = ['card_first_supporter'];
          isFirstFan = true;
          await setDoc(teamRef, {
            teamId: teamId,
            name: teamName,
            totalFerveur: 10,
            userCount: 1,
            averageFerveur: 10
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, teamPath);
      }

      const userPath = `users/${user.uid}`;
      try {
        await setDoc(doc(db, userPath), {
          ...INITIAL_USER_DATA,
          uid: user.uid,
          pseudo,
          email: user.email || email,
          favoriteTeams: [teamId],
          ferveurPoints: ferveurBonus,
          cards: initialCards,
          lastEnergyRefill: new Date().toISOString(),
          role: (user.email || email) === 'gael.manigley@gmail.com' ? 'admin' : 'client',
        });

        await logTransaction(user.uid, 'money', INITIAL_USER_DATA.money, 'Cadeau de Bienvenue');
        await logTransaction(user.uid, 'gems', INITIAL_USER_DATA.gems, 'Cadeau de Bienvenue');
        await logTransaction(user.uid, 'boost', INITIAL_USER_DATA.boostPoints, 'Cadeau de Bienvenue');
        await logTransaction(user.uid, 'energy', INITIAL_USER_DATA.energy, 'Cadeau de Bienvenue');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, userPath);
      }

      const fanzId = Math.random().toString(36).substring(7);
      const fanzPath = `fanz/${fanzId}`;
      try {
        await setDoc(doc(db, fanzPath), {
          id: fanzId,
          templateId: 'fanz-1',
          ownerUid: user.uid,
          name: `Bébé Fanzzy`,
          sport: 'soccer',
          imageUrl: 'gs://thebestfanonlinegas.firebasestorage.app/public/fanz/imageFanz001Skin000.png',
          videoUrl: 'gs://thebestfanonlinegas.firebasestorage.app/public/fanz/videoFanz001Skin000.mp4',
          stats: {
            force: 1, endurance: 1, mental: 1, bluff: 2,
            creativity: 1, social: 101, intelligence: 1, charisma: 101
          },
          xp: 0,
          level: 1,
          rank: 1,
          ferveurPoints: 0,
          ferveurLevel: 1,
          energy: 100,
          equippedCards: [],
          unlockedSkins: ['default'],
          unlockedEmotes: ['default'],
          equippedSkin: 'default',
          claimedRewards: [],
          claimedChoices: {},
          lifeActionProgress: {}
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, fanzPath);
      }

      // Trigger sequential alerts
      showAlert({
        title: "Bienvenue sur FANZ!",
        subtitle: "Préparez-vous à vibrer pour votre équipe.",
        type: "success"
      });

      showAlert({
        title: "Cadeau de Bienvenue",
        subtitle: "Voici de quoi bien démarrer !",
        rewards: [
          { type: 'money', amount: INITIAL_USER_DATA.money },
          { type: 'gems', amount: INITIAL_USER_DATA.gems },
          { type: 'boost', amount: INITIAL_USER_DATA.boostPoints },
          { type: 'energy', amount: INITIAL_USER_DATA.energy }
        ],
        type: "unlock"
      });

      if (isFirstFan) {
        showAlert({
          title: "Pionnier !",
          subtitle: `Vous êtes le TOUT PREMIER fan de ${teamName} !`,
          type: "success"
        });
      }

      showAlert({
        title: "Votre Premier FANZ",
        subtitle: "Prenez-en soin et faites-le évoluer !",
        videoUrl: 'gs://thebestfanonlinegas.firebasestorage.app/public/fanz/videoFanz001Skin000.mp4',
        type: "unlock"
      });

      setIsRegistered(true);
      onAuthSuccess();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Cet email est déjà utilisé. Veuillez vous connecter.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center flex-1 p-4">
      <Card className="w-full max-w-md">
        <h2 className="text-3xl font-black mb-6 text-center italic uppercase tracking-tighter">
          {step === 'initial' ? 'Rejoindre le Kop' : step === 'login' ? 'Bon retour' : 'Créer un compte'}
        </h2>
        
        {step === 'initial' && (
          <div className="space-y-6">
            <button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <GoogleIcon />
              Continuer avec Google
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-gray-500 text-xs font-bold uppercase">Ou avec email</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                onClick={() => setStep('login')}
                className="w-full"
              >
                Connexion
              </Button>
              <Button 
                onClick={() => setStep('register')}
                className="w-full"
              >
                Inscription
              </Button>
            </div>
          </div>
        )}

        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <button 
                type="button" 
                onClick={() => setStep('initial')}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-gray-400">Connexion</span>
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-orange-500 outline-none"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Mot de passe</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-orange-500 outline-none"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-500 text-sm">{error}</p>
                {error.includes('s\'inscrire') && (
                  <button 
                    type="button"
                    onClick={() => setStep('register')}
                    className="text-xs text-orange-500 font-bold uppercase mt-2 hover:underline"
                  >
                    Aller à l'inscription
                  </button>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        )}

        {step === 'register' && (
          isRegistered ? (
            <div className="text-center py-8 space-y-4">
              <div className="animate-bounce inline-block p-4 bg-orange-500 rounded-full mb-4">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold italic uppercase">Bienvenue au club !</h3>
              <p className="text-gray-400">Votre profil est en cours de création...</p>
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500 mx-auto mt-4"></div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <button 
                  type="button" 
                  onClick={() => setStep('initial')}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-bold text-gray-400">Inscription</span>
              </div>

              {!auth.currentUser && (
                <>
                  <div>
                    <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Email</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-orange-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Mot de passe</label>
                    <input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-orange-500 outline-none"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Pseudo</label>
                <input 
                  type="text" 
                  value={pseudo} 
                  onChange={(e) => setPseudo(e.target.value)}
                  placeholder="Votre nom de supporter"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-orange-500 outline-none"
                  required
                />
              </div>

              <div className="relative">
                <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Équipe Favorite</label>
                {selectedTeam ? (
                  <div className="flex items-center justify-between bg-white/5 border border-orange-500 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={selectedTeam.team.logo} alt="" className="w-6 h-6 object-contain" />
                      <span className="font-bold">{selectedTeam.team.name}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedTeam(null)}
                      className="text-xs text-gray-400 hover:text-white font-bold uppercase"
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input 
                        type="text" 
                        value={teamSearch} 
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Rechercher une équipe..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:border-orange-500 outline-none"
                      />
                    </div>
                    {isSearchingTeam && <p className="text-xs text-gray-500 mt-2 font-bold animate-pulse">Recherche en cours...</p>}
                    {teamResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {teamResults.map((result: any) => (
                          <div 
                            key={result.team.id}
                            onClick={() => {
                              setSelectedTeam(result);
                              setTeamSearch('');
                              setTeamResults([]);
                            }}
                            className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0"
                          >
                            <img src={result.team.logo} alt="" className="w-8 h-8 object-contain" />
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">{result.team.name}</span>
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest">{result.team.country}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-500 text-sm">{error}</p>
                  {error.includes('déjà utilisé') && (
                    <button 
                      type="button"
                      onClick={() => setStep('login')}
                      className="text-xs text-orange-500 font-bold uppercase mt-2 hover:underline"
                    >
                      Aller à la connexion
                    </button>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || (!selectedTeam && !auth.currentUser)}>
                {loading ? 'Traitement...' : 'S\'inscrire'}
              </Button>
            </form>
          )
        )}
      </Card>
    </div>
  );
}
