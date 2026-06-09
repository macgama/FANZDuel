import React from 'react';

export function BuyMeACoffee() {
  return (
    <div className="flex justify-center items-center py-4 relative z-20 min-h-[48px]">
      <a 
        href="https://www.buymeacoffee.com/thebestfanonline" 
        target="_blank" 
        rel="noopener noreferrer"
        className="transition-transform hover:scale-105 active:scale-95"
      >
        <img 
          src="https://img.buymeacoffee.com/button-api/?text=Buy me a soccer fanz&emoji=⚽&slug=thebestfanonline&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" 
          alt="Buy me a soccer fanz" 
          className="h-[40px] md:h-[50px] object-contain"
        />
      </a>
    </div>
  );
}
