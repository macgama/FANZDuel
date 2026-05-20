import React from 'react';
import { cn } from '../lib/utils';
import { COLORS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  isMobileOnly?: boolean;
}

export function Layout({ children, className, containerClassName, isMobileOnly = false }: LayoutProps) {
  return (
    <div 
      className={cn("fixed inset-0 h-[100dvh] text-white font-sans flex justify-center bg-[#0a0a0a]", className)}
    >
      <div className={cn(
        "w-full h-[100dvh] relative flex flex-col overflow-hidden bg-grid-pattern",
        isMobileOnly ? "w-full lg:max-w-[450px] shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#0a0a0a] lg:border-x border-white/5" : "w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#0a0a0a] border-white/5",
        containerClassName
      )}>
        {children}
      </div>
    </div>
  );
}

export function Card({ children, className, onClick, style }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "rounded-xl border border-white/10 p-6 transition-all",
        onClick && "cursor-pointer hover:border-orange-500 hover:bg-white/5",
        className
      )}
      style={{ backgroundColor: COLORS.ink, ...style }}
    >
      {children}
    </div>
  );
}

export function Button({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: `bg-orange-600 hover:bg-orange-700 text-white`,
    secondary: `bg-white text-black hover:bg-gray-200`,
    outline: `border border-white/20 hover:border-orange-500 text-white`,
    destructive: `bg-red-600 hover:bg-red-700 text-white`,
  };

  const sizes = {
    sm: `px-4 py-2 text-xs`,
    md: `px-6 py-3 text-sm`,
    lg: `px-8 py-4 text-base`,
  };

  return (
    <button 
      className={cn(
        "rounded-lg font-bold transition-all duration-200 active:scale-95 hover:-translate-y-0.5 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
