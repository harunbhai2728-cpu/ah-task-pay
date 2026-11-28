import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel"
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#02081B]/75 backdrop-blur-sm z-[100]"
            onClick={onCancel}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#0A1638] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#D7E3F7] dark:border-[#1E3B8A]/60 pointer-events-auto transition-colors"
            >
              <div className="flex items-center gap-4 mb-4 text-rose-600 dark:text-rose-400">
                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 rounded-full flex items-center justify-center shrink-0 transition-colors border border-rose-100 dark:border-rose-900/40">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-[#071845] dark:text-white">{title}</h2>
              </div>
              <p className="text-slate-600 dark:text-blue-100/80 font-medium mb-8">
                {message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 px-4 bg-[#EFF4FC] dark:bg-[#102255] text-[#07266E] dark:text-blue-100 rounded-xl font-bold hover:bg-[#E1ECFA] dark:hover:bg-[#173075] transition-colors"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-rose-500/20"
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
