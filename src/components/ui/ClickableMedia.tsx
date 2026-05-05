import React from 'react';
import { useMediaViewer, MediaViewerData } from '../../context/MediaViewerContext';

interface ClickableMediaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  mediaData: MediaViewerData;
  disabled?: boolean;
}

export function ClickableMedia({ children, mediaData, disabled, className, onClick, ...props }: ClickableMediaProps) {
  const { openMedia } = useMediaViewer();

  return (
    <div 
      className={`relative ${disabled ? '' : 'cursor-pointer'} ${className || ''}`}
      onClick={(e) => {
        if (!disabled) {
          e.stopPropagation();
          openMedia(mediaData);
        }
        if (onClick) onClick(e as any);
      }}
      {...props}
    >
      {children}
    </div>
  );
}
