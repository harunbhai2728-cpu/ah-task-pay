import React, { useEffect, useState } from 'react';
import {
  Send,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  Bot,
  Sliders,
  RotateCcw,
  RefreshCw,
  Bell,
  Save,
  ChevronDown,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export type TelegramTopicKey =
  | 'submission'
  | 'withdraw'
  | 'deposit'
  | 'registration'
  | 'login'
  | 'profile_update'
  | 'account_deletion'
  | 'support'
  | 'job_post'
  | 'job_edit'
  | 'job_delete_request'
  | 'ad_post'
  | 'balance_transfer'
  | 'redeem_code'
  | 'referral';

export interface TelegramBotConfig {
  id: string;
  name: string;
  botToken: string;
  chatId: string;
  threadId?: string;
  enabled: boolean;
  sendMode: 'all' | 'selected';
  topics: Record<string, boolean>;
}

export interface TelegramTopicControl {
  enabled: boolean;
  customTemplate: string;
}

export interface TelegramSettings {
  globalEnabled: boolean;
  bots: TelegramBotConfig[];
  topics: Record<TelegramTopicKey, TelegramTopicControl>;
}

interface TopicMeta {
  key: TelegramTopicKey;
  label: string;
  bnLabel: string;
  description: string;
  placeholders: string[];
}

const TOPIC_LIST: TopicMeta[] = [
  {
    key: 'submission',
    label: 'Job Submission',
    bnLabel: 'সাবমিশন',
    description: 'Worker submits proof for a microjob',
    placeholders: ['{jobTitle}', '{jobId}', '{user}', '{serial}', '{amount}', '{status}', '{time}'],
  },
  {
    key: 'withdraw',
    label: 'Withdraw Request',
    bnLabel: 'উইথড্র',
    description: 'User requests withdrawal via bKash, Nagad, or Recharge',
    placeholders: ['{user}', '{serial}', '{amount}', '{netAmount}', '{fee}', '{method}', '{phone}', '{time}'],
  },
  {
    key: 'deposit',
    label: 'Deposit Request',
    bnLabel: 'ডিপোজিট',
    description: 'User submits a deposit transaction',
    placeholders: ['{user}', '{serial}', '{amount}', '{method}', '{phone}', '{trxId}', '{time}'],
  },
  {
    key: 'registration',
    label: 'Account Registration',
    bnLabel: 'একাউন্ট রেজিষ্ট্রেশন',
    description: 'New user registers an account (includes Registration IP)',
    placeholders: ['{user}', '{serial}', '{email}', '{phone}', '{ip}', '{details}', '{time}'],
  },
  {
    key: 'login',
    label: 'User Login & IP',
    bnLabel: 'ইউজার লগইন ও আইপি',
    description: 'User logs in to the website (includes Login IP & Location)',
    placeholders: ['{user}', '{serial}', '{email}', '{ip}', '{details}', '{time}'],
  },
  {
    key: 'profile_update',
    label: 'Account Info Change',
    bnLabel: 'তথ্য পরিবর্তন রিকোয়েস্ট',
    description: 'Email, phone, username change requests, name or password updates',
    placeholders: ['{user}', '{serial}', '{email}', '{ip}', '{details}', '{time}'],
  },
  {
    key: 'account_deletion',
    label: 'Account Deletion Request',
    bnLabel: 'একাউন্ট ডিলিট রিকোয়েস্ট',
    description: 'User submits account deletion request or admin deletes account',
    placeholders: ['{user}', '{serial}', '{email}', '{ip}', '{status}', '{details}', '{time}'],
  },
  {
    key: 'support',
    label: 'Support Message',
    bnLabel: 'সাপোর্টে মেসেজ',
    description: 'New support ticket or reply inside a ticket',
    placeholders: ['{user}', '{serial}', '{subject}', '{sender}', '{status}', '{message}', '{time}'],
  },
  {
    key: 'job_post',
    label: 'New Job Posted',
    bnLabel: 'নতুন জব পোস্ট',
    description: 'Employer posts a new job campaign',
    placeholders: ['{user}', '{serial}', '{jobTitle}', '{amount}', '{details}', '{time}'],
  },
  {
    key: 'job_edit',
    label: 'Job Edit / Update',
    bnLabel: 'জব এডিট / আপডেট',
    description: 'Employer updates job reward, slots, or details',
    placeholders: ['{user}', '{serial}', '{jobTitle}', '{jobId}', '{details}', '{time}'],
  },
  {
    key: 'job_delete_request',
    label: 'Job Delete Request',
    bnLabel: 'জব ডিলিট রিকোয়েস্ট',
    description: 'Employer requests job deletion or cancels a pending job',
    placeholders: ['{user}', '{serial}', '{jobTitle}', '{jobId}', '{status}', '{details}', '{time}'],
  },
  {
    key: 'ad_post',
    label: 'Ad Post / Renew Request',
    bnLabel: 'বিজ্ঞাপন পোস্ট / রিনিউ',
    description: 'User submits or renews a banner advertisement',
    placeholders: ['{user}', '{serial}', '{amount}', '{details}', '{time}'],
  },
  {
    key: 'balance_transfer',
    label: 'Wallet Transfer',
    bnLabel: 'ব্যালেন্স ট্রান্সফার',
    description: 'User transfers funds between Earning & Deposit wallets',
    placeholders: ['{user}', '{serial}', '{amount}', '{netAmount}', '{details}', '{time}'],
  },
  {
    key: 'redeem_code',
    label: 'Redeem Code Claim',
    bnLabel: 'রিডিম কোড',
    description: 'User claims a promotional redeem code',
    placeholders: ['{user}', '{serial}', '{code}', '{amount}', '{time}'],
  },
  {
    key: 'referral',
    label: 'Referral Activity',
    bnLabel: 'রেফার',
    description: 'New referral registered or milestone reward claimed',
    placeholders: ['{user}', '{serial}', '{details}', '{time}'],
  },
];

const buildDefaultSettings = (): TelegramSettings => {
  const topics = {} as Record<TelegramTopicKey, TelegramTopicControl>;
  TOPIC_LIST.forEach((t) => {
    topics[t.key] = { enabled: true, customTemplate: '' };
  });
  return {
    globalEnabled: true,
    bots: [],
    topics,
  };
};

export function AdminTelegramControl() {
  const [settings, setSettings] = useState<TelegramSettings>(buildDefaultSettings);
  const [defaultTemplates, setDefaultTemplates] = useState<Record<string, string>>({});
  const [envFallbackConfigured, setEnvFallbackConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingBotId, setTestingBotId] = useState<string | null>(null);
  const [testingTopic, setTestingTopic] = useState<boolean>(false);
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  const [selectedTopicKey, setSelectedTopicKey] = useState<TelegramTopicKey>('submission');
  const [showControls, setShowControls] = useState(false);

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/telegram/settings?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load Telegram settings');
      if (json.settings) setSettings(json.settings);
      if (json.defaultTemplates) setDefaultTemplates(json.defaultTemplates);
      setEnvFallbackConfigured(Boolean(json.envFallbackConfigured));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load Telegram settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading('Saving Telegram settings...');
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/telegram/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save Telegram settings');
      if (json.settings) setSettings(json.settings);
      toast.success('Telegram bot & message settings saved!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const addNewBot = () => {
    const topicDefaults: Record<string, boolean> = {};
    TOPIC_LIST.forEach((t) => {
      topicDefaults[t.key] = true;
    });
    const nextBot: TelegramBotConfig = {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Telegram Bot #${settings.bots.length + 1}`,
      botToken: '',
      chatId: '',
      threadId: '',
      enabled: true,
      sendMode: 'all',
      topics: topicDefaults,
    };
    setSettings((prev) => ({
      ...prev,
      bots: [...prev.bots, nextBot],
    }));
    setVisibleTokens((prev) => ({ ...prev, [nextBot.id]: true }));
  };

  const updateBot = (botId: string, patch: Partial<TelegramBotConfig>) => {
    setSettings((prev) => ({
      ...prev,
      bots: prev.bots.map((b) => (b.id === botId ? { ...b, ...patch } : b)),
    }));
  };

  const toggleBotTopic = (botId: string, topicKey: TelegramTopicKey) => {
    setSettings((prev) => ({
      ...prev,
      bots: prev.bots.map((b) => {
        if (b.id !== botId) return b;
        const currentTopics = { ...(b.topics || {}) };
        currentTopics[topicKey] = !currentTopics[topicKey];
        return {
          ...b,
          sendMode: 'selected',
          topics: currentTopics,
        };
      }),
    }));
  };

  const removeBot = (botId: string) => {
    setSettings((prev) => ({
      ...prev,
      bots: prev.bots.filter((b) => b.id !== botId),
    }));
    toast.success('Bot removed from list (click Save to apply)');
  };

  const testSingleBot = async (bot: TelegramBotConfig, topic?: TelegramTopicKey) => {
    if (!bot.botToken.trim() || !bot.chatId.trim()) {
      toast.error('Please enter both Bot Token and Chat ID before testing');
      return;
    }
    setTestingBotId(bot.id);
    const toastId = toast.loading(`Sending test message to ${bot.name}...`);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          botToken: bot.botToken,
          chatId: bot.chatId,
          threadId: bot.threadId || '',
          topic,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Telegram test failed');
      toast.success(json.message || 'Test message sent!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test message', { id: toastId });
    } finally {
      setTestingBotId(null);
    }
  };

  const testSelectedTopic = async () => {
    const activeBot = settings.bots.find(
      (b) =>
        b.enabled &&
        b.botToken.trim() &&
        b.chatId.trim() &&
        (b.sendMode !== 'selected' || b.topics?.[selectedTopicKey]),
    );
    if (!activeBot) {
      toast.error('No enabled bot is assigned to this topic with a valid token & chat ID');
      return;
    }
    setTestingTopic(true);
    try {
      await testSingleBot(activeBot, selectedTopicKey);
    } finally {
      setTestingTopic(false);
    }
  };

  const selectedMeta =
    TOPIC_LIST.find((t) => t.key === selectedTopicKey) || TOPIC_LIST[0];
  const selectedTopicConfig = settings.topics[selectedTopicKey] || {
    enabled: true,
    customTemplate: '',
  };

  const activeBotsCount = settings.bots.filter(
    (b) => b.enabled && b.botToken.trim() && b.chatId.trim(),
  ).length;
  const activeTopicsCount = TOPIC_LIST.filter(
    (t) => settings.topics[t.key]?.enabled !== false,
  ).length;

  if (loading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 dark:border-slate-700 border-t-[#0B3D9E] dark:border-t-[#F97316] rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Loading Telegram Bot Controls...
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header Banner & Global Controls */}
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2rem] p-6 sm:p-8 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="bg-[#F97316] p-3.5 rounded-2xl text-white shadow-lg shrink-0">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">
              Telegram Bot & Message Control
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm font-medium mt-1">
              Manage multiple Telegram bots, Bot Tokens, Chat IDs, and per-topic message formatting.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span
                className={cn(
                  'px-3 py-1 rounded-lg border text-[11px] font-bold',
                  settings.globalEnabled
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
                    : 'bg-rose-500/20 border-rose-400/30 text-rose-200',
                )}
              >
                Master: {settings.globalEnabled ? 'ON' : 'OFF'}
              </span>
              <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-bold">
                Active Bots: {activeBotsCount} / {settings.bots.length}
              </span>
              <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-bold">
                Enabled Topics: {activeTopicsCount} / {TOPIC_LIST.length}
              </span>
              {envFallbackConfigured && settings.bots.length === 0 && (
                <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-bold text-emerald-200">
                  Env Fallback Bot Active
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowControls((prev) => !prev)}
            className="px-5 py-3 bg-white/15 hover:bg-white/25 border border-white/25 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            {showControls ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showControls ? 'Hide Settings' : 'Show Settings'}</span>
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-transform duration-200',
                showControls && 'rotate-180',
              )}
            />
          </button>

          {showControls && (
            <>
              <label className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-2.5 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.globalEnabled}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, globalEnabled: e.target.checked }))
                  }
                />
                <div className="relative w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                <span className="text-xs font-black uppercase tracking-wider">
                  {settings.globalEnabled ? 'Master ON' : 'Master OFF'}
                </span>
              </label>

              <button
                type="button"
                onClick={fetchSettings}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Telegram Settings'}
              </button>
            </>
          )}
        </div>
      </div>

      {!showControls ? (
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-[2rem] p-8 sm:p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-[#0B3D9E] dark:text-blue-300">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="font-display text-lg font-black text-slate-900 dark:text-white uppercase">
              Telegram Settings Hidden (Protected)
            </h3>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              হটাৎ ভুলে চাপ পড়ে যেন টেলিগ্রাম সেটিংস বা টপিক পরিবর্তন না হয় সেজন্য সেটিংসগুলো হাইড রাখা হয়েছে। পরিবর্তন করতে চাইলে নিচের Show Settings বাটনে ক্লিক করুন।
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowControls(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#07266E] hover:bg-[#0B3D9E] dark:bg-[#F97316] dark:hover:bg-[#EA580C] text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Show Settings</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Section 1: Multiple Bots Configuration */}
          <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#0B3D9E] dark:text-[#FB923C]" />
              Configured Telegram Bots
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Add one or multiple bots. Each bot can receive all topics or only specific selected topics.
            </p>
          </div>
          <button
            type="button"
            onClick={addNewBot}
            className="px-5 py-3 bg-[#07266E] hover:bg-[#0B3D9E] dark:bg-[#F97316] dark:hover:bg-[#EA580C] text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Bot
          </button>
        </div>

        {settings.bots.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] p-8 text-center space-y-3">
            <Bot className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
              No Telegram bots added yet.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Click "Add New Bot" to add your Telegram Bot Token and Chat ID. You can add multiple bots and route different topics to each bot.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {settings.bots.map((bot, index) => {
              const showToken = Boolean(visibleTokens[bot.id]);
              return (
                <div
                  key={bot.id}
                  className={cn(
                    'bg-slate-50 dark:bg-slate-800/60 border rounded-[2rem] p-6 space-y-5 transition-colors shadow-sm',
                    bot.enabled
                      ? 'border-slate-200 dark:border-slate-700'
                      : 'border-rose-200/70 dark:border-rose-900/40 opacity-80',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-[180px]">
                      <span className="w-8 h-8 rounded-xl bg-[#0B3D9E] dark:bg-[#F97316] text-white font-black text-xs flex items-center justify-center shrink-0">
                        #{index + 1}
                      </span>
                      <input
                        type="text"
                        value={bot.name}
                        onChange={(e) => updateBot(bot.id, { name: e.target.value })}
                        placeholder="Bot Label (e.g. Finance Bot)"
                        className="w-full px-3 py-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E]"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={bot.enabled}
                          onChange={(e) =>
                            updateBot(bot.id, { enabled: e.target.checked })
                          }
                        />
                        <div className="relative w-9 h-5 bg-slate-300 dark:bg-slate-600 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                        <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200">
                          {bot.enabled ? 'Active' : 'Paused'}
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeBot(bot.id)}
                        className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                        title="Remove Bot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Bot Token
                      </label>
                      <div className="relative">
                        <input
                          type={showToken ? 'text' : 'password'}
                          value={bot.botToken}
                          onChange={(e) =>
                            updateBot(bot.id, { botToken: e.target.value })
                          }
                          placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                          className="w-full pl-4 pr-11 py-3 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleTokens((prev) => ({
                              ...prev,
                              [bot.id]: !showToken,
                            }))
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                          title={showToken ? 'Hide Token' : 'Show Token'}
                        >
                          {showToken ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Chat ID / Group ID
                        </label>
                        <input
                          type="text"
                          value={bot.chatId}
                          onChange={(e) =>
                            updateBot(bot.id, { chatId: e.target.value })
                          }
                          placeholder="e.g. 8968701306 or -1001234567890"
                          className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Topic Thread ID (Optional)
                        </label>
                        <input
                          type="text"
                          value={bot.threadId || ''}
                          onChange={(e) =>
                            updateBot(bot.id, { threadId: e.target.value })
                          }
                          placeholder="For Group Topics only"
                          className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E]"
                        />
                      </div>
                    </div>

                    {/* Topic Routing Mode for this Bot */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Topics Sent to This Bot
                        </span>
                        <div className="flex gap-1.5 bg-white dark:bg-[#1E293B] p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => updateBot(bot.id, { sendMode: 'all' })}
                            className={cn(
                              'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                              bot.sendMode !== 'selected'
                                ? 'bg-[#07266E] dark:bg-[#F97316] text-white'
                                : 'text-slate-500 dark:text-slate-400',
                            )}
                          >
                            All Topics
                          </button>
                          <button
                            type="button"
                            onClick={() => updateBot(bot.id, { sendMode: 'selected' })}
                            className={cn(
                              'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                              bot.sendMode === 'selected'
                                ? 'bg-[#07266E] dark:bg-[#F97316] text-white'
                                : 'text-slate-500 dark:text-slate-400',
                            )}
                          >
                            Selected Only
                          </button>
                        </div>
                      </div>

                      {bot.sendMode === 'selected' && (
                        <div className="flex flex-wrap gap-1.5 p-3 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-700">
                          {TOPIC_LIST.map((t) => {
                            const checked = bot.topics?.[t.key] !== false;
                            return (
                              <button
                                key={t.key}
                                type="button"
                                onClick={() => toggleBotTopic(bot.id, t.key)}
                                className={cn(
                                  'px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5',
                                  checked
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0B3D9E] dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 line-through',
                                )}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {t.bnLabel}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => testSingleBot(bot)}
                        disabled={testingBotId === bot.id}
                        className="px-4 py-2.5 bg-white dark:bg-[#1E293B] hover:bg-blue-50 dark:hover:bg-slate-700 text-[#0B3D9E] dark:text-[#FB923C] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {testingBotId === bot.id ? 'Testing...' : 'Send Test Message'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Topic Message Controls & Custom Templates */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-700/80 space-y-6">
        <div>
          <h3 className="font-display text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#F97316]" />
            Topic Selection & Message Control (টপিক অনুযায়ী মেসেজ কন্ট্রোল)
          </h3>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
            Select any topic below to turn it ON/OFF, assign which bots receive it, or customize its Telegram message format.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Topic List Selector */}
          <div className="lg:col-span-5 space-y-2.5">
            {TOPIC_LIST.map((topic) => {
              const tCfg = settings.topics[topic.key] || {
                enabled: true,
                customTemplate: '',
              };
              const isSelected = selectedTopicKey === topic.key;
              const subscribedBotsCount = settings.bots.filter(
                (b) =>
                  b.enabled &&
                  (b.sendMode !== 'selected' || b.topics?.[topic.key] === true),
              ).length;

              return (
                <div
                  key={topic.key}
                  onClick={() => setSelectedTopicKey(topic.key)}
                  className={cn(
                    'p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3',
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/30 border-[#0B3D9E] dark:border-[#F97316] shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm text-slate-900 dark:text-white">
                        {topic.label}
                      </span>
                      <span className="text-xs font-bold text-[#0B3D9E] dark:text-[#FB923C]">
                        ({topic.bnLabel})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {topic.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        Bots: {subscribedBotsCount}
                      </span>
                      {tCfg.customTemplate?.trim() && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/50 text-[#F97316] dark:text-[#FB923C]">
                          Custom Template
                        </span>
                      )}
                    </div>
                  </div>

                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="relative inline-flex items-center cursor-pointer shrink-0"
                  >
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={tCfg.enabled !== false}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          topics: {
                            ...prev.topics,
                            [topic.key]: {
                              ...(prev.topics[topic.key] || { customTemplate: '' }),
                              enabled: e.target.checked,
                            },
                          },
                        }))
                      }
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                </div>
              );
            })}
          </div>

          {/* Topic Message Editor */}
          <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-[2rem] p-6 space-y-6 h-fit">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#0B3D9E] dark:text-[#FB923C]" />
                  <h4 className="font-display text-lg font-black text-slate-900 dark:text-white uppercase">
                    {selectedMeta.label} ({selectedMeta.bnLabel})
                  </h4>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  {selectedMeta.description}
                </p>
              </div>

              <button
                type="button"
                onClick={testSelectedTopic}
                disabled={testingTopic}
                className="px-4 py-2.5 bg-[#07266E] hover:bg-[#0B3D9E] dark:bg-[#F97316] dark:hover:bg-[#EA580C] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {testingTopic ? 'Sending...' : 'Test This Topic'}
              </button>
            </div>

            {/* Per-Bot Assignment for Selected Topic */}
            {settings.bots.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Deliver This Topic To Bots:
                </span>
                <div className="flex flex-wrap gap-2">
                  {settings.bots.map((bot) => {
                    const receives =
                      bot.sendMode !== 'selected' ||
                      bot.topics?.[selectedTopicKey] === true;
                    return (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => toggleBotTopic(bot.id, selectedTopicKey)}
                        className={cn(
                          'px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2',
                          receives
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                            : 'bg-white dark:bg-[#1E293B] text-slate-400 border-slate-200 dark:border-slate-700',
                        )}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {bot.name}
                        {!bot.enabled && ' (Paused)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Message Template Editor */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Message Template (HTML & Variables Supported)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      topics: {
                        ...prev.topics,
                        [selectedTopicKey]: {
                          ...(prev.topics[selectedTopicKey] || { enabled: true }),
                          customTemplate: '',
                        },
                      },
                    }))
                  }
                  className="text-xs font-bold text-[#0B3D9E] dark:text-[#FB923C] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Default
                </button>
              </div>

              <textarea
                rows={7}
                value={selectedTopicConfig.customTemplate}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    topics: {
                      ...prev.topics,
                      [selectedTopicKey]: {
                        ...(prev.topics[selectedTopicKey] || { enabled: true }),
                        customTemplate: e.target.value,
                      },
                    },
                  }))
                }
                placeholder={
                  defaultTemplates[selectedTopicKey] ||
                  'Leave blank to use default formatted message...'
                }
                className="w-full p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E] leading-relaxed"
              />

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Click any variable to insert into custom template:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMeta.placeholders.map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => {
                        const baseText =
                          selectedTopicConfig.customTemplate ||
                          defaultTemplates[selectedTopicKey] ||
                          '';
                        setSettings((prev) => ({
                          ...prev,
                          topics: {
                            ...prev.topics,
                            [selectedTopicKey]: {
                              ...(prev.topics[selectedTopicKey] || { enabled: true }),
                              customTemplate: baseText
                                ? `${baseText}\n${ph}`
                                : ph,
                            },
                          },
                        }));
                      }}
                      className="px-2.5 py-1 bg-white dark:bg-[#1E293B] hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-[11px] font-bold text-[#0B3D9E] dark:text-blue-300 cursor-pointer"
                    >
                      {ph}
                    </button>
                  ))}
                </div>
              </div>

              {!selectedTopicConfig.customTemplate?.trim() &&
                defaultTemplates[selectedTopicKey] && (
                  <div className="p-4 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Current Default Format
                    </span>
                    <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                      {defaultTemplates[selectedTopicKey]}
                    </pre>
                  </div>
                )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] hover:opacity-95 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Telegram Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
