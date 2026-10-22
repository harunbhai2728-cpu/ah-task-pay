import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  variant?: 'image' | 'icon' | 'badge';
  iconOnly?: boolean;
}

/**
 * Authentic Brand Logo Component for AH Task Pay
 * Displays the user's official custom logo seamlessly across light and dark themes
 */
export function BrandLogo({ 
  className, 
  size = 'md', 
  showSubtitle = false,
  variant = 'image',
  iconOnly = false 
}: BrandLogoProps) {
  const [imageError, setImageError] = useState(false);

  // Sizing maps
  const heightClasses = {
    sm: 'h-8 md:h-9 max-w-[140px]',
    md: 'h-10 md:h-11 max-w-[180px]',
    lg: 'h-14 md:h-16 max-w-[240px]',
    xl: 'h-20 md:h-24 max-w-[320px]',
  };

  const iconSizes = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-16 h-16 rounded-2xl',
    xl: 'w-24 h-24 rounded-3xl',
  };

  if (iconOnly || variant === 'icon') {
    return (
      <div 
        className={cn(
          "relative overflow-hidden shrink-0 shadow-md bg-white p-1 border border-slate-200/80 dark:border-slate-700 transition-transform duration-200 hover:scale-105",
          iconSizes[size],
          className
        )}
      >
        <img
          src="/app-logo.png"
          alt="AH Task Pay Logo"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center select-none group", className)}>
      {/* Official Brand Logo with Light Container for Perfect Dark Mode Contrast */}
      <div 
        className={cn(
          "relative inline-flex items-center justify-center bg-white dark:bg-white/95 px-2.5 py-1 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-600/50 transition-all duration-300 group-hover:shadow-md group-hover:scale-[1.02]",
          heightClasses[size]
        )}
      >
        {!imageError ? (
          <img
            src="/assets/logos/brand-logo-trimmed.png"
            alt="AH Task Pay"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-auto h-full object-contain max-h-full"
          />
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 font-black text-slate-900">
            <span className="text-blue-700">AH</span>
            <span className="text-slate-800">Task</span>
            <span className="text-amber-500">PAY</span>
          </div>
        )}
      </div>

      {showSubtitle && (
        <span className="ml-2.5 font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] text-[10px] hidden sm:inline-block">
          Microjob & Earn
        </span>
      )}
    </div>
  );
}
