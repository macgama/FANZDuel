import React, { useState, useRef } from 'react';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { getImageUrl } from '../lib/utils';

interface ImageUploadProps {
  currentImageUrl?: string;
  onUploadComplete: (url: string) => void;
  path: string; // e.g., 'users/uid/avatar.jpg' or 'fanz/fanzId/image.jpg'
  className?: string;
}

export function ImageUpload({ currentImageUrl, onUploadComplete, path, className = '' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Veuillez sélectionner une image ou une vidéo.');
      return;
    }

    // Validate size (e.g., max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Le fichier est trop volumineux (max 5MB).');
      return;
    }

    uploadFile(file);
  };

  const uploadFile = (file: File) => {
    setUploading(true);
    setError('');
    setProgress(0);

    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progressValue = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(progressValue);
      },
      (err) => {
        console.error('Upload error:', err);
        setError('Erreur lors du téléchargement.');
        setUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          onUploadComplete(downloadURL);
        } catch (err) {
          console.error('Error getting download URL:', err);
          setError('Erreur lors de la récupération du lien.');
        } finally {
          setUploading(false);
        }
      }
    );
  };

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*"
        className="hidden"
      />
      
      <div 
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative w-full h-full rounded-2xl overflow-hidden border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors group
          ${error ? 'border-red-500 bg-red-500/10' : 'border-white/20 hover:border-orange-500 bg-white/5 hover:bg-white/10'}
        `}
      >
        {currentImageUrl ? (
          <>
            {currentImageUrl.includes('.mp4') || currentImageUrl.includes('.webm') ? (
              <video src={getImageUrl(currentImageUrl)} autoPlay loop muted className="w-full h-full object-cover" />
            ) : (
              <img src={getImageUrl(currentImageUrl)} alt="Uploaded media" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-8 h-8 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-orange-500 transition-colors p-4 text-center">
            <ImageIcon className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Ajouter un média</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <div className="w-3/4 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-white">{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {error && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-[10px] text-red-500 font-bold bg-black/80 px-2 py-1 rounded-full">{error}</span>
        </div>
      )}
    </div>
  );
}
