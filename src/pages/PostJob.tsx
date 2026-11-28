import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  PlusCircle,
  Send,
  AlertCircle,
  Zap,
  Globe,
  CheckCircle2,
  Search,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  X,
  Wallet
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, cn } from '../lib/utils';

interface CountryOption {
  code: string;
  name: string;
  region: string;
}

interface SubCategoryOption {
  name: string;
  defaultPrice: number;
}

interface MainCategoryOption {
  id: string;
  name: string;
  subCategories: SubCategoryOption[];
}

interface ProofField {
  id: string;
  type: 'text' | 'screenshot';
  instruction: string;
}

const TARGET_COUNTRIES: CountryOption[] = [
  { code: 'ALL', name: 'Worldwide (All Countries)', region: 'Global' },
  { code: 'BD', name: 'Bangladesh', region: 'Asia' },
  { code: 'US', name: 'United States', region: 'North America' },
  { code: 'IN', name: 'India', region: 'Asia' },
  { code: 'UK', name: 'United Kingdom', region: 'Europe' },
  { code: 'CA', name: 'Canada', region: 'North America' },
  { code: 'PK', name: 'Pakistan', region: 'Asia' },
  { code: 'ID', name: 'Indonesia', region: 'Asia' },
  { code: 'PH', name: 'Philippines', region: 'Asia' },
  { code: 'NG', name: 'Nigeria', region: 'Africa' },
  { code: 'BR', name: 'Brazil', region: 'South America' },
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'AU', name: 'Australia', region: 'Oceania' },
  { code: 'MY', name: 'Malaysia', region: 'Asia' },
  { code: 'AE', name: 'United Arab Emirates', region: 'Middle East' },
  { code: 'SA', name: 'Saudi Arabia', region: 'Middle East' },
];

