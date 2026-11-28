import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  variant?: 'card' | 'embedded';
  scrollToTop?: boolean;
  scrollTargetRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize = 20,
  onPageChange,
  itemLabel = 'results',
  variant = 'card',
  scrollToTop = true,
  scrollTargetRef,
  className,
}: PaginationProps) {
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const handleSelectPage = (page: number) => {
    if (page < 1 || page > totalPages || page === safePage) return;
    onPageChange(page);

    if (scrollTargetRef?.current) {
      scrollTargetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (scrollToTop && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Build page numbers with ellipsis for large counts
  const getPageNumbers = (): (number | 'ellipsis-left' | 'ellipsis-right')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [1];
    const leftBound = Math.max(2, safePage - 1);
    const rightBound = Math.min(totalPages - 1, safePage + 1);

    if (leftBound > 2) {
      pages.push('ellipsis-left');
    }

    for (let p = leftBound; p <= rightBound; p++) {
      pages.push(p);
    }

    if (rightBound < totalPages - 1) {
      pages.push('ellipsis-right');
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors',
        variant === 'card'
          ? 'bg-white dark:bg-[#0A1638] border border-[#D7E3F7] dark:border-[#1C3882]/55 rounded-[2rem] p-4 sm:p-5 shadow-sm shadow-blue-950/[0.04]'
          : 'px-6 py-4 border-t border-[#D7E3F7] dark:border-[#1C3882]/55 bg-[#F2F6FE] dark:bg-[#06102B]/80',
        className
      )}
    >
      <div className="text-xs font-bold text-slate-500 dark:text-blue-200/70 tabular-nums text-center sm:text-left">
        Showing <span className="font-black text-[#071845] dark:text-white">{startItem}</span> to{' '}
        <span className="font-black text-[#071845] dark:text-white">{endItem}</span> of{' '}
        <span className="font-black text-[#071845] dark:text-white">{totalItems}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => handleSelectPage(safePage - 1)}
          disabled={safePage === 1}
          aria-label="Previous page"
          className="px-3.5 py-2 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 text-[#07266E] dark:text-blue-100 font-bold text-xs rounded-xl shadow-sm hover:bg-blue-50 dark:hover:bg-[#0D2159] hover:border-[#0B3D9E] dark:hover:border-[#FB923C] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden xs:inline sm:inline">Previous</span>
        </button>

        {/* Desktop / Tablet numbered buttons */}
        <div className="hidden sm:flex items-center gap-1.5">
          {pageNumbers.map((item) => {
            if (item === 'ellipsis-left' || item === 'ellipsis-right') {
              return (
                <span
                  key={item}
                  className="px-2 py-1 text-xs font-black text-slate-400 dark:text-blue-300/50 select-none"
                >
                  ...
                </span>
              );
            }

            const isActive = item === safePage;
            return (
              <button
                key={item}
                type="button"
                onClick={() => handleSelectPage(item)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'min-w-[36px] h-9 px-2.5 rounded-xl font-black text-xs transition-all tabular-nums cursor-pointer flex items-center justify-center',
                  isActive
                    ? 'bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] dark:from-[#F97316] dark:to-[#EA580C] text-white shadow-md shadow-blue-900/25 dark:shadow-orange-500/20'
                    : 'bg-[#F4F7FE] dark:bg-[#050F2B] text-[#07266E] dark:text-blue-100 border border-[#CEDDF6] dark:border-[#1E3B8A]/65 hover:bg-blue-50 dark:hover:bg-[#0D2159] hover:border-[#0B3D9E] dark:hover:border-[#FB923C]'
                )}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Mobile compact indicator */}
        <div className="sm:hidden text-xs font-black text-[#07266E] dark:text-blue-100 px-2.5 py-2 bg-[#F4F7FE] dark:bg-[#050F2B] rounded-xl border border-[#CEDDF6] dark:border-[#1E3B8A]/65 tabular-nums">
          Page {safePage} / {totalPages}
        </div>

        <button
          type="button"
          onClick={() => handleSelectPage(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Next page"
          className="px-3.5 py-2 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 text-[#07266E] dark:text-blue-100 font-bold text-xs rounded-xl shadow-sm hover:bg-blue-50 dark:hover:bg-[#0D2159] hover:border-[#0B3D9E] dark:hover:border-[#FB923C] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer"
        >
          <span className="hidden xs:inline sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
