import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { AppNotification } from '../types';
import { askNotificationPermission } from '../lib/pushNotifications';

export function NotificationBell({ onDark = false }: { onDark?: boolean }) {
  const { profile, user } = useAuth();
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
    if (user && 'Notification' in window) {
      if (Notification.permission === 'default') {
        askNotificationPermission(user.id);
      } else if (Notification.permission === 'granted') {
        askNotificationPermission(user.id); // Re-sync subscription if needed
      }
    }
    setIsOpen(!isOpen);
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
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#F97316] rounded-full border-2 border-white dark:border-[#07266E] ring-2 ring-orange-400/30"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-none border border-slate-200 dark:border-slate-700 py-4 z-50 overflow-hidden transition-colors"
          >
            <div className="px-4 pb-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] uppercase font-bold text-[#0B3D9E] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1 rounded-lg">
                    Mark Read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={clearNotifications} className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 rounded-lg">
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  <Bell className="w-8 h-8 opacity-20 mx-auto mb-3" />
                  <p className="text-sm font-medium">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                  {notifications.map((notif: AppNotification) => (
                    <div 
                      key={notif.id} 
                      className={`p-4 transition-colors cursor-pointer ${notif.isRead ? 'bg-white dark:bg-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-800/70' : 'bg-blue-50/60 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                      onClick={() => !notif.isRead && markAsRead(notif.id)}
                    >
                      <div className="flex gap-3">
                         <div className="mt-1">
                           {notif.isRead ? (
                             <div className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full" />
                           ) : (
                             <div className="w-2 h-2 bg-[#F97316] rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                           )}
                         </div>
                         <div className="flex-1">
                            <p className={`text-sm ${notif.isRead ? 'text-gray-600 dark:text-slate-400 font-medium' : 'text-gray-900 dark:text-white font-bold'}`}>
                              {notif.message}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-widest font-bold">
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