const JOB_CATEGORIES: MainCategoryOption[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    subCategories: [
      { name: 'Watch Video (2+ Min)', defaultPrice: 3 },
      { name: 'Like & Subscribe', defaultPrice: 4 },
      { name: 'Watch, Like, Comment & Subscribe', defaultPrice: 6 },
      { name: 'YouTube Shorts Engagement', defaultPrice: 2.5 },
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    subCategories: [
      { name: 'Page Like & Follow', defaultPrice: 3 },
      { name: 'Post Like, Comment & Share', defaultPrice: 4 },
      { name: 'Watch Facebook Video / Reels', defaultPrice: 3 },
      { name: 'Group Join & Invite', defaultPrice: 5 },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    subCategories: [
      { name: 'New Fresh Gmail', defaultPrice: 20 },
      { name: 'Old Gmail', defaultPrice: 25 },
      { name: 'New 2FA Gmail', defaultPrice: 25 },
      { name: 'Old 2FA Gmail', defaultPrice: 30 },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    subCategories: [
      { name: 'Follow Account', defaultPrice: 3 },
      { name: 'Video Like, Comment & Share', defaultPrice: 4 },
      { name: 'Watch Video & Repost', defaultPrice: 3 },
      { name: 'TikTok Bio Link / Shop Click', defaultPrice: 4 },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    subCategories: [
      { name: 'Channel / Group Join', defaultPrice: 2 },
      { name: 'Bot Start & Verify', defaultPrice: 4 },
      { name: 'Telegram Mini App / Refer', defaultPrice: 6 },
      { name: 'Post View & Reaction', defaultPrice: 2 },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    subCategories: [
      { name: 'Channel Follow & React', defaultPrice: 3 },
      { name: 'Group Join', defaultPrice: 3 },
      { name: 'Status View / Share', defaultPrice: 4 },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    subCategories: [
      { name: 'Follow Account', defaultPrice: 3 },
      { name: 'Like, Comment & Save Post', defaultPrice: 4 },
      { name: 'Watch Reels & Share', defaultPrice: 3 },
    ],
  },
  {
    id: 'twitter_x',
    name: 'Twitter / X',
    subCategories: [
      { name: 'Follow Profile', defaultPrice: 3 },
      { name: 'Like, Retweet & Comment', defaultPrice: 5 },
      { name: 'Poll Vote / Bookmark', defaultPrice: 2.5 },
    ],
  },
  {
    id: 'app_install',
    name: 'App Install',
    subCategories: [
      { name: 'Play Store Install & Open', defaultPrice: 8 },
      { name: 'Install, Register & Review', defaultPrice: 15 },
      { name: 'App Testing & Feedback', defaultPrice: 12 },
    ],
  },
  {
    id: 'website_visit',
    name: 'Website Visit',
    subCategories: [
      { name: 'Visit Website & Stay 1 Min', defaultPrice: 2 },
      { name: 'Search, Visit & Click Post', defaultPrice: 4 },
      { name: 'Website Sign Up / Account Create', defaultPrice: 10 },
    ],
  },
  {
    id: 'account_signup',
    name: 'Account Sign Up',
    subCategories: [
      { name: 'Simple Email Sign Up', defaultPrice: 8 },
      { name: 'Social / App Account Sign Up', defaultPrice: 12 },
      { name: 'Referral Sign Up & Active', defaultPrice: 15 },
      { name: 'Phone Verified Sign Up', defaultPrice: 25 },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    subCategories: [
      { name: 'Join Server & Verify', defaultPrice: 4 },
      { name: 'Server Chat & Reaction', defaultPrice: 5 },
      { name: 'Invite Friends to Server', defaultPrice: 10 },
    ],
  },
  {
    id: 'review_rating',
    name: 'Review & Rating',
    subCategories: [
      { name: 'Facebook Page Recommendation', defaultPrice: 8 },
      { name: 'Play Store App Review', defaultPrice: 10 },
      { name: 'Google Maps Review (5 Star)', defaultPrice: 12 },
      { name: 'Trustpilot / Website Review', defaultPrice: 15 },
    ],
  },
  {
    id: 'other_custom',
    name: 'Other / Custom',
    subCategories: [
      { name: 'Image / Content Share', defaultPrice: 4 },
      { name: 'Custom Micro Task', defaultPrice: 5 },
      { name: 'Survey / Poll Participation', defaultPrice: 8 },
      { name: 'Data Entry / Form Fill', defaultPrice: 10 },
    ],
  },
];

function isSafeImageSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/')
  );
}

export function PostJob() {
  const { profile, user, systemConfig } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [countrySearch, setCountrySearch] = useState('');
  const [targetCountry, setTargetCountry] = useState('ALL');

  // Step 2 state
  const [mainCategory, setMainCategory] = useState<string>(JOB_CATEGORIES[0].name);
  const [subCategory, setSubCategory] = useState<string>(JOB_CATEGORIES[0].subCategories[0].name);
  const [maxWorkers, setMaxWorkers] = useState<number>(20);
  const [pricePerWork, setPricePerWork] = useState<number>(JOB_CATEGORIES[0].subCategories[0].defaultPrice);
  const [durationDays, setDurationDays] = useState<number>(7);

  // Step 3 state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailMode, setThumbnailMode] = useState<'url' | 'upload'>('url');
  const [thumbnail, setThumbnail] = useState('');
  const [proofFields, setProofFields] = useState<ProofField[]>([
    { id: 'proof-1', type: 'text', instruction: 'Your username / channel name used for the task' },
    { id: 'proof-2', type: 'screenshot', instruction: 'Screenshot confirming completion' },
  ]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [pinCode, setPinCode] = useState('');

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return TARGET_COUNTRIES;
    return TARGET_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const currentMainCategoryObj = useMemo(
    () => JOB_CATEGORIES.find((c) => c.name === mainCategory) || JOB_CATEGORIES[0],
    [mainCategory]
  );

  const currentSubCategoryObj = useMemo(
    () =>
      currentMainCategoryObj.subCategories.find((s) => s.name === subCategory) ||
      currentMainCategoryObj.subCategories[0],
    [currentMainCategoryObj, subCategory]
  );

  const jobFeePercent = Number(systemConfig?.jobPostingFee ?? 10);
  const safePrice = Number(pricePerWork) > 0 ? Number(pricePerWork) : 0;
  const safeWorkers = Number(maxWorkers) > 0 ? Math.floor(Number(maxWorkers)) : 0;
  const totalCost = safePrice * safeWorkers;
  const serviceCharge = totalCost * (jobFeePercent / 100);
  const grandTotal = totalCost + serviceCharge;

  const handleSelectMainCategory = (cat: MainCategoryOption) => {
    setMainCategory(cat.name);
    const firstSub = cat.subCategories[0];
    setSubCategory(firstSub.name);
    setPricePerWork(firstSub.defaultPrice);
    setError(null);
  };

  const handleSelectSubCategory = (sub: SubCategoryOption) => {
    setSubCategory(sub.name);
    setPricePerWork(sub.defaultPrice);
    setError(null);
  };

  const handleAddProofField = () => {
    const screenshotCountNow = proofFields.filter((f) => f.type === 'screenshot').length;
    const defaultType: 'text' | 'screenshot' = screenshotCountNow < 3 ? 'screenshot' : 'text';
    setProofFields((prev) => [
      ...prev,
      {
        id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: defaultType,
        instruction: '',
      },
    ]);
  };

  const handleUpdateProofField = (id: string, patch: Partial<ProofField>) => {
    setProofFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleRemoveProofField = (id: string) => {
    setProofFields((prev) => prev.filter((f) => f.id !== id));
  };

  const goToStep = (nextStep: 1 | 2 | 3) => {
    setError(null);
    if (nextStep === 3) {
      if (!safeWorkers || safeWorkers < 1) {
        setError('Please enter at least 1 worker needed.');
        return;
      }
      if (!safePrice || safePrice < 1) {
        setError('Each worker earning must be at least ৳1.');
        return;
      }
    }
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) return;

    if (!title.trim()) {
      setError('Please enter a Job Title.');
      return;
    }
    if (!description.trim()) {
      setError('Please enter Step-by-Step Instructions.');
      return;
    }
    if (!safeWorkers || safeWorkers < 1) {
      setError('Workers needed must be at least 1.');
      return;
    }
    if (!safePrice || safePrice < 1) {
      setError('Each worker earning must be at least ৳1.');
      return;
    }
    if (thumbnail.trim() && !isSafeImageSrc(thumbnail)) {
      setError('Please enter a valid thumbnail URL (https://...) or upload an image file.');
      return;
    }
    if (autoApprove && !pinCode.trim()) {
      setError('Please enter a P-Code when Auto-Approve is enabled.');
      return;
    }
    if ((Number(profile.depositBalance) || 0) < grandTotal) {
      setError(
        `Insufficient deposit balance. You need ${formatCurrency(grandTotal)} but have ${formatCurrency(
          Number(profile.depositBalance) || 0
        )}.`
      );
      return;
    }

    const textProofs = proofFields.filter((f) => f.type === 'text');
    const screenshotProofs = proofFields.filter((f) => f.type === 'screenshot');
    const requireTextProof = textProofs.length > 0;
    const textProofInstruction = textProofs
      .map((t) => t.instruction.trim())
      .filter(Boolean)
      .join(' | ');
    const screenshotCount = Math.min(screenshotProofs.length, 5);
    const screenshotProofInstructions = screenshotProofs
      .slice(0, 5)
      .map((s, idx) => s.instruction.trim() || `Screenshot proof #${idx + 1}`);

    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    setLoading(true);
    setError(null);

    try {
      const { data: userDoc, error: userErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userErr || !userDoc) throw new Error('User not found');

      const currentDepositBalance = Number(userDoc.depositBalance || 0);
      if (currentDepositBalance < grandTotal) {
        throw new Error('Insufficient deposit balance at time of transaction');
      }

      const { error: jobErr } = await supabase.from('jobs').insert([
        {
          posterId: user.id,
          posterName: profile.displayName || user.user_metadata?.name || 'User',
          posterSerial: profile.serialNumber,
          title: title.trim(),
          thumbnail: thumbnail.trim(),
          description: description.trim(),
          screenshotCount,
          requireTextProof,
          textProofInstruction,
          screenshotProofInstruction: screenshotProofInstructions[0] || '',
          screenshotProofInstructions,
          autoApprove,
          pinCode: autoApprove ? pinCode.trim() : '',
          pricePerWork: safePrice,
          maxWorkers: safeWorkers,
          mainCategory,
          subCategory,
          category: `${mainCategory} - ${subCategory}`,
          targetCountry,
          durationDays,
          expiresAt,
          completedCount: 0,
          pendingCount: 0,
          approvedCount: 0,
          isFull: false,
          status: 'open',
          totalBudget: totalCost,
          serviceCharge,
          grandTotal,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (jobErr) throw jobErr;

      navigate('/manage-jobs');
    } catch (err: any) {
      setError(err.message || err.toString());
      setLoading(false);
    }
  };

  if (systemConfig === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-slate-700 border-t-[#0B3D9E] dark:border-t-[#F97316] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <PlusCircle className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">Preparing Job Gateway</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest animate-pulse">
            Checking service fees & rules...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 pb-14">
      {/* Header + Deposit Balance */}
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-3xl sm:rounded-[2rem] p-5 sm:p-7 text-white shadow-xl shadow-blue-950/15 border border-blue-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="bg-white/10 border border-white/15 p-3 rounded-2xl text-[#FB923C] shrink-0">
            <PlusCircle className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-black font-display text-white tracking-tight">
              Post a New Job
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/85 font-medium">
              3 simple steps to launch your microjob campaign.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-2xl bg-white/10 border border-white/15 text-xs sm:text-sm font-bold text-blue-100 self-start sm:self-auto shrink-0">
          <Wallet className="w-4 h-4 text-[#FB923C]" />
          <span>Deposit:</span>
          <span className="font-black text-[#FB923C] tabular-nums">
            {formatCurrency(Number(profile?.depositBalance) || 0)}
          </span>
        </div>
      </div>

      {/* 3-Step Indicator */}
      <div className="bg-white dark:bg-[#0A1638] p-1.5 sm:p-2 rounded-2xl border border-[#D7E3F7] dark:border-[#1C3882]/60 shadow-sm grid grid-cols-3 gap-1.5 sm:gap-2 transition-colors">
        {[
          { num: 1 as const, label: '1. Target Location' },
          { num: 2 as const, label: '2. Category & Budget' },
          { num: 3 as const, label: '3. Job & Proofs' },
        ].map((item) => {
          const isActive = step === item.num;
          const isCompleted = step > item.num;
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => {
                if (item.num <= step || item.num === 2) {
                  goToStep(item.num);
                } else {
                  goToStep(3);
                }
              }}
              className={cn(
                'px-2 sm:px-3 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-sm font-black transition-all truncate text-center',
                isActive
                  ? 'bg-[#F97316] text-white shadow-md shadow-orange-500/25'
                  : isCompleted
                    ? 'bg-[#EFF4FC] dark:bg-[#0E2460] text-[#07266E] dark:text-blue-200 border border-[#CFE0FB] dark:border-blue-500/40 hover:bg-[#E1ECFC] dark:hover:bg-[#133285]'
                    : 'bg-[#F4F7FE] dark:bg-[#050F2B] text-slate-500 dark:text-blue-200/70 border border-[#DCE7FA] dark:border-[#1C3882]/50 hover:border-[#0B3D9E]/50 dark:hover:border-blue-500/50'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Main Step Container */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gradient-to-b dark:from-[#0A1638] dark:to-[#050F2B] p-4 sm:p-8 rounded-3xl sm:rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/60 shadow-xl shadow-blue-950/[0.05] dark:shadow-none transition-colors">
          <AnimatePresence mode="wait">
            {/* STEP 1: TARGET AUDIENCE */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white">
                    Select Target Audience
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-blue-200/80 font-medium">
                    Choose which country's workers can view and complete your job.
                  </p>
                </div>

                {/* Search Countries */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 dark:text-blue-300/60 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter countries..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 focus:ring-2 focus:ring-[#F97316] outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-blue-300/50 transition-all"
                  />
                </div>

                {/* Countries Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
                  {filteredCountries.map((country) => {
                    const selected = targetCountry === country.code;
                    return (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => setTargetCountry(country.code)}
                        className={cn(
                          'p-4 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[104px] relative group',
                          selected
                            ? 'bg-[#F97316] border-[#F97316] text-white shadow-lg shadow-orange-500/25'
                            : 'bg-slate-50 dark:bg-[#041235]/70 border-slate-200 dark:border-blue-800/50 text-slate-900 dark:text-white hover:border-[#0B3D9E] dark:hover:border-blue-500/60'
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <span
                            className={cn(
                              'text-xs font-black tracking-wider uppercase',
                              selected ? 'text-white/95' : 'text-slate-700 dark:text-blue-100'
                            )}
                          >
                            {country.code}
                          </span>
                          {selected ? (
                            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                          ) : (
                            <Globe className="w-4 h-4 text-slate-400 dark:text-blue-300/60 shrink-0" />
                          )}
                        </div>
                        <div>
                          <p
                            className={cn(
                              'text-sm font-black leading-snug',
                              selected ? 'text-white' : 'text-slate-900 dark:text-white'
                            )}
                          >
                            {country.name}
                          </p>
                          <p
                            className={cn(
                              'text-[11px] font-medium mt-0.5',
                              selected ? 'text-orange-100' : 'text-slate-500 dark:text-blue-300/60'
                            )}
                          >
                            {country.region}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {filteredCountries.length === 0 && (
                  <p className="text-center text-sm text-slate-400 dark:text-blue-300/60 py-6">
                    No matching countries found.
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="px-6 py-3.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all"
                  >
                    <span>Next: Category &amp; Pricing</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: CATEGORY & BUDGET */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* 1. Main Category */}
                <div className="space-y-3">
                  <h2 className="text-lg sm:text-xl font-black font-display text-slate-900 dark:text-white">
                    1. Main Category
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                    {JOB_CATEGORIES.map((cat) => {
                      const active = mainCategory === cat.name;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectMainCategory(cat)}
                          className={cn(
                            'px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl border text-xs sm:text-sm font-black transition-all text-center',
                            active
                              ? 'bg-[#F97316] border-[#F97316] text-white shadow-lg shadow-orange-500/25'
                              : 'bg-slate-50 dark:bg-[#041235]/70 border-slate-200 dark:border-blue-800/50 text-slate-800 dark:text-blue-100 hover:border-[#0B3D9E] dark:hover:border-blue-500/60'
                          )}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Sub-Category */}
                <div className="space-y-3">
                  <h2 className="text-lg sm:text-xl font-black font-display text-slate-900 dark:text-white">
                    2. Sub-Category
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentMainCategoryObj.subCategories.map((sub) => {
                      const active = subCategory === sub.name;
                      return (
                        <button
                          key={sub.name}
                          type="button"
                          onClick={() => handleSelectSubCategory(sub)}
                          className={cn(
                            'w-full px-4 py-3.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-all',
                            active
                              ? 'bg-orange-50 dark:bg-[#F97316]/15 border-[#F97316] text-slate-900 dark:text-[#FB923C] shadow-sm'
                              : 'bg-slate-50 dark:bg-[#041235]/70 border-slate-200 dark:border-blue-800/50 text-slate-800 dark:text-white hover:border-[#0B3D9E] dark:hover:border-blue-500/60'
                          )}
                        >
                          <span className="text-sm font-bold">{sub.name}</span>
                          <span
                            className={cn(
                              'text-xs font-black tabular-nums shrink-0',
                              active ? 'text-[#F97316] dark:text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            ৳{sub.defaultPrice}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Workers & Pricing */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-blue-800/50">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-blue-100 block">
                      Workers Needed
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={maxWorkers === 0 ? '' : maxWorkers}
                      onChange={(e) => setMaxWorkers(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                      className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 focus:ring-2 focus:ring-[#F97316] outline-none text-slate-900 dark:text-white font-bold tabular-nums"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-blue-100">
                        Each Worker Earns (BDT ৳)
                      </label>
                      {Number(pricePerWork) !== currentSubCategoryObj.defaultPrice && (
                        <button
                          type="button"
                          onClick={() => setPricePerWork(currentSubCategoryObj.defaultPrice)}
                          className="text-xs font-bold text-[#F97316] dark:text-[#FB923C] hover:underline"
                        >
                          Reset to ৳{currentSubCategoryObj.defaultPrice}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      step="0.5"
                      value={pricePerWork === 0 ? '' : pricePerWork}
                      onChange={(e) =>
                        setPricePerWork(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))
                      }
                      className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 focus:ring-2 focus:ring-[#F97316] outline-none text-slate-900 dark:text-white font-bold tabular-nums"
                    />
                    <p className="text-xs text-slate-500 dark:text-blue-300/70 font-medium">
                      Category Default: ৳{currentSubCategoryObj.defaultPrice} (You can customize this amount)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-blue-100 block">
                      Duration (Days)
                    </label>
                    <select
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 focus:ring-2 focus:ring-[#F97316] outline-none text-slate-900 dark:text-white font-bold"
                    >
                      <option value={3}>3 Days</option>
                      <option value={7}>7 Days</option>
                      <option value={14}>14 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </div>
                </div>

                {/* Estimated Campaign Cost Box */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#041235]/90 border border-slate-200 dark:border-blue-800/60 space-y-1">
                  <p className="text-xs font-bold text-slate-500 dark:text-blue-200/80">
                    Estimated Total Campaign Cost (includes {jobFeePercent}% platform fee)
                  </p>
                  <p className="text-2xl sm:text-3xl font-black font-display text-[#F97316] dark:text-[#FB923C] tabular-nums">
                    {formatCurrency(grandTotal)}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-blue-300/70 tabular-nums">
                    Workers: {formatCurrency(totalCost)} + Admin Fee: {formatCurrency(serviceCharge)}
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/15 border border-red-400/50 text-red-700 dark:text-red-200 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-xs font-bold">{error}</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="px-5 py-3.5 rounded-xl bg-slate-100 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 text-slate-700 dark:text-white font-bold text-sm flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-blue-900/50 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="px-6 py-3.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all"
                  >
                    <span>Next: Job Information</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: JOB INFORMATION & PROOFS */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Job Title */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-blue-100 block">
                    Job Title
                  </label>
                  <input
                    required
                    type="text"
                    placeholder={`e.g. ${mainCategory} - ${subCategory}`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 focus:ring-2 focus:ring-[#F97316] outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-blue-300/40"
                  />
                </div>

                {/* Step-by-Step Instructions */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-blue-100 block">
                    Step-by-Step Instructions
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder={'1. Open the link...\n2. Complete the required action...\n3. Submit the requested proof...'}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 focus:ring-2 focus:ring-[#F97316] outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-blue-300/40 resize-y"
                  />
                </div>

                {/* Job Thumbnail (URL or Image Upload) */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-blue-100">
                      Job Thumbnail (Optional)
                    </label>
                    <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-[#041235] border border-slate-200 dark:border-blue-800/60 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setThumbnailMode('url')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all',
                          thumbnailMode === 'url'
                            ? 'bg-[#0B3D9E] dark:bg-[#F97316] text-white'
                            : 'text-slate-600 dark:text-blue-200'
                        )}
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Image URL</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setThumbnailMode('upload')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all',
                          thumbnailMode === 'upload'
                            ? 'bg-[#0B3D9E] dark:bg-[#F97316] text-white'
                            : 'text-slate-600 dark:text-blue-200'
                        )}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                    </div>
                  </div>

                  {thumbnailMode === 'url' ? (
                    <input
                      type="url"
                      placeholder="https://example.com/banner.jpg"
                      value={thumbnail.startsWith('data:') ? '' : thumbnail}
                      onChange={(e) => setThumbnail(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 focus:ring-2 focus:ring-[#F97316] outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-blue-300/40"
                    />
                  ) : (
                    <div className="px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            try {
                              const { compressImage } = await import('../lib/imageCompress');
                              const compressed = await compressImage(e.target.files[0], 1080, 0.08);
                              setThumbnail(compressed);
                            } catch (err: any) {
                              setError(err.message || 'Failed to process thumbnail image');
                            }
                          }
                        }}
                        className="w-full text-xs text-slate-500 dark:text-blue-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-100 dark:file:bg-[#F97316]/20 file:text-[#0B3D9E] dark:file:text-[#FB923C] cursor-pointer"
                      />
                    </div>
                  )}

                  {thumbnail && isSafeImageSrc(thumbnail) && (
                    <div className="relative inline-block">
                      <img
                        src={thumbnail}
                        alt="Thumbnail preview"
                        className="h-32 max-w-full rounded-xl object-contain bg-slate-100 dark:bg-[#041235] border border-slate-200 dark:border-blue-800/60 p-1"
                      />
                      <button
                        type="button"
                        onClick={() => setThumbnail('')}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600"
                        title="Remove thumbnail"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Required Worker Proofs */}
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-blue-800/50">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Required Worker Proofs
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-blue-300/70">
                        Ask workers for text confirmation or screenshot proofs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddProofField}
                      className="px-3.5 py-2 rounded-xl border border-[#F97316]/50 bg-orange-50 dark:bg-[#F97316]/15 text-[#EA580C] dark:text-[#FB923C] text-xs font-black flex items-center gap-1.5 hover:bg-orange-100 dark:hover:bg-[#F97316]/25 transition-all shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Proof Field</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {proofFields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#041235]/70 border border-slate-200 dark:border-blue-800/60 space-y-2.5"
                      >
                        <input
                          type="text"
                          placeholder={
                            field.type === 'text'
                              ? `Proof #${idx + 1}: e.g. Your username / channel name`
                              : `Proof #${idx + 1}: e.g. Screenshot confirming completion`
                          }
                          value={field.instruction}
                          onChange={(e) => handleUpdateProofField(field.id, { instruction: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#071B4B] border border-slate-200 dark:border-blue-800/60 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#F97316]"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <select
                            value={field.type}
                            onChange={(e) =>
                              handleUpdateProofField(field.id, {
                                type: e.target.value as 'text' | 'screenshot',
                              })
                            }
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#071B4B] border border-slate-200 dark:border-blue-800/60 text-xs sm:text-sm font-bold text-slate-800 dark:text-white outline-none"
                          >
                            <option value="text">Text Proof</option>
                            <option value="screenshot">Screenshot</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveProofField(field.id)}
                            disabled={proofFields.length <= 1}
                            className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Remove proof field"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto Approve with P-Code */}
                <div
                  className={cn(
                    'p-4 sm:p-5 rounded-2xl border transition-all',
                    autoApprove
                      ? 'border-[#F97316]/50 bg-orange-50 dark:bg-[#F97316]/10'
                      : 'border-slate-200 dark:border-blue-800/50 bg-slate-50 dark:bg-[#041235]/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-xl',
                          autoApprove
                            ? 'bg-[#F97316] text-white'
                            : 'bg-slate-200 dark:bg-blue-900/60 text-slate-500 dark:text-blue-300'
                        )}
                      >
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          Auto-Approve with P-Code
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-blue-300/70">
                          Fast-track verification using a secret PIN.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={autoApprove}
                        onChange={(e) => setAutoApprove(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-blue-900 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]" />
                    </label>
                  </div>

                  {autoApprove && (
                    <div className="mt-4 pt-3 border-t border-orange-200 dark:border-orange-900/40 space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-[#EA580C] dark:text-[#FB923C]">
                        Set P-Code (Share inside job instructions)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. YT-DONE-100"
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#071B4B] border border-orange-300 dark:border-orange-800/50 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#F97316]"
                      />
                    </div>
                  )}
                </div>

                {/* Final Cost Summary Bar */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#041235]/90 border border-slate-200 dark:border-blue-800/60 space-y-1">
                  <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">
                    {mainCategory} <span className="text-slate-400">·</span>{' '}
                    <span className="font-semibold text-slate-600 dark:text-blue-200">{subCategory}</span>{' '}
                    <span className="text-slate-400">·</span>{' '}
                    <span className="font-semibold text-slate-600 dark:text-blue-200">
                      Target: {targetCountry}
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-blue-300/80 tabular-nums">
                    {safeWorkers} workers × {formatCurrency(safePrice)} + {jobFeePercent}% fee ={' '}
                    <span className="font-black text-[#F97316] dark:text-[#FB923C]">
                      {formatCurrency(grandTotal)}
                    </span>
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/15 border border-red-400/50 text-red-700 dark:text-red-200 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-xs font-bold">{error}</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="px-5 py-3.5 rounded-xl bg-slate-100 dark:bg-[#041235]/80 border border-slate-200 dark:border-blue-800/60 text-slate-700 dark:text-white font-bold text-sm flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-blue-900/50 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-black text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Publish Job ({formatCurrency(grandTotal)})</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </div>
  );
}
