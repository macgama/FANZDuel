import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { INITIAL_USER_DATA } from '../constants';

export function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [isRegister, setIsRegister] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if first fan for this team
        const teamPath = `teams/${favoriteTeam}`;
        let ferveurBonus = 0;
        try {
          const teamRef = doc(db, teamPath);
          const teamSnap = await getDoc(teamRef);
          if (!teamSnap.exists()) {
            ferveurBonus = 10;
            await setDoc(teamRef, {
              teamId: favoriteTeam,
              name: favoriteTeam,
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
            email,
            favoriteTeams: [favoriteTeam],
            ferveurPoints: ferveurBonus,
            lastEnergyRefill: new Date().toISOString(),
            role: email === 'gael.manigley@gmail.com' ? 'admin' : 'client',
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, userPath);
        }

        // Create first FANZ
        const fanzId = Math.random().toString(36).substring(7);
        const fanzPath = `fanz/${fanzId}`;
        try {
          await setDoc(doc(db, fanzPath), {
            id: fanzId,
            ownerUid: user.uid,
            name: `Fanz #1`,
            sport: 'soccer',
            stats: {
              force: 1, endurance: 1, mental: 1, bluff: 1,
              creativity: 1, social: 1, intelligence: 1, charisma: 1
            },
            xp: 0,
            level: 1,
            ferveurPoints: 0,
            ferveurLevel: 1,
            energy: 100
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, fanzPath);
        }

      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <h2 className="text-3xl font-black mb-6 text-center italic uppercase tracking-tighter">
          {isRegister ? 'Join the Kop' : 'Welcome Back'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Pseudo</label>
                <input 
                  type="text" 
                  value={pseudo} 
                  onChange={(e) => setPseudo(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Favorite Team (Club or National)</label>
                <input 
                  type="text" 
                  value={favoriteTeam} 
                  onChange={(e) => setFavoriteTeam(e.target.value)}
                  placeholder="e.g. Marseille, France"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 outline-none"
                  required
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 outline-none"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Processing...' : isRegister ? 'Register' : 'Login'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isRegister ? 'Already a fan?' : 'New here?'} 
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="ml-2 text-orange-500 font-bold hover:underline"
          >
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>
      </Card>
    </div>
  );
}
