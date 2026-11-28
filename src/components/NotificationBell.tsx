import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { AppNotification } from '../types';
import { askNotificationPermission } from '../lib/pushNotifications';

export function NotificationBell({ onDark = false }: { onDark?: boolean }) {
  const { profile, user, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifications = profile?.notifications || [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = async () => {
    const nextOpen = !isOpen;
    if (nextOpen && user) {
      void refreshProfile();
    }
    if (user && 'Notification' in window) {
      if (Notification.permission === 'default') {
        askNotificationPermission(user.id);
      } else if (Notification.permission === 'granted') {
        askNotificationPermission(user.id); // Re-sync subscription if needed
      }
    }
    setIsOpen(nextOpen);
  };

  const markAsRead = async (id: string) => {
    if (!profile) return;
    const updated = notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    );
    await supabase.from('profiles').update({
      notifications: updated
    }).eq('id', profile.uid);
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    await supabase.from('profiles').update({
      notifications: updated
    }).eq('id', profile.uid);
  };

  const clearNotifications = async () => {
    if (!profile) return;
    await supabase.from('profiles').update({
      notifications: []
    }).eq('id', profile.uid);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleBellClick}
        className={`relative p-2 rounded-xl transition-colors ${
          onDark
            ? 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#F97316] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#07266E] shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#0A1638] rounded-2xl shadow-2xl shadow-blue-950/20 dark:shadow-none border border-[#D7E3F7] dark:border-[#1E3B8A]/60 py-4 z-50 overflow-hidden transition-colors"
          >
            <div className="px-4 pb-3 border-b border-[#E3ECFA] dark:border-[#1C3882]/60 flex items-center justify-between">
              <h3 className="font-bold text-[#071845] dark:text-white">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] uppercase font-bold text-[#0B3D9E] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-[#11255C] px-2 py-1 rounded-lg">
                    Mark Read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={clearNotifications} className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2 py-1 rounded-lg">
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-blue-200/50">
                  <Bell className="w-8 h-8 opacity-25 mx-auto mb-3" />
                  <p className="text-sm font-medium">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E3ECFA] dark:divide-[#1C3882]/50">
                  {notifications.map((notif: AppNotification) => (
                    <div 
                      key={notif.id} 
                      className={`p-4 transition-colors cursor-pointer ${notif.isRead ? 'bg-white dark:bg-[#0A1638] hover:bg-[#F3F7FE] dark:hover:bg-[#0E1E4B]' : 'bg-[#EFF5FF] dark:bg-[#0F2459] hover:bg-[#E4EEFF] dark:hover:bg-[#132B69]'}`}
                      onClick={() => !notif.isRead && markAsRead(notif.id)}
                    >
                      <div className="flex gap-3">
                         <div className="mt-0.5 shrink-0">
                           {notif.type === 'approved' ? (
                             <CheckCircle2 className={cnCheck(notif.isRead, 'approved')} />
                           ) : notif.type === 'rejected' ? (
                             <XCircle className={cnCheck(notif.isRead, 'rejected')} />
                           ) : notif.isRead ? (
                             <div className="w-2 h-2 mt-1.5 bg-slate-300 dark:bg-blue-800 rounded-full" />
                           ) : (
                             <div className="w-2 h-2 mt-1.5 bg-[#F97316] rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                           )}
                         </div>
                         <div className="flex-1">
                            <p className={`text-sm leading-snug ${notif.isRead ? 'text-slate-600 dark:text-blue-100/70 font-medium' : 'text-[#071845] dark:text-white font-bold'}`}>
                              {notif.message}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-blue-200/50 mt-1 uppercase tracking-widest font-bold tabular-nums">
                               {new Date(notif.createdAt).getTime() > 0 ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true }) : 'Just now'}
                            </p>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cnCheck(isRead: boolean, status: 'approved' | 'rejected') {
  if (status === 'approved') {
    return `w-4 h-4 ${isRead ? 'text-emerald-500/60 dark:text-emerald-400/50' : 'text-emerald-600 dark:text-emerald-400'}`;
  }
  return `w-4 h-4 ${isRead ? 'text-rose-500/60 dark:text-rose-400/50' : 'text-rose-600 dark:text-rose-400'}`;
}
