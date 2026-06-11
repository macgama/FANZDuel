import React, { useState, useEffect } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase';
import { Card, Button } from './Layout';
import { Eye, EyeOff, CheckCircle2, AlertTriangle, Lock, LayoutGrid } from 'lucide-react';

interface ResetPasswordProps {
  oobCode: string;
  onClose: () => void;
}

export function ResetPassword({ oobCode, onClose }: ResetPasswordProps) {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkCode = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
      } catch (err: any) {
        console.error('Verify reset code error:', err);
        setError('Le lien de réinitialisation est invalide, expiré ou a déjà été utilisé.');
      } finally {
        setChecking(false);
      }
    };
    checkCode();
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset confirmation error:', err);
      if (err.code === 'auth/weak-password') {
        setError('Le mot de passe est trop faible. Veuillez choisir un mot de passe d\'au moins 6 caractères.');
      } else if (err.code === 'auth/expired-action-code') {
        setError('Le lien a expiré. Veuillez demander un nouveau lien de récupération.');
      } else {
        setError('Une erreur est survenue lors de la mise à jour. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center p-8 bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(249,115,22,0.15)] animate-pulse">
            <LayoutGrid className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
          <h2 className="text-xl font-bold uppercase tracking-wider text-white mt-2">Vérification de votre lien...</h2>
          <p className="text-xs text-gray-400">Veuillez patienter pendant que nous validons votre demande de réinitialisation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#0a0a0a]/95 backdrop-blur-md overflow-y-auto">
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      
      <Card className="w-full max-w-md relative z-10 border border-white/15 bg-[#121212] shadow-2xl p-6 sm:p-8">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-1">
            <Lock className="w-6 h-6 text-orange-500" />
          </div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
            Nouveau mot de passe
          </h2>
          {email && !success && (
            <p className="text-xs text-gray-400 text-center">
              Pour le compte : <span className="font-bold text-orange-500">{email}</span>
            </p>
          )}
        </div>

        {error && !success && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 mb-6 items-start">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-400 leading-relaxed">
              <p className="font-bold mb-1">Erreur</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {success ? (
          <div className="text-center py-6 space-y-6">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500 animate-bounce" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black uppercase text-white tracking-tight">Mot de passe modifié !</h3>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
                Votre mot de passe a été réinitialisé avec succès. Vous pouvez désormais vous connecter à l'application avec vos nouveaux identifiants.
              </p>
            </div>

            <Button onClick={onClose} className="w-full max-w-xs mx-auto">
              Se connecter
            </Button>
          </div>
        ) : error && email === '' ? (
          <div className="text-center py-4 space-y-6">
            <Button onClick={onClose} variant="outline" className="w-full">
              Retourner à l'accueil
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-xs uppercase font-bold text-gray-400">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 focus:border-orange-500 outline-none text-sm transition-colors text-white"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs uppercase font-bold text-gray-400">Confirmer le mot de passe</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer votre mot de passe"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 focus:border-orange-500 outline-none text-sm transition-colors text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer mon mot de passe'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
