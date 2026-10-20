import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface PaymentLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  labelPosition?: 'right' | 'bottom';
}

/**
 * Authentic bKash Brand Logo
 * Uses the official user-provided bKash icon with origami bird on magenta background.
 */
export function BkashLogo({
  className,
  size = 'md',
  showLabel = true,
  labelPosition = 'right'
}: PaymentLogoProps) {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    xs: { icon: 'w-6 h-6', text: 'text-[11px]', sub: 'text-[8px]', rounded: 'rounded-lg' },
    sm: { icon: 'w-8 h-8', text: 'text-xs', sub: 'text-[9px]', rounded: 'rounded-xl' },
    md: { icon: 'w-11 h-11 sm:w-12 sm:h-12', text: 'text-xs sm:text-sm', sub: 'text-[9px] sm:text-[10px]', rounded: 'rounded-2xl' },
    lg: { icon: 'w-14 h-14 sm:w-16 sm:h-16', text: 'text-sm sm:text-base', sub: 'text-[10px] sm:text-xs', rounded: 'rounded-2xl' },
    xl: { icon: 'w-18 h-18 sm:w-20 sm:h-20', text: 'text-base sm:text-lg', sub: 'text-xs sm:text-sm', rounded: 'rounded-3xl' },
  };

  const currentSize = sizeMap[size];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 select-none",
        labelPosition === 'bottom' ? 'flex-col justify-center text-center gap-1.5 w-full' : 'flex-row',
        className
      )}
    >
      <div
        className={cn(
          "shrink-0 relative overflow-hidden shadow-sm transition-all duration-300 group-hover:scale-105 border border-pink-100 dark:border-pink-900/30",
          currentSize.icon,
          currentSize.rounded
        )}
      >
        {!imgError ? (
          <img
            src="/assets/logos/bkash.png"
            alt="bKash"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-[#E2136E] flex items-center justify-center p-1.5">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
              <path d="M50 14L22 42L44 48L50 14Z" fill="#FFFFFF" />
              <path d="M50 14L78 30L62 46L50 14Z" fill="#FFE5F0" />
              <path d="M44 48L62 46L52 68L44 48Z" fill="#FFFFFF" />
              <path d="M22 42L44 48L32 64L22 42Z" fill="#FFB3D4" />
              <path d="M52 68L62 46L82 54L52 68Z" fill="#FFC9E2" />
              <path d="M52 68L44 86L32 64L52 68Z" fill="#FFFFFF" />
              <path d="M52 68L70 88L62 76L52 68Z" fill="#FFA5CC" />
            </svg>
          </div>
        )}
      </div>

      {showLabel && (
        <div className={cn("flex flex-col leading-tight", labelPosition === 'bottom' ? 'items-center text-center' : 'items-start text-left')}>
          <div className="flex items-center gap-1">
            <span className={cn("font-black tracking-tight text-[#E2136E] dark:text-[#ff4097]", currentSize.text)}>
              bKash
            </span>
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400">
              (বিকাশ)
            </span>
          </div>
          <span className={cn("font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider", currentSize.sub)}>
            Personal
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Authentic Nagad Brand Logo
 * Uses the official user-provided Nagad icon with circular swirl, runner emblem, and "নগদ".
 */
export function NagadLogo({
  className,
  size = 'md',
  showLabel = true,
  labelPosition = 'right'
}: PaymentLogoProps) {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    xs: { icon: 'w-6 h-6', text: 'text-[11px]', sub: 'text-[8px]', rounded: 'rounded-lg' },
    sm: { icon: 'w-8 h-8', text: 'text-xs', sub: 'text-[9px]', rounded: 'rounded-xl' },
    md: { icon: 'w-11 h-11 sm:w-12 sm:h-12', text: 'text-xs sm:text-sm', sub: 'text-[9px] sm:text-[10px]', rounded: 'rounded-2xl' },
    lg: { icon: 'w-14 h-14 sm:w-16 sm:h-16', text: 'text-sm sm:text-base', sub: 'text-[10px] sm:text-xs', rounded: 'rounded-2xl' },
    xl: { icon: 'w-18 h-18 sm:w-20 sm:h-20', text: 'text-base sm:text-lg', sub: 'text-xs sm:text-sm', rounded: 'rounded-3xl' },
  };

  const currentSize = sizeMap[size];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 select-none",
        labelPosition === 'bottom' ? 'flex-col justify-center text-center gap-1.5 w-full' : 'flex-row',
        className
      )}
    >
      <div
        className={cn(
          "shrink-0 relative overflow-hidden shadow-sm transition-all duration-300 group-hover:scale-105 border border-orange-100 dark:border-orange-900/30",
          currentSize.icon,
          currentSize.rounded
        )}
      >
        {!imgError ? (
          <img
            src="/assets/logos/nagad.jpg"
            alt="Nagad"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#F7941D] to-[#ED1C24] flex items-center justify-center p-1.5">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
              <path
                d="M50 12C28 12 14 30 18 52C21 68 34 82 52 84C72 86 86 70 84 50C83 38 74 28 64 26C54 24 45 31 46 41C47 48 53 54 60 53C65 52 68 47 67 43C65 37 57 37 55 42C54 44 55 46 57 46C58 46 59 45 59 44"
                stroke="#FFFFFF"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <circle cx="50" cy="50" r="6" fill="#FFFFFF" />
            </svg>
          </div>
        )}
      </div>

      {showLabel && (
        <div className={cn("flex flex-col leading-tight", labelPosition === 'bottom' ? 'items-center text-center' : 'items-start text-left')}>
          <div className="flex items-center gap-1">
            <span className={cn("font-black tracking-tight text-[#F15A24] dark:text-[#ff7442]", currentSize.text)}>
              Nagad
            </span>
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400">
              (নগদ)
            </span>
          </div>
          <span className={cn("font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider", currentSize.sub)}>
            Personal
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Authentic Mobile Recharge Brand Logo
 * Uses the official user-provided recharge icon featuring Banglalink, Teletalk, GP, Robi, Airtel.
 */
export function RechargeLogo({
  className,
  size = 'md',
  showLabel = true,
  labelPosition = 'right'
}: PaymentLogoProps) {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    xs: { icon: 'w-6 h-6', text: 'text-[11px]', sub: 'text-[8px]', rounded: 'rounded-lg' },
    sm: { icon: 'w-8 h-8', text: 'text-xs', sub: 'text-[9px]', rounded: 'rounded-xl' },
    md: { icon: 'w-11 h-11 sm:w-12 sm:h-12', text: 'text-xs sm:text-sm', sub: 'text-[9px] sm:text-[10px]', rounded: 'rounded-2xl' },
    lg: { icon: 'w-14 h-14 sm:w-16 sm:h-16', text: 'text-sm sm:text-base', sub: 'text-[10px] sm:text-xs', rounded: 'rounded-2xl' },
    xl: { icon: 'w-18 h-18 sm:w-20 sm:h-20', text: 'text-base sm:text-lg', sub: 'text-xs sm:text-sm', rounded: 'rounded-3xl' },
  };

  const currentSize = sizeMap[size];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 select-none",
        labelPosition === 'bottom' ? 'flex-col justify-center text-center gap-1.5 w-full' : 'flex-row',
        className
      )}
    >
      <div
        className={cn(
          "shrink-0 relative overflow-hidden shadow-sm transition-all duration-300 group-hover:scale-105 border border-sky-100 dark:border-sky-900/30",
          currentSize.icon,
          currentSize.rounded
        )}
      >
        {!imgError ? (
          <img
            src="/assets/logos/recharge.jpg"
            alt="Mobile Recharge"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0284C7] to-[#10B981] flex items-center justify-center p-1.5">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
              <rect x="24" y="12" width="52" height="76" rx="12" stroke="#FFFFFF" strokeWidth="7" fill="#0369A1" fillOpacity="0.3" />
              <path d="M53 30L37 51H49L47 70L63 48H51L53 30Z" fill="#FACC15" stroke="#FFFFFF" strokeWidth="3" />
            </svg>
          </div>
        )}
      </div>

      {showLabel && (
        <div className={cn("flex flex-col leading-tight", labelPosition === 'bottom' ? 'items-center text-center' : 'items-start text-left')}>
          <div className="flex items-center gap-1">
            <span className={cn("font-black tracking-tight text-[#0284C7] dark:text-[#38bdf8]", currentSize.text)}>
              Recharge
            </span>
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400">
              (রিচার্জ)
            </span>
          </div>
          <span className={cn("font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider", currentSize.sub)}>
            All SIM
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Universal Payment Method Logo Renderer
 */
export function PaymentMethodLogo({
  method,
  size = 'md',
  showLabel = true,
  labelPosition = 'right',
  className
}: {
  method?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  labelPosition?: 'right' | 'bottom';
  className?: string;
}) {
  const norm = (method || '').toLowerCase();

  if (norm.includes('bkash') || norm.includes('বিকাশ')) {
    return <BkashLogo size={size} showLabel={showLabel} labelPosition={labelPosition} className={className} />;
  }
  if (norm.includes('nagad') || norm.includes('নগদ')) {
    return <NagadLogo size={size} showLabel={showLabel} labelPosition={labelPosition} className={className} />;
  }
  if (norm.includes('recharge') || norm.includes('রিচার্জ') || norm.includes('mobile')) {
    return <RechargeLogo size={size} showLabel={showLabel} labelPosition={labelPosition} className={className} />;
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center font-black text-gray-600 dark:text-slate-300">
        ৳
      </div>
      {showLabel && <span className="font-bold text-gray-800 dark:text-slate-200">{method}</span>}
    </div>
  );
}
