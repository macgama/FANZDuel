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

  const getFallbackSrc = (originalSrc: string | null): string => {
    if (!originalSrc) return 'https://thebestfan.online/img/public/logo/imageMydeck.png';
    const lower = originalSrc.toLowerCase();
    if (lower.includes('emote') || lower.includes('social')) {
      return 'https://thebestfan.online/img/public/logo/imageSocial.png';
    }
    if (lower.includes('skin') || lower.includes('fanz') || lower.includes('myfan')) {
      return 'https://thebestfan.online/img/public/logo/imageMyfan.png';
    }
    if (lower.includes('action') || lower.includes('force')) {
      return 'https://thebestfan.online/img/public/logo/imageForce.png';
    }
    return 'https://thebestfan.online/img/public/logo/imageMydeck.png';
  };

  const [imgSrc, setImgSrc] = useState(finalSrc);
  const [posterSrc, setPosterSrc] = useState(finalPoster);

  useEffect(() => {
    setImgSrc(finalSrc || '');
  }, [finalSrc]);

  useEffect(() => {
    setPosterSrc(finalPoster);
  }, [finalPoster]);

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

  if (!imgSrc) {
    return <div className={`bg-gray-800 ${className}`} />;
  }

  // In Data Saver mode, fallback to image if it's a video
  if (type === 'video' && dataSaver) {
    if (posterSrc) {
      return (
        <img 
          src={posterSrc} 
          alt={alt} 
          className={cn(className, "object-cover")} 
          loading="lazy"
          decoding="async"
          onError={() => {
            const fallback = getFallbackSrc(poster);
            if (posterSrc !== fallback) setPosterSrc(fallback);
          }}
        />
      );
    }
    // If no poster is available, we MUST render the video tag without autoplay
    // so the browser can download metadata and show the first frame.
    return (
      <div ref={containerRef} className="w-full h-full relative">
        <video
          ref={videoRef}
          src={imgSrc}
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
            src={imgSrc}
            poster={posterSrc || undefined}
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
          posterSrc ? (
            <img 
              src={posterSrc} 
              alt={alt} 
              className={className} 
              onError={() => {
                const fallback = getFallbackSrc(poster);
                if (posterSrc !== fallback) setPosterSrc(fallback);
              }}
            />
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
          src={imgSrc}
          alt={alt}
          className={className}
          loading="lazy"
          decoding="async"
          onLoad={() => setHasLoaded(true)}
          onError={() => {
            const fallback = getFallbackSrc(src);
            if (imgSrc !== fallback) setImgSrc(fallback);
          }}
        />
      ) : (
        <div className={`bg-gray-800 ${className}`} />
      )}
    </div>
  );
}
