import React from 'react';
import { Sparkles, CircleDollarSign } from 'lucide-react';
import { cn } from '../lib/utils';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "bg-gradient-to-br from-indigo-600 to-indigo-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200",
        size === 'sm' ? 'p-1' : size === 'md' ? 'p-2' : 'p-3'
      )}>
        <CircleDollarSign className={iconSizes[size]} />
      </div>
      <div className="flex flex-col -space-y-1">
        <span className={cn("font-black tracking-tighter text-gray-900 dark:text-white transition-colors uppercase", textSizes[size])}>
          AH Task <span className="text-orange-500">PAY</span>
        </span>
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none">
          Microjob Platform
        </span>
      </div>
    </div>
  );
}
