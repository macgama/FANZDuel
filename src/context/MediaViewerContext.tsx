import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { Badge } from '../components/ui/badge';

export interface MediaViewerData {
  url: string;
  type: 'image' | 'video';
  title?: string;
  description?: string;
  itemType?: 'card' | 'emote' | 'skin' | 'fanz' | 'life_action' | 'other';
  metadata?: any;
}

interface MediaViewerContextType {
  openMedia: (data: MediaViewerData) => void;
  closeMedia: () => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | null>(null);

export function useMediaViewer() {
  const context = useContext(MediaViewerContext);
  if (!context) {
    throw new Error('useMediaViewer must be used within a MediaViewerProvider');
  }
  return context;
}

export function MediaViewerProvider({ children }: { children: ReactNode }) {
  const [mediaData, setMediaData] = useState<MediaViewerData | null>(null);

  const openMedia = (data: MediaViewerData) => setMediaData(data);
  const closeMedia = () => setMediaData(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (mediaData) return; // don't open if already open

      if (target.tagName === 'IMG' || target.tagName === 'VIDEO') {
        const mediaElem = target as HTMLImageElement | HTMLVideoElement;
        
        // Ignore very small images (like icons) unless explicitly marked
        if (mediaElem.clientWidth < 40 && !mediaElem.dataset.viewerItemType) return;
        
        // Ignore SVG avatars from dicebear that don't have viewerItemType
        if (mediaElem.src.includes('dicebear') && !mediaElem.dataset.viewerItemType) return;

        // Skip if explicitly ignored
        if (mediaElem.dataset.viewerIgnore) return;

        // Ensure we stop propagation if we successfully intercept an img click
        e.stopPropagation();

        const type = target.tagName === 'VIDEO' ? 'video' : 'image';
        const url = mediaElem.src;
        const title = mediaElem.dataset.viewerTitle;
        const description = mediaElem.dataset.viewerDescription;
        const itemType = mediaElem.dataset.viewerItemType as any;
        const metadataRaw = mediaElem.dataset.viewerMetadata;
        
        let metadata = undefined;
        if (metadataRaw) {
          try {
            metadata = JSON.parse(metadataRaw);
          } catch(err) {
            console.error("Failed to parse metadata", err);
          }
        }

        openMedia({
          url,
          type,
          title,
          description,
          itemType,
          metadata
        });
      }
    };
    
    // Use capture phase to intercept before React onClick fires
    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [mediaData]);

  return (
    <MediaViewerContext.Provider value={{ openMedia, closeMedia }}>
      {children}
      <AnimatePresence>
        {mediaData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={closeMedia}
          >
            <button 
              onClick={closeMedia}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-white/20 rounded-full text-white transition-colors z-50"
            >
              <X className="w-8 h-8" />
            </button>

            <div 
              className="relative max-w-5xl w-full max-h-[85vh] flex flex-col items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              {mediaData.type === 'video' ? (
                <video
                  src={getImageUrl(mediaData.url)}
                  autoPlay
                  loop
                  controls
                  className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl"
                />
              ) : (
                <img
                  src={getImageUrl(mediaData.url)}
                  alt={mediaData.title || 'Media'}
                  className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              )}

              {/* Explanations section */}
              {(mediaData.title || mediaData.description || mediaData.itemType) && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-6 w-full max-w-2xl bg-gray-900/80 border border-gray-700 p-6 rounded-2xl shadow-xl text-white backdrop-blur-md"
                >
                  {mediaData.title && (
                    <div className="flex items-center gap-3 mb-2">
                       <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300">
                         {mediaData.title}
                       </h2>
                       {mediaData.itemType && (
                         <Badge variant="outline" className="uppercase text-[10px] tracking-wider border-orange-500/50 text-orange-300">
                           {mediaData.itemType.replace('_', ' ')}
                         </Badge>
                       )}
                    </div>
                  )}
                  {mediaData.description && (
                    <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                      {mediaData.description}
                    </p>
                  )}
                  
                  {/* Extra metadata presentation */}
                  {mediaData.metadata && (
                    <div className="mt-4 pt-4 border-t border-gray-700/50 flex flex-wrap gap-2 text-sm text-gray-300">
                       {mediaData.itemType === 'card' && (
                         <>
                           {mediaData.metadata.energyCost !== undefined && (
                             <span className="bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded">Coût: {mediaData.metadata.energyCost}⚡</span>
                           )}
                           {mediaData.metadata.fervorValue !== undefined && mediaData.metadata.fervorValue > 0 && (
                             <span className="bg-pink-900/30 text-pink-400 px-2 py-1 rounded">Ferveur: {mediaData.metadata.fervorValue}🔥</span>
                           )}
                           {mediaData.metadata.rarity && (
                             <span className="bg-purple-900/30 text-purple-400 px-2 py-1 rounded capitalize">Rareté: {mediaData.metadata.rarity}</span>
                           )}
                         </>
                       )}
                       {mediaData.itemType === 'fanz' && mediaData.metadata.stats && (
                          <div className="grid grid-cols-4 gap-2 w-full mt-2">
                            {Object.entries(mediaData.metadata.stats).map(([stat, val]) => (
                               <div key={stat} className="text-xs bg-gray-800 p-1.5 rounded text-center truncate">
                                 <span className="text-gray-500 block uppercase text-[9px] mb-0.5">{stat}</span>
                                 <span className="font-bold text-white">{val as number}</span>
                               </div>
                            ))}
                          </div>
                       )}
                       {mediaData.itemType === 'life_action' && (
                          <>
                             {mediaData.metadata.xpReward > 0 && (
                               <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded">Récompense XP: {mediaData.metadata.xpReward}</span>
                             )}
                             {mediaData.metadata.actionType && (
                               <span className="bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded capitalize">Type: {mediaData.metadata.actionType}</span>
                             )}
                          </>
                       )}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MediaViewerContext.Provider>
  );
}
