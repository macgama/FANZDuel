import React, { useEffect, useRef } from 'react';

export function BuyMeACoffee() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear dynamic children to prevent duplicates
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';
    script.setAttribute('data-name', 'bmc-button');
    script.setAttribute('data-slug', 'thebestfanonline');
    script.setAttribute('data-color', '#FFDD00');
    script.setAttribute('data-emoji', '⚽');
    script.setAttribute('data-font', 'Cookie');
    script.setAttribute('data-text', 'Buy me a soccer fanz');
    script.setAttribute('data-outline-color', '#000000');
    script.setAttribute('data-font-color', '#000000');
    script.setAttribute('data-coffee-color', '#ffffff');

    // Make sure the script runs when appended
    containerRef.current.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div key="bmc-container" ref={containerRef} className="flex justify-center items-center py-4 relative z-20 min-h-[48px]" />
  );
}
