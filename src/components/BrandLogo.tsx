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

  // Sizing maps tuned for the horizontal AH Task Pay lockup
  const heightClasses = {
    sm: 'h-9 md:h-10 max-w-[165px]',
    md: 'h-11 md:h-12 max-w-[215px]',
    lg: 'h-16 md:h-18 max-w-[280px]',
    xl: 'h-20 md:h-24 max-w-[340px]',
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
      {/* Official Brand Logo with Light Container for Perfect Contrast */}
      <div 
        className={cn(
          "relative inline-flex items-center justify-center bg-white dark:bg-white/95 px-3 py-1.5 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-600/50 transition-all duration-300 group-hover:shadow-md group-hover:scale-[1.02]",
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
            <span className="text-[#07266E]">AH TASK</span>
            <span className="text-[#F97316]">PAY</span>
          </div>
        )}
      </div>

      {showSubtitle && (
        <span className="ml-2.5 font-bold text-[#0B3D9E] dark:text-blue-400 uppercase tracking-[0.2em] text-[10px] hidden sm:inline-block">
          Microjob & Earn
        </span>
      )}
    </div>
  );
}
