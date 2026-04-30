import React, { useEffect, useRef, useState } from 'react';
import { getImageUrl, cn } from '../lib/utils';
import { useInView } from 'motion/react';
import { audioManager } from '../lib/audio';

interface OptimizedMediaProps {
  src: string | null;
  type: 'image' | 'video';
  alt?: string;
  className?: string;
  poster?: string | null;
  dataSaver?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  width?: number;
  forceUnmuted?: boolean;
}

export function OptimizedMedia({
  src,
  type,
  alt = '',
  className = '',
  poster,
  dataSaver = false,
  autoPlay = true,
  loop = true,
  muted,
  controls = false,
  width,
  forceUnmuted = false,
}: OptimizedMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isInView = useInView(containerRef, { margin: "200px 0px" });
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isHoveredOrClicked, setIsHoveredOrClicked] = useState(false);
  const globalMuted = muted !== undefined ? muted : false;

  const finalSrc = src ? getImageUrl(src, width) : '';
  const finalPoster = poster ? getImageUrl(poster, width) : undefined;

  useEffect(() => {
    if (type === 'video' && videoRef.current && !dataSaver) {
      if (isInView && autoPlay) {
        videoRef.current.play().catch(e => {
          console.log("Autoplay prevented, retrying muted:", e);
          if (videoRef.current) {
             videoRef.current.muted = true;
             videoRef.current.play().catch(e2 => console.log("Still failed to play", e2));
          }
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isInView, type, dataSaver, autoPlay]);

  if (!finalSrc) {
    return <div className={`bg-gray-800 ${className}`} />;
  }

  // In Data Saver mode, fallback to image if it's a video
  if (type === 'video' && dataSaver) {
    if (finalPoster) {
      return (
        <img 
          src={finalPoster} 
          alt={alt} 
          className={cn(className, "object-cover")} 
          loading="lazy"
          decoding="async"
        />
      );
    }
    // If no poster is available, we MUST render the video tag without autoplay
    // so the browser can download metadata and show the first frame.
    return (
      <div ref={containerRef} className="w-full h-full relative">
        <video
          ref={videoRef}
          src={finalSrc}
          className={className}
          autoPlay={false}
          loop={false}
          muted={true}
          controls={false}
          playsInline
          preload="metadata"
        />
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div ref={containerRef} className="w-full h-full">
        {isInView ? (
          <video
            ref={videoRef}
            src={finalSrc}
            poster={finalPoster || undefined}
            className={cn(className, "cursor-pointer")}
            autoPlay={autoPlay}
            loop={loop}
            muted={forceUnmuted ? globalMuted : (!isHoveredOrClicked || globalMuted)}
            controls={controls}
            playsInline
            preload="metadata"
            onLoadedData={() => setHasLoaded(true)}
            onMouseEnter={() => setIsHoveredOrClicked(true)}
            onMouseLeave={() => setIsHoveredOrClicked(false)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsHoveredOrClicked(prev => !prev);
            }}
          />
        ) : (
          // Render poster or placeholder when out of view to save memory
          finalPoster ? (
            <img src={finalPoster} alt={alt} className={className} />
          ) : (
            <div className={`bg-gray-800 ${className}`} />
          )
        )}
      </div>
    );
  }

  // Image type
  return (
    <div ref={containerRef} className="w-full h-full">
      {isInView ? (
        <img
          src={finalSrc}
          alt={alt}
          className={className}
          loading="lazy"
          decoding="async"
          onLoad={() => setHasLoaded(true)}
        />
      ) : (
        <div className={`bg-gray-800 ${className}`} />
      )}
    </div>
  );
}
