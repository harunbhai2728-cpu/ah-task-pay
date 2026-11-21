import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Search,
  Filter,
  Copy,
  ArrowUpRight,
  ArrowDownLeft,
  Briefcase,
  Ban,
  Unlock,
  Lock,
  MessageSquare,
  DollarSign,
  Plus,
  Minus,
  AlertTriangle,
  Wallet,
  Settings,
  Send,
  Trash2,
  Bell,
  Image,
  Upload,
  Gift,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Transaction, UserProfile, Job, Submission, Ticket } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { compressImage } from '../lib/imageCompress';
import { BrandLogo } from '../components/BrandLogo';
import toast from 'react-hot-toast';

const createAdminDb = (supabaseClient: any) => {
  return {
    from: (table: string) => {
      let chain: any = { method: '', table, args: [], single: false, eq: null, neq: null, gt: null, gte: null, lt: null, lte: null, match: null };
      const execute = async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('No admin auth token');
        const res = await fetch('/api/proxy', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
           body: JSON.stringify(chain)
        });
        const json = await res.json();
        if (!res.ok || (json && json.error)) {
            return { data: null, error: new Error((json && json.error) ? json.error : 'Request failed') };
        }
        return { data: json.data, error: null };
      };
      const builder = {
        select: (...args: any[]) => { chain.method = 'select'; chain.args = args; return builder; },
        update: (...args: any[]) => { chain.method = 'update'; chain.args = args; return builder; },
        insert: (...args: any[]) => { chain.method = 'insert'; chain.args = args; return builder; },
        delete: () => { chain.method = 'delete'; return builder; },
        upsert: (...args: any[]) => { chain.method = 'upsert'; chain.args = args; return builder; },
        eq: (...args: any[]) => { chain.eq = args; return builder; },
        neq: (...args: any[]) => { chain.neq = args; return builder; },
        gt: (...args: any[]) => { chain.gt = args; return builder; },
        gte: (...args: any[]) => { chain.gte = args; return builder; },
        lt: (...args: any[]) => { chain.lt = args; return builder; },
        lte: (...args: any[]) => { chain.lte = args; return builder; },
        match: (...args: any[]) => { chain.match = args[0]; return builder; },
        single: () => { chain.single = true; return builder; },
        then: (resolve: any, reject: any) => execute().then(resolve, reject),
      };
      return builder as any;
    }
  };
};


export function AdminPanel() {
  const adminDb = createAdminDb(supabase);
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'transactions' | 'users' | 'jobs' | 'submissions' | 'settings' | 'tickets' | 'ads' | 'redeem_codes' | 'deletions'>('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [jobsSearchTerm, setJobsSearchTerm] = useState('');
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('All');
  const [subSearchTerm, setSubSearchTerm] = useState('');
  const [ticketSearchTerm, setTicketSearchTerm] = useState('');
  const [adsSearchTerm, setAdsSearchTerm] = useState('');
  const [userSortOrder, setUserSortOrder] = useState<'newest' | 'balance_high' | 'balance_low'>('newest');
  const [showDuplicateIPs, setShowDuplicateIPs] = useState(false);

  // Server-side pagination and error states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [restrictedSearchTerm, setRestrictedSearchTerm] = useState('');
  const [restrictedFilter, setRestrictedFilter] = useState<'all' | 'blocked' | 'deleted'>('all');
  const [tabLoading, setTabLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Global system statistics computed on backend
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [completedJobsCount, setCompletedJobsCount] = useState(0);
  const [totalEarningBalance, setTotalEarningBalance] = useState(0);
  const [totalDepositBalance, setTotalDepositBalance] = useState(0);
  const [totalHeld, setTotalHeld] = useState(0);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [totalWithdraw, setTotalWithdraw] = useState(0);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [pendingSubsCount, setPendingSubsCount] = useState(0);
  const [hasPendingTickets, setHasPendingTickets] = useState(false);
  const [hasPendingJobs, setHasPendingJobs] = useState(false);
  const [hasPendingAds, setHasPendingAds] = useState(false);
  const [hasPendingDeletions, setHasPendingDeletions] = useState(false);

  const [duplicateIPCounts, setDuplicateIPCounts] = useState<{ [key: string]: number }>({});
  const [activeIPCounts, setActiveIPCounts] = useState<{ [key: string]: number }>({});

  // Redeem Codes management states
  const [redeemCodes, setRedeemCodes] = useState<any[]>([]);
  const [newRedeemCode, setNewRedeemCode] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemMaxUses, setRedeemMaxUses] = useState('');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState('');
  const [redeemErrorMsg, setRedeemErrorMsg] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  // UI States for actions
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(null);
  const [rejectingSub, setRejectingSub] = useState<Submission | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [balanceAdjust, setBalanceAdjust] = useState<{[key: string]: string}>({});
  const [depositBalanceAdjust, setDepositBalanceAdjust] = useState<{[key: string]: string}>({});
  const [warningText, setWarningText] = useState<{[key: string]: string}>({});
  const [notificationText, setNotificationText] = useState<{[key: string]: string}>({});
  const [ticketReplies, setTicketReplies] = useState<{[key: string]: string}>({});
  const [blockConfirmUser, setBlockConfirmUser] = useState<UserProfile | null>(null);
  const [blockPassword, setBlockPassword] = useState('');
  
  const [adminChangeUserPass, setAdminChangeUserPass] = useState<{[key: string]: string}>({});
  const [adminChangeUserPhone, setAdminChangeUserPhone] = useState<{[key: string]: string}>({});
  const [adminChangeUserEmail, setAdminChangeUserEmail] = useState<{[key: string]: string}>({});

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [supabaseServiceRoleReady, setSupabaseServiceRoleReady] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editSubmitLoading, setEditSubmitLoading] = useState(false);
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  
  const [deleteAdConfirm, setDeleteAdConfirm] = useState<any | null>(null);
  const [deleteJobConfirm, setDeleteJobConfirm] = useState<string | null>(null);
  const [deleteUserConfirmUser, setDeleteUserConfirmUser] = useState<UserProfile | null>(null);
  const [deleteUserPassword, setDeleteUserPassword] = useState('');

  const handleForceDeleteUser = async () => {
    if (!deleteUserConfirmUser) return;
    if (deleteUserPassword !== 'ah2781') {
      alert("ভুল পাসওয়ার্ড! (Incorrect Password)");
      return;
    }
    setAdminActionLoading(true);
    try {
      await adminDb.from('profiles').update({ account_status: 'deleted', deletion_reason: 'Account removed by Administrator.' }).eq('id', deleteUserConfirmUser.uid || deleteUserConfirmUser.id);
      setDeleteUserConfirmUser(null);
      setDeleteUserPassword('');
      setEditingUser(null);
      alert("একাউন্ট ডিলিট করা হয়েছে। (Account deleted successfully)");
      await fetchAdminData();
    } catch (error) {
      console.error(error);
      alert("Failed to delete account");
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleApproveDeletion = async (userId: string) => {
    if (!userId) return;
    setAdminActionLoading(true);
    try {
      const res = await adminDb.from('profiles').update({ account_status: 'deleted' }).eq('id', userId);
      if (res && res.error) {
        alert("Failed to approve deletion: " + res.error.message);
      } else {
        alert("Account deletion approved.");
      }
      await fetchAdminData();
    } catch (e: any) { 
      console.error(e); 
      alert("Error: " + (e?.message || e));
    } finally { 
      setAdminActionLoading(false); 
    }
  };

  const handleRejectDeletion = async (userId: string) => {
    if (!userId) return;
    setAdminActionLoading(true);
    try {
      const res = await adminDb.from('profiles').update({ account_status: 'active', deletion_reason: null, isBlocked: false }).eq('id', userId);
      if (res && res.error) {
        alert("Failed to reject deletion: " + res.error.message);
      } else {
        alert("Deletion request rejected. Account restored to active.");
      }
      await fetchAdminData();
    } catch (e: any) { 
      console.error(e); 
      alert("Error: " + (e?.message || e));
    } finally { 
      setAdminActionLoading(false); 
    }
  };

  const handleRecoverAccount = async (userId: string) => {
    if (!userId) return;
    setAdminActionLoading(true);
    try {
      const res = await adminDb.from('profiles').update({ account_status: 'active', deletion_reason: null, isBlocked: false }).eq('id', userId);
      if (res && res.error) {
        alert("Failed to recover account: " + res.error.message);
      } else {
        alert("একাউন্ট সফলভাবে রিকোভার করা হয়েছে। (Account recovered successfully!)");
      }
      await fetchAdminData();
    } catch (e: any) { 
      console.error(e); 
      alert("Error: " + (e?.message || e));
    } finally { 
      setAdminActionLoading(false); 
    }
  };

  // Deposit Rules states
  const [depositRules, setDepositRules] = useState('');
  const [depositRulesLoading, setDepositRulesLoading] = useState(false);
  const [depositRulesSuccessMsg, setDepositRulesSuccessMsg] = useState('');
  const [depositRulesErrorMsg, setDepositRulesErrorMsg] = useState('');

  const fetchDepositRulesData = async () => {
    try {
      const res = await fetch(`/api/settings/deposit-rules?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setDepositRules(json.setting_value || '');
      }
    } catch (e) {
      console.error("Failed to fetch deposit rules:", e);
    }
  };

  const handleUpdateDepositRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositRulesLoading(true);
    setDepositRulesSuccessMsg('');
    setDepositRulesErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Unauthorized');
      
      const res = await fetch('/api/settings/deposit-rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rules: depositRules })
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update deposit rules.');
      }
      
      setDepositRulesSuccessMsg('Deposit rules updated successfully!');
    } catch (err: any) {
      setDepositRulesErrorMsg(err.message || 'Failed to update deposit rules.');
    } finally {
      setDepositRulesLoading(false);
    }
  };

  // Withdraw Rules states
  const [withdrawRules, setWithdrawRules] = useState('');
  const [withdrawRulesLoading, setWithdrawRulesLoading] = useState(false);
  const [withdrawRulesSuccessMsg, setWithdrawRulesSuccessMsg] = useState('');
  const [withdrawRulesErrorMsg, setWithdrawRulesErrorMsg] = useState('');

  const fetchWithdrawRulesData = async () => {
    try {
      const res = await fetch(`/api/settings/withdraw-rules?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setWithdrawRules(json.setting_value || '');
      }
    } catch (e) {
      console.error("Failed to fetch withdraw rules:", e);
    }
  };

  const handleUpdateWithdrawRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawRulesLoading(true);
    setWithdrawRulesSuccessMsg('');
    setWithdrawRulesErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Unauthorized');
      
      const res = await fetch('/api/settings/withdraw-rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rules: withdrawRules })
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update withdraw rules.');
      }
      
      setWithdrawRulesSuccessMsg('Withdraw rules updated successfully!');
    } catch (err: any) {
      setWithdrawRulesErrorMsg(err.message || 'Failed to update withdraw rules.');
    } finally {
      setWithdrawRulesLoading(false);
    }
  };

  // Ad Post Rules states
  const [adPostRules, setAdPostRules] = useState('');
  const [adPostRulesLoading, setAdPostRulesLoading] = useState(false);
  const [adPostRulesSuccessMsg, setAdPostRulesSuccessMsg] = useState('');
  const [adPostRulesErrorMsg, setAdPostRulesErrorMsg] = useState('');

  const fetchAdPostRulesData = async () => {
    try {
      const res = await fetch(`/api/settings/ad-post-rules?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setAdPostRules(json.setting_value || '');
      }
    } catch (e) {
      console.error("Failed to fetch ad post rules:", e);
    }
  };

  const handleUpdateAdPostRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdPostRulesLoading(true);
    setAdPostRulesSuccessMsg('');
    setAdPostRulesErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Unauthorized');
      
      const res = await fetch('/api/settings/ad-post-rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rules: adPostRules })
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update ad post rules.');
      }
      
      setAdPostRulesSuccessMsg('Ad post rules updated successfully!');
    } catch (err: any) {
      setAdPostRulesErrorMsg(err.message || 'Failed to update ad post rules.');
    } finally {
      setAdPostRulesLoading(false);
    }
  };

  const [savingConfig, setSavingConfig] = useState(false);
  const [config, setConfig] = useState<any>({
    notice: '',
    minDeposit: 100,
    minWithdraw: 20,
    withdrawalFee: 10,
    jobPostingFee: 10,
    bkashMethod: 'Personal',
    nagadMethod: 'Personal',
    transferEarningToDepositFee: 0,
    transferDepositToEarningFee: 10,
    loginTitle: 'Welcome to TaskPay',
    loginBannerUrl: '',
    customBannerPresets: [] as string[],
    statsMode: 'realtime',
    manualTotalUsers: 0,
    manualTotalJobs: 0,
    manualCompletedTasks: 0,
    manualTotalWithdraw: 0
  });

  const getUserSerial = (uid: string) => {
    const u = users.find(user => user.uid === uid);
    return u?.serialNumber || uid.slice(0, 6).toUpperCase();
  };

  const getUserName = (uid: string) => {
    const u = users.find(user => user.uid === uid);
    return u?.displayName || 'Unknown User';
  };

  const { isAdmin: isSystemAdmin, refreshConfig } = useAuth();

  const fetchAdminData = async (silent = false, background = false, overrideTab?: string, overridePage?: number) => {
    if (!isSystemAdmin) return;
    
    const currentTab = overrideTab || activeTab;
    const targetPage = overridePage !== undefined ? overridePage : currentPage;
    
    let searchVal = '';
    if (currentTab === 'users') searchVal = searchTerm;
    else if (currentTab === 'transactions') searchVal = txSearchTerm;
    else if (currentTab === 'jobs') searchVal = jobsSearchTerm;
    else if (currentTab === 'submissions') searchVal = subSearchTerm;
    else if (currentTab === 'tickets') searchVal = ticketSearchTerm;
    else if (currentTab === 'ads') searchVal = adsSearchTerm;
    else if (currentTab === 'deletions') searchVal = restrictedSearchTerm;

    const queryParams = new URLSearchParams({
      tab: currentTab,
      page: String(targetPage),
      limit: '20',
      search: searchVal,
      type: txTypeFilter,
      sort: userSortOrder,
      duplicateIPs: String(showDuplicateIPs),
      t: String(Date.now())
    });

    if (!silent && !background) {
      if (transactions.length === 0 && users.length === 0) {
        setLoading(true);
      } else {
        setTabLoading(true);
      }
    }
    if (silent) setIsRefreshing(true);
    setFetchError(null);

    try {
      const sessionRes = await supabase.auth.getSession();
      const session = sessionRes.data?.session;
      const token = session?.access_token;
      
      if (!token) {
        console.error("No active admin session found.");
        setLoading(false);
        setTabLoading(false);
        return;
      }
      
      let res, codesRes;
      try {
        const results = await Promise.all([
          fetch(`/api/admin/data?${queryParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/redeem-code/list?t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        res = results[0];
        codesRes = results[1];
      } catch (fetchErr: any) {
        throw new Error(`Network Connection Error: ${fetchErr.message}. Please check your connection and retry.`);
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Admin Data Error (${res.status}): ${errorText}`);
      }
      
      const json = await res.json();
      if (json && json.error) {
        throw new Error(json.error);
      }
      
      // Update global configurations
      setConfig(prev => ({ ...prev, ...(json.config || {}) }));
      setSupabaseServiceRoleReady(json.supabaseServiceRoleReady ?? true);
      
      // Update stats and totals
      if (json.stats) {
        setTotalUsers(json.stats.totalUsers);
        setTotalJobs(json.stats.totalJobs);
        setCompletedJobsCount(json.stats.completedJobsCount);
        setTotalEarningBalance(json.stats.totalEarningBalance);
        setTotalDepositBalance(json.stats.totalDepositBalance);
        setTotalHeld(json.stats.totalHeld);
        setTotalDeposit(json.stats.totalDeposit);
        setTotalWithdraw(json.stats.totalWithdraw);
        setPendingTransactionsCount(json.stats.pendingTransactionsCount);
        setPendingSubsCount(json.stats.pendingSubsCount);
        setHasPendingTickets(json.stats.hasPendingTickets);
        setHasPendingJobs(json.stats.hasPendingJobs);
        setHasPendingAds(json.stats.hasPendingAds);
        setHasPendingDeletions(json.stats.hasPendingDeletions);
      }

      if (json.duplicateIPCounts) {
        setDuplicateIPCounts(json.duplicateIPCounts);
      }
      if (json.activeIPCounts) {
        setActiveIPCounts(json.activeIPCounts);
      }

      // Update the active tab's specific paginated list
      const fetchedData = json.data || [];
      if (currentTab === 'transactions') setTransactions(fetchedData);
      else if (currentTab === 'users') setUsers(fetchedData);
      else if (currentTab === 'jobs') setJobs(fetchedData);
      else if (currentTab === 'submissions') setSubmissions(fetchedData);
      else if (currentTab === 'tickets') setTickets(fetchedData);
      else if (currentTab === 'ads') setAds(fetchedData);
      else if (currentTab === 'deletions') setUsers(fetchedData);

      setTotalItems(json.totalItems || 0);
      setCurrentPage(json.page || 1);

      if (codesRes && codesRes.ok) {
        const codesJson = await codesRes.json();
        setRedeemCodes(codesJson.codes || []);
      }
      
      setLoading(false);
      setTabLoading(false);
      setIsRefreshing(false);
    } catch (err: any) {
      console.error("Admin Panel Data Fetching Failed:", err);
      setFetchError(err.message || 'Unknown network error. Please try again.');
      setLoading(false);
      setTabLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isSystemAdmin) {
      fetchDepositRulesData();
      fetchWithdrawRulesData();
      fetchAdPostRulesData();
    }
    // Silent trigger for database image cleanup
    fetch('/api/clear-db-images').catch(() => {});
  }, [isSystemAdmin]);

  // Trigger paginated fetch when activeTab, currentPage, txTypeFilter, userSortOrder, showDuplicateIPs change
  useEffect(() => {
    if (isSystemAdmin) {
      fetchAdminData(false, false, activeTab, currentPage);
    }
  }, [activeTab, currentPage, txTypeFilter, userSortOrder, showDuplicateIPs, isSystemAdmin]);

  // Debounced search trigger to avoid API spam while typing
  useEffect(() => {
    if (!isSystemAdmin) return;
    const delayDebounceFn = setTimeout(() => {
      // Whenever search terms change, we reset to page 1 to start from the beginning of results
      fetchAdminData(false, false, activeTab, 1);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, txSearchTerm, jobsSearchTerm, subSearchTerm, ticketSearchTerm, adsSearchTerm, isSystemAdmin]);

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    const loadingToast = toast.loading('Saving settings...');
    try {
      const { error } = await adminDb.from('system_config').upsert({ id: 'config', ...config });
      if (error) {
        console.error("Supabase Error detail:", error);
        throw error;
      }
      if (refreshConfig) await refreshConfig();
      // Instantly fetch newest administrative configurations to refresh local states in the admin UI
      await fetchAdminData(true, true);
      toast.success('Settings updated successfully!', { id: loadingToast });
    } catch (err: any) {
      console.error("Failed to save/update system config. Exact error details:", err);
      toast.error(err.message || 'Failed to update settings', { id: loadingToast });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleApproveTransaction = async (tx: Transaction) => {
    if (tx.status !== 'pending') return;

    const previousTransactions = [...transactions];
    const previousUsers = [...users];

    // Optimistic Update
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'completed' } : t));
    const loadingToast = toast.loading('Approving transaction...');

    try {
      const userRef = await adminDb.from('profiles').select('*').eq('id', tx.userId).single();
      if (!userRef.data) throw new Error("User not found");

      if (tx.type === 'deposit') {
        await adminDb.from('profiles').update({ 
          depositBalance: (userRef.data.depositBalance || 0) + tx.amount,
          pendingDepositBalance: Math.max(0, (userRef.data.pendingDepositBalance || 0) - tx.amount)
        }).eq('id', tx.userId);
      } else if (tx.type === 'withdrawal') {
        await adminDb.from('profiles').update({
          pendingEarningBalance: Math.max(0, (userRef.data.pendingEarningBalance || 0) - tx.amount)
        }).eq('id', tx.userId);
      }

      await adminDb.from('transactions').update({ 
        status: 'completed'
      }).eq('id', tx.id);
      
      toast.success("Transaction Approved", { id: loadingToast });
      // Update local states directly without full network refetch
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'completed' } : t));
      setUsers(prev => prev.map(u => (u.id === tx.userId || u.uid === tx.userId) ? {
        ...u,
        depositBalance: tx.type === 'deposit' ? (u.depositBalance || 0) + tx.amount : u.depositBalance,
        pendingDepositBalance: tx.type === 'deposit' ? Math.max(0, (u.pendingDepositBalance || 0) - tx.amount) : u.pendingDepositBalance,
        pendingEarningBalance: tx.type === 'withdrawal' ? Math.max(0, (u.pendingEarningBalance || 0) - tx.amount) : u.pendingEarningBalance
      } : u));
    } catch (err: any) {
      console.error("Transaction Approve Error:", err);
      setTransactions(previousTransactions);
      setUsers(previousUsers);
      toast.error(err.message || 'Error approving transaction', { id: loadingToast });
    }
  };

  const handleRejectTransaction = async (tx: Transaction) => {
    if (tx.status !== 'pending') return;

    const previousTransactions = [...transactions];
    const previousUsers = [...users];

    // Optimistic Update
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'rejected' } : t));
    const loadingToast = toast.loading('Rejecting transaction...');

    try {
      const userRef = await adminDb.from('profiles').select('*').eq('id', tx.userId).single();
      if (!userRef.data) throw new Error("User not found");

      if (tx.type === 'withdrawal') {
        await adminDb.from('profiles').update({ 
          earningBalance: (userRef.data.earningBalance || 0) + tx.amount,
          pendingEarningBalance: Math.max(0, (userRef.data.pendingEarningBalance || 0) - tx.amount)
        }).eq('id', tx.userId);
      } else if (tx.type === 'deposit') {
        await adminDb.from('profiles').update({ 
          pendingDepositBalance: Math.max(0, (userRef.data.pendingDepositBalance || 0) - tx.amount)
        }).eq('id', tx.userId);
      }

      await adminDb.from('transactions').update({ 
        status: 'rejected'
      }).eq('id', tx.id);

      toast.success("Transaction Rejected", { id: loadingToast });
      // Update local states directly without full network refetch
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'rejected' } : t));
      setUsers(prev => prev.map(u => (u.id === tx.userId || u.uid === tx.userId) ? {
        ...u,
        earningBalance: tx.type === 'withdrawal' ? (u.earningBalance || 0) + tx.amount : u.earningBalance,
        pendingEarningBalance: tx.type === 'withdrawal' ? Math.max(0, (u.pendingEarningBalance || 0) - tx.amount) : u.pendingEarningBalance,
        pendingDepositBalance: tx.type === 'deposit' ? Math.max(0, (u.pendingDepositBalance || 0) - tx.amount) : u.pendingDepositBalance
      } : u));
    } catch (err: any) {
      setTransactions(previousTransactions);
      setUsers(previousUsers);
      toast.error(err.message || 'Error rejecting transaction', { id: loadingToast });
    }
  };

  const handleApproveSubmission = async (sub: Submission) => {
    if (sub.status !== 'pending' || processingSubmissionId) return;
    setProcessingSubmissionId(sub.id);
    
    const previousSubmissions = [...submissions];
    const previousUsers = [...users];
    const previousJobs = [...jobs];
    const reward = sub.reward || 0;
    
    // Optimistic Update of submission status
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'approved' } : s));

    // Optimistic Update of User balances
    setUsers(prev => prev.map(u => {
      const isWorker = (u.id === sub.workerId || u.uid === sub.workerId);
      const isPoster = (u.id === sub.posterId || u.uid === sub.posterId);
      let updatedUser = { ...u };
      if (isWorker) {
        updatedUser.earningBalance = (u.earningBalance || 0) + reward;
        updatedUser.pendingEarningBalance = Math.max(0, (u.pendingEarningBalance || 0) - reward);
      }
      if (isPoster) {
        updatedUser.heldBalance = Math.max(0, (u.heldBalance || 0) - reward);
      }
      return updatedUser;
    }));

    // Optimistic Update of Jobs table statistics
    setJobs(prev => prev.map(j => {
      if (j.id === sub.jobId) {
        const newApprovedCount = (j.approvedCount || 0) + 1;
        const newPendingCount = Math.max(0, (j.pendingCount || 0) - 1);
        return {
          ...j,
          approvedCount: newApprovedCount,
          pendingCount: newPendingCount,
          completedCount: newApprovedCount + newPendingCount,
          slots_filled: newApprovedCount
        };
      }
      return j;
    }));

    const loadingToast = toast.loading('Approving proof...');

    try {
      // Backend transaction engine safely transitions counts and balances!
      await adminDb.from('submissions').update({ 
        status: 'approved'
      }).eq('id', sub.id);

      toast.success('Submission Approved', { id: loadingToast });
    } catch (err: any) {
      setSubmissions(previousSubmissions);
      setUsers(previousUsers);
      setJobs(previousJobs);
      toast.error(err.message || `Error approving submission ${sub.id}`, { id: loadingToast });
    } finally {
      setProcessingSubmissionId(null);
    }
  };

  const handleRejectSubmission = (sub: Submission) => {
    if (sub.status !== 'pending' || processingSubmissionId) return;
    setRejectingSub(sub);
    setRejectReason('');
  };

  const confirmRejectSubmission = async () => {
    if (!rejectingSub) return;
    const reason = rejectReason;
    if (!reason || reason.trim() === '') {
      toast.error('Rejection reason is required.');
      return;
    }

    const previousSubmissions = [...submissions];
    const previousUsers = [...users];
    const previousJobs = [...jobs];
    const subId = rejectingSub.id;
    const sub = rejectingSub;
    const reward = sub.reward || 0;
    
    setProcessingSubmissionId(subId);
    
    // Close modal immediately for snappy UI
    setRejectingSub(null);
    setRejectReason('');
    
    // Optimistic Update of submission status
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'rejected' } : s));

    // Optimistic Update of Worker balance (reducing pending balance)
    setUsers(prev => prev.map(u => {
      const isWorker = (u.id === sub.workerId || u.uid === sub.workerId);
      if (isWorker) {
        return {
          ...u,
          pendingEarningBalance: Math.max(0, (u.pendingEarningBalance || 0) - reward)
        };
      }
      return u;
    }));

    // Optimistic Update of Job statistics (decreasing pending counts)
    setJobs(prev => prev.map(j => {
      if (j.id === sub.jobId) {
        const newPendingCount = Math.max(0, (j.pendingCount || 0) - 1);
        const currentApproved = j.approvedCount || 0;
        return {
          ...j,
          pendingCount: newPendingCount,
          completedCount: currentApproved + newPendingCount,
        };
      }
      return j;
    }));
    
    const loadingToast = toast.loading('Rejecting proof...');

    try {
      // Backend transaction engine safely releases slots and deducts worker's pending rewards!
      const res = await adminDb.from('submissions').update({
        status: 'rejected',
        reject_reason: reason 
      }).eq('id', subId);

      if (res.error) {
        console.error("Supabase Error:", res.error);
        throw res.error;
      }

      toast.success('Submission Rejected', { id: loadingToast });
    } catch (err: any) {
      console.error(err);
      setSubmissions(previousSubmissions);
      setUsers(previousUsers);
      setJobs(previousJobs);
      toast.error(err.message || `Error rejecting submission ${subId}`, { id: loadingToast });
    } finally {
      setProcessingSubmissionId(null);
    }
  };

  const handleApproveAd = async (ad: any) => {
    const previousAds = [...ads];
    
    // Optimistic Update
    setAds(prev => prev.map(a => a.id === ad.id ? { ...a, status: 'approved' } : a));
    const loadingToast = toast.loading('Approving ad...');

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ad.durationDays);
      await adminDb.from('advertisements').update({
        status: 'approved',
        approvedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }).eq('id', ad.id);
      
      toast.success('Advertisement approved', { id: loadingToast });
      fetchAdminData(true, true);
    } catch (err: any) {
      setAds(previousAds);
      toast.error(err.message || 'Error approving ad', { id: loadingToast });
    }
  };

  const handleRejectAd = async (ad: any) => {
    const previousAds = [...ads];
    const previousUsers = [...users];
    
    // Optimistic Update
    setAds(prev => prev.map(a => a.id === ad.id ? { ...a, status: 'rejected' } : a));
    const loadingToast = toast.loading('Rejecting ad...');

    try {
      await adminDb.from('advertisements').update({
        status: 'rejected',
        rejectedAt: new Date().toISOString()
      }).eq('id', ad.id);

      const userSnap = await adminDb.from('profiles').select('*').eq('id', ad.userId).single();
      if (userSnap.data) {
        await adminDb.from('profiles').update({ 
          depositBalance: (userSnap.data.depositBalance || 0) + ad.price 
        }).eq('id', ad.userId);
      }

      toast.success('Advertisement rejected and refunded', { id: loadingToast });
      fetchAdminData(true, true);
    } catch (err: any) {
      setAds(previousAds);
      setUsers(previousUsers);
      toast.error(err.message || 'Error rejecting ad', { id: loadingToast });
    }
  };

  const initiateDeleteAdAdmin = (ad: any) => {
    setDeleteAdConfirm(ad);
  };

  const executeDeleteAdAdmin = async () => {
    if (!deleteAdConfirm || adminActionLoading) return;
    try {
      setAdminActionLoading(true);
      await adminDb.from('advertisements').delete().eq('id', deleteAdConfirm.id);
      setAds(prev => prev.filter(a => a.id !== deleteAdConfirm.id));
      alert('Advertisement deleted completely.');
    } catch (err: any) {
      alert(err.message || 'Error deleting ad');
    } finally {
      setAdminActionLoading(false);
      setDeleteAdConfirm(null);
    }
  };

  const handleCreateRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemErrorMsg('');
    setRedeemSuccessMsg('');
    
    if (!newRedeemCode.trim() || !redeemAmount || !redeemMaxUses) {
      setRedeemErrorMsg('All fields are required!');
      return;
    }

    setRedeemLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Unauthenticated');

      const res = await fetch('/api/redeem-code/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: newRedeemCode.trim(),
          amount: parseFloat(redeemAmount),
          max_uses: parseInt(redeemMaxUses, 10)
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create code.');
      }

      setRedeemSuccessMsg(`Success! Code '${json.code?.code || newRedeemCode.toUpperCase()}' created successfully!`);
      setNewRedeemCode('');
      setRedeemAmount('');
      setRedeemMaxUses('');

      // Refresh lists
      const codesRes = await fetch('/api/redeem-code/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (codesRes.ok) {
        const codesJson = await codesRes.json();
        setRedeemCodes(codesJson.codes || []);
      }
    } catch (err: any) {
      setRedeemErrorMsg(err.message || 'Failed to create redeem code.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleDeleteRedeemCode = async (id: string, codeName: string) => {
    const isConfirmed = window.confirm(`আপনি কি নিশ্চিতভাবে '${codeName}' কোডটি ডিলিট করতে চান?`);
    if (!isConfirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Unauthenticated');

      const res = await fetch('/api/redeem-code/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'ডিলিট করতে ব্যর্থ হয়েছে।');
      }

      alert('রিডিম কোডটি সফলভাবে ডিলিট করা হয়েছে।');
      // Refresh list
      const codesRes = await fetch('/api/redeem-code/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (codesRes.ok) {
        const codesJson = await codesRes.json();
        setRedeemCodes(codesJson.codes || []);
      }
    } catch (err: any) {
      alert(err.message || 'ডিলিট করতে ব্রর্থ হয়েছে।');
    }
  };

  const handleDeleteAdAdmin = async (ad: any) => {
    // left for compatibility, replaced by above methods
  };

  const handleResolveTicket = async (ticket: Ticket) => {
    if (ticket.status !== 'open') return;
    const reply = prompt("Enter your final resolution message (optional):");
    
    const previousTickets = [...tickets];

    // Optimistic Update
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'resolved' as const } : t));
    const loadingToast = toast.loading('Resolving ticket...');

    try {
      const updates: any = {
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      };
      if (reply) {
        updates.adminReply = reply;
      }
      await adminDb.from('tickets').update(updates).eq('id', ticket.id);
      
      toast.success('Ticket resolved', { id: loadingToast });
      fetchAdminData(true, true);
    } catch (err: any) {
      setTickets(previousTickets);
      toast.error(err.message || 'Error resolving ticket', { id: loadingToast });
    }
  };

  const handleSendTicketReply = async (ticket: Ticket) => {
    const text = ticketReplies[ticket.id]?.trim();
    if (!text) return;

    const previousTickets = [...tickets];
    
    let parsedReplies = ticket.replies;
    if (typeof parsedReplies === 'string') {
      try { parsedReplies = JSON.parse(parsedReplies); } catch (e) { parsedReplies = []; }
    }
    const newReplies = [...(Array.isArray(parsedReplies) ? parsedReplies : []), { 
      sender: 'admin' as const, 
      text, 
      createdAt: Date.now() 
    }];

    // Optimistic Update
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, replies: newReplies } : t));
    setTicketReplies(prev => {
      const next = { ...prev };
      delete next[ticket.id];
      return next;
    });
    const loadingToast = toast.loading('Sending reply...');

    try {
       await adminDb.from('tickets').update({ replies: newReplies }).eq('id', ticket.id);
       toast.success('Reply sent', { id: loadingToast });
       fetchAdminData(true, true);
    } catch (err: any) {
       setTickets(previousTickets);
       toast.error("Failed to send reply: " + err.message, { id: loadingToast });
    }
  };

  const handleToggleBlock = async (userProfile: UserProfile) => {
    if (adminActionLoading) return;
    const isMasterEmail = ['harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(userProfile.email || '');
    if (isMasterEmail) {
      alert("Master emails cannot be blocked!");
      return;
    }
    
    if (!userProfile.isBlocked) {
      setBlockConfirmUser(userProfile);
      setBlockPassword('');
      return;
    }
    
    try {
      setAdminActionLoading(true);
      await adminDb.from('profiles').update({ isBlocked: false }).eq('id', userProfile.uid);
      alert("User unblocked successfully.");
      fetchAdminData(true);
    } catch (err: any) {
      alert("Failed to unblock user: " + err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const confirmBlockUser = async () => {
    if (!blockConfirmUser || adminActionLoading) return;
    if (blockPassword !== "ah2781") {
      alert("Incorrect password!");
      return;
    }
    try {
      setAdminActionLoading(true);
      await adminDb.from('profiles').update({ isBlocked: true }).eq('id', blockConfirmUser.uid);
      setBlockConfirmUser(null);
      setBlockPassword('');
      alert("User has been blocked successfully.");
      fetchAdminData(true);
    } catch (err: any) {
      alert("Failed to block user: " + err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleOpenEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditEmail(u.email || '');
    setEditPhone(u.phone || '');
    setEditDisplayName(u.displayName || '');
    setEditUsername(u.username || '');
    setEditPassword('');
  };

  const handleAdminImpersonate = async () => {
    if (!editingUser) return;
    setImpersonateLoading(true);
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data?.session?.access_token;
      if (!token) throw new Error("No admin session found");

      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: editingUser.uid })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to impersonate');

      toast.success('Entering Support Mode...');
      window.location.href = data.impersonateUrl;
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while impersonating');
      setImpersonateLoading(false);
    }
  };

  const handleSaveUserDetails = async () => {
    if (!editingUser) return;
    if (editPassword && editPassword.length < 6) {
      alert("পাসওয়ার্ডটি অবশ্যই কমপক্ষে ৬ অক্ষরের হতে হবে (Password must be at least 6 characters)");
      return;
    }
    setEditSubmitLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/update-user', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
         body: JSON.stringify({
            targetUserId: editingUser.uid,
            updates: {
               password: editPassword || undefined,
               email: editEmail,
               phone: editPhone,
               displayName: editDisplayName,
               username: editUsername
            }
         })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (data.warning) {
        alert("সতর্কতা: " + data.warning);
      } else {
        if (editPassword) {
          alert("পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! (Password changed successfully!)");
        } else {
          alert("ব্যবহারকারীর তথ্য সফলভাবে আপডেট করা হয়েছে! (User details updated successfully!)");
        }
        setEditingUser(null);
        setEditPassword('');
        fetchAdminData(true);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setEditSubmitLoading(false);
    }
  };
  const handleRecalculateBalances = async () => {
    if (adminActionLoading) return;
    if (!window.confirm("This will scan all transactions and submissions to recalculate pending balances for all users. Are you sure?")) return;
    try {
      setAdminActionLoading(true);
      const { data: usersSnap } = await adminDb.from('profiles').select('*');
      const { data: transactionsSnap } = await adminDb.from('transactions').select('*');
      const { data: submissionsSnap } = await adminDb.from('submissions').select('*');
      
      const txs = transactionsSnap as unknown as Transaction[];
      const subs = submissionsSnap as unknown as Submission[];
      const usersList = usersSnap as unknown as UserProfile[];
      
      let updatedCount = 0;
      
      for (const uDoc of usersList) {
        const uid = uDoc.uid;
        
        // Calculate pending deposits
        const pendingDeposits = txs.filter(t => t.userId === uid && t.type === 'deposit' && t.status === 'pending');
        const totalPendingDeposit = pendingDeposits.reduce((acc, t) => acc + t.amount, 0);
        
        // Calculate pending earnings (withdrawals + job submissions)
        const pendingWithdrawals = txs.filter(t => t.userId === uid && t.type === 'withdrawal' && t.status === 'pending');
        const totalPendingWithdrawal = pendingWithdrawals.reduce((acc, t) => acc + (t.amount || 0), 0);
        
        const pendingSubmissions = subs.filter(s => s.workerId === uid && s.status === 'pending');
        const totalPendingSubmission = pendingSubmissions.reduce((acc, s) => acc + (s.reward || 0), 0);
        
        const totalPendingEarning = totalPendingWithdrawal + totalPendingSubmission;
        
        // Also recalculate heldBalance (poster money locked in jobs)
        const posterPendingSubs = subs.filter(s => s.posterId === uid && s.status === 'pending');
        const posterHeld = posterPendingSubs.reduce((acc, s) => acc + (s.reward || 0), 0);
        
        // Check if anything needs updating
        if (uDoc.pendingDepositBalance !== totalPendingDeposit || 
            uDoc.pendingEarningBalance !== totalPendingEarning ||
            uDoc.heldBalance !== posterHeld) {
            
            await adminDb.from('profiles').update({
              pendingDepositBalance: totalPendingDeposit,
              pendingEarningBalance: totalPendingEarning,
              heldBalance: posterHeld
            }).eq('id', uid);
            updatedCount++;
        }
      }
      
      alert(`Successfully recalculated and fixed pending balances for ${updatedCount} users.`);
      fetchAdminData(true);
    } catch(err: any) {
      alert("Error: " + err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAssignMissingSerials = async () => {
    if (adminActionLoading) return;
    try {
      setAdminActionLoading(true);
      const { data: configSnap } = await adminDb.from('system_config').select('*').eq('id', 'config').single();
      let currentSerial = 11111;
      if (configSnap && configSnap.userSerial) {
        currentSerial = configSnap.userSerial;
      }

      let updatedCount = 0;
      for (const u of users) {
        if (!u.serialNumber) {
          await adminDb.from('profiles').update({ serialNumber: currentSerial }).eq('id', u.uid);
          currentSerial++;
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await adminDb.from('system_config').upsert({ id: 'config', userSerial: currentSerial });
        alert(`Assigned serials to ${updatedCount} old users!`);
        fetchAdminData(true);
      } else {
        alert("All users already have a serial number.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleSendWarning = async (user: UserProfile) => {
    if (adminActionLoading) return;
    const text = warningText[user.uid];
    if (!text) return;
    
    try {
      setAdminActionLoading(true);
      const newCount = (user.warningCount || 0) + 1;
      const updates: any = {
        warning: text,
        warningCount: newCount
      };
      
      if (newCount >= 2) {
        const isMasterEmail = ['harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email || '');
        if (!isMasterEmail) {
          updates.isBlocked = true;
        }
      }
      
      await adminDb.from('profiles').update(updates).eq('id', user.uid);
      setWarningText(prev => ({ ...prev, [user.uid]: '' }));
      alert(newCount >= 2 ? 'User warned and auto-blocked (2nd warning)' : 'Warning sent');
      fetchAdminData(true);
    } catch (err: any) {
      alert("Failed to send warning: " + err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleSendNotification = async (user: UserProfile) => {
    if (adminActionLoading) return;
    const text = notificationText[user.uid];
    if (!text) return;
    
    try {
      setAdminActionLoading(true);
      const notif = {
        id: Math.random().toString(36).substring(7),
        message: text,
        createdAt: new Date().toISOString(),
        isRead: false
      };
      
      const { data: userSnap } = await adminDb.from('profiles').select('notifications').eq('id', user.uid).single();
      const notifications = userSnap?.notifications || [];
      notifications.unshift(notif);
      await adminDb.from('profiles').update({ notifications }).eq('id', user.uid);
      
      alert('Notification sent successfully');
      setNotificationText(prev => ({ ...prev, [user.uid]: '' }));
      fetchAdminData(true);
    } catch(err: any) {
      alert(err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRemoveWarning = async (user: UserProfile) => {
    if (adminActionLoading) return;
    try {
      setAdminActionLoading(true);
      await adminDb.from('profiles').update({ warning: null }).eq('id', user.uid);
      alert('Warning removed');
      fetchAdminData(true);
    } catch (err: any) {
      alert("Failed to remove warning: " + err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdjustBalance = async (uid: string, type: 'earningBalance' | 'depositBalance', isAdd: boolean) => {
    if (adminActionLoading) return;
    let amountStr = type === 'earningBalance' ? balanceAdjust[uid] : depositBalanceAdjust[uid];
    let amount = parseFloat(amountStr);
    if (isNaN(amount) || amount === 0) return;
    
    try {
      setAdminActionLoading(true);
      amount = Math.abs(amount);
      if (!isAdd) {
        amount = -amount;
      }
      
      const userSnap = await adminDb.from('profiles').select('*').eq('id', uid).single();
      if (!userSnap.data) return;

      if (type === 'earningBalance') {
        await adminDb.from('profiles').update({ earningBalance: (userSnap.data.earningBalance || 0) + amount }).eq('id', uid);
        setBalanceAdjust(prev => ({ ...prev, [uid]: '' }));
        alert('Earning Balance adjusted');
      } else {
        await adminDb.from('profiles').update({ depositBalance: (userSnap.data.depositBalance || 0) + amount }).eq('id', uid);
        setDepositBalanceAdjust(prev => ({ ...prev, [uid]: '' }));
        alert('Deposit Balance adjusted');
      }
      fetchAdminData(true);
    } catch (err: any) {
      alert("Failed to adjust balance: " + err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const initiateDeleteJob = (job: any) => {
    setDeleteJobConfirm(job);
  };

  const executeDeleteJob = async () => {
    if (!deleteJobConfirm || adminActionLoading) return;
    try {
      setAdminActionLoading(true);
      const job: any = deleteJobConfirm;

      await adminDb.from('jobs').update({ status: 'deleted' }).eq('id', job.id);
      
      alert('Job deleted and funds refunded correctly.');
      fetchAdminData(true);
    } catch(err: any) {
      console.error(err);
      alert('Failed to delete job: ' + err.message);
    } finally {
      setAdminActionLoading(false);
      setDeleteJobConfirm(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
        // left for compatibility
  };

  const handleApproveDeleteJob = async (job: any) => {
    const previousJobs = [...jobs];

    // Optimistic Update
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'deleted' } : j));
    const loadingToast = toast.loading('Approving job deletion...');

    try {
      await adminDb.from('jobs').update({ status: 'deleted' }).eq('id', job.id);
      
      toast.success("Job delete request approved, funds refunded.", { id: loadingToast });
      fetchAdminData(true, true);
    } catch (error: any) {
      console.error(error);
      setJobs(previousJobs);
      toast.error("Failed to approve job deletion: " + error.message, { id: loadingToast });
    }
  };

  const handleRejectDeleteJob = async (jobId: string) => {
    const previousJobs = [...jobs];

    // Optimistic Update
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'open' } : j));
    const loadingToast = toast.loading('Rejecting job deletion...');

    try {
      await adminDb.from('jobs').update({ status: 'open' }).eq('id', jobId);
      toast.success("Job delete request rejected, job is open again.", { id: loadingToast });
      fetchAdminData(true, true);
    } catch (error: any) {
       console.error(error);
       setJobs(previousJobs);
       toast.error("Failed to reject job deletion: " + error.message, { id: loadingToast });
    }
  };

  const handleApproveJobPending = async (job: any) => {
    const previousJobs = [...jobs];

    // Optimistic Update
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'open' } : j));
    const loadingToast = toast.loading('Approving job...');

    try {
      await adminDb.from('jobs').update({ status: 'open' }).eq('id', job.id);
      toast.success("Job approved and published successfully!", { id: loadingToast });
      fetchAdminData(true, true);
    } catch (error: any) {
      console.error(error);
      setJobs(previousJobs);
      toast.error("Failed to approve job: " + error.message, { id: loadingToast });
    }
  };

  const handleRejectJobPending = async (job: any) => {
    const confirmStr = prompt(`Type 'REJECT' to confirm rejecting this job:`);
    if (confirmStr !== 'REJECT' && confirmStr !== 'reject') return;

    const previousJobs = [...jobs];

    // Optimistic Update
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'deleted' } : j));
    const loadingToast = toast.loading('Rejecting job...');

    try {
      // Triggers our secure backend transaction refund flow
      await adminDb.from('jobs').update({ status: 'deleted' }).eq('id', job.id);

      toast.success("Job rejected and full funds refunded successfully.", { id: loadingToast });
      fetchAdminData(true, true);
    } catch (error: any) {
      console.error(error);
      setJobs(previousJobs);
      toast.error("Failed to reject job: " + error.message, { id: loadingToast });
    }
  };

  const filteredUsers = users;
  const sortedUsers = users;
  const sortedTransactions = transactions;
  const sortedSubmissions = submissions;
  const sortedJobs = jobs;
  const sortedTickets = tickets;
  const sortedAds = ads;

  const getMs = (dateVal: any) => {
    if (!dateVal) return 0;
    if (typeof dateVal === 'object') {
      if (typeof dateVal.toMillis === 'function') return dateVal.toMillis();
      if (typeof dateVal.seconds === 'number') return dateVal.seconds * 1000;
    }
    const parsed = Date.parse(dateVal);
    return isNaN(parsed) ? (typeof dateVal === 'number' ? dateVal : 0) : parsed;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" id="admin-panel-loader">
         <div className="w-12 h-12 border-4 border-blue-200 dark:border-slate-700 border-t-[#0B3D9E] dark:border-t-[#F97316] rounded-full animate-spin" />
         <span className="font-black text-xs text-slate-400 dark:text-slate-500 tracking-widest uppercase animate-pulse">
            Syncing Master Database...
         </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-6 sm:p-8 rounded-[2.5rem] border border-blue-900/60 shadow-xl shadow-blue-950/20 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden text-white">
        <div className="absolute -top-12 -right-12 w-72 h-72 bg-[#F97316]/15 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-wrap items-center gap-5 relative z-10">
          <div className="bg-[#F97316] p-4 rounded-3xl text-white shadow-xl shadow-orange-950/30">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">System Authority</h1>
            <p className="text-blue-200/80 font-bold text-xs tracking-widest uppercase">Master Control Hub</p>
          </div>
          <div className="hidden sm:block ml-2 border-l border-white/15 pl-4 bg-white/95 dark:bg-slate-900/90 px-3 py-1.5 rounded-2xl">
            <BrandLogo size="sm" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 relative z-10">
           <button 
             onClick={() => fetchAdminData(true)}
             disabled={isRefreshing}
             className="bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 transition-colors font-bold text-sm disabled:opacity-50 cursor-pointer"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-refresh-cw ${isRefreshing ? 'animate-spin' : ''}`}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
             {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
           </button>
           <div className="bg-white/10 border border-white/15 backdrop-blur-sm text-white px-6 py-3 rounded-2xl flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-200" />
              <div>
                 <p className="text-[10px] font-black uppercase text-blue-200/80 tracking-wider">Live Accounts</p>
                 <p className="font-display font-black text-xl tabular-nums">{totalUsers}</p>
              </div>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/50 text-[#0B3D9E] dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Total Users</p>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white tabular-nums">{totalUsers}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/50 text-[#0B3D9E] dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Total Jobs</p>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white tabular-nums">{totalJobs}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Tasks Done</p>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white tabular-nums">{completedJobsCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-orange-50 dark:bg-orange-950/50 text-[#F97316] dark:text-[#FB923C] rounded-2xl flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Earning Balance</p>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalEarningBalance)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/50 text-[#0B3D9E] dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Deposit Balance</p>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalDepositBalance)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Held Balance</p>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalHeld)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Total Deposit</p>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalDeposit)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Total Withdraw</p>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalWithdraw)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-orange-50 dark:bg-orange-950/50 text-[#F97316] dark:text-[#FB923C] rounded-2xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Pending Items</p>
            <p className="font-display text-2xl font-black text-[#F97316] dark:text-[#FB923C] tabular-nums">{pendingTransactionsCount + pendingSubsCount}</p>
          </div>
        </div>
      </div>

      <div className="flex bg-white dark:bg-[#1E293B] p-2 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-x-auto gap-2 transition-colors">
        {(['users', 'jobs', 'transactions', 'submissions', 'tickets', 'ads', 'redeem_codes', 'deletions', 'settings'] as const).map(tab => {
          let hasPending = false;
          if (tab === 'transactions') {
            hasPending = transactions.some(t => t.status === 'pending');
          } else if (tab === 'submissions') {
            hasPending = submissions.some(s => s.status === 'pending');
          } else if (tab === 'tickets') {
            hasPending = tickets.some(t => t.status === 'open');
          } else if (tab === 'jobs') {
            hasPending = jobs.some(j => j.status === 'pending' || j.status === 'delete_requested');
          } else if (tab === 'ads') {
            hasPending = ads.some(a => a.status === 'pending');
          } else if (tab === 'deletions') {
            hasPending = users.some(u => u.account_status === 'pending_deletion');
          }

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap relative cursor-pointer",
                activeTab === tab ? "bg-[#07266E] dark:bg-[#F97316] text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <span>{tab === 'redeem_codes' ? 'Redeem Codes' : tab === 'deletions' ? 'Restricted' : tab}</span>
              {hasPending && (
                <span className="w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-[#1E293B] rounded-full animate-pulse shrink-0" />
              )}
            </button>
          );
        })}
      </div>

        {activeTab === 'users' && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                placeholder="Search by ID, Phone, Email or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] outline-none font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white transition-colors"
              />
            </div>
            <div className="sm:w-64">
              <select
                value={userSortOrder}
                onChange={(e) => setUserSortOrder(e.target.value as any)}
                className="w-full px-6 py-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] outline-none font-bold text-slate-900 dark:text-white transition-colors cursor-pointer appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394A3B8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem top 50%', backgroundSize: '0.65rem auto' }}
              >
                <option value="newest">Sort by Newest Users</option>
                <option value="balance_high">Sort by High Balance</option>
                <option value="balance_low">Sort by Low Balance</option>
              </select>
            </div>
            <button
              onClick={() => setShowDuplicateIPs(!showDuplicateIPs)}
              className={cn(
                "px-6 py-4 rounded-2xl font-bold text-sm transition-colors border shadow-sm flex items-center justify-center gap-2 cursor-pointer",
                showDuplicateIPs 
                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800" 
                  : "bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <AlertTriangle className="w-5 h-5" />
              {showDuplicateIPs ? 'Hide Duplicate IPs' : 'Show Duplicate IPs'}
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-[#1E293B] rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden transition-colors relative">
          {tabLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-[#0B1120]/60 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="animate-spin rounded-full h-9 w-9 border-4 border-blue-200 dark:border-slate-700 border-t-[#0B3D9E] dark:border-t-[#F97316]"></div>
            </div>
          )}

          {fetchError && (
            <div className="m-6 p-5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <h4 className="font-black text-rose-800 dark:text-rose-300 text-sm uppercase tracking-tight">Connection / Server Error</h4>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">{fetchError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchAdminData(false, false, activeTab, currentPage)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md uppercase tracking-wider transition-all flex items-center gap-1.5 justify-center self-start sm:self-auto cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Connection
              </button>
            </div>
          )}

        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="p-6 pb-4 relative border-b border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Filter transactions by User UID, Name, or Serial..."
                    value={txSearchTerm}
                    onChange={(e) => setTxSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E]"
                  />
                </div>
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="sm:w-44 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] cursor-pointer"
                >
                  <option value="All">All Types</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="bonus">Bonus</option>
                  <option value="payment">Payment</option>
                </select>
              </div>
              {txSearchTerm && (
                <button
                  onClick={() => setTxSearchTerm('')}
                  className="px-4 py-2 text-xs font-black uppercase text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-blue-100 border-b border-blue-900/50">
                  <th className="p-6 text-xs font-black uppercase tracking-widest">User</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest">Type/Method</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest">Amount</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest">Status</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest">Details</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 transition-colors">
                {sortedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-slate-700 dark:text-slate-300">
                    <td className="p-6">
                      <p className="font-bold text-slate-900 dark:text-white" title={(tx as any).userName || 'User'}>
                        {((tx as any).userName && (tx as any).userName.length > 14) ? `${(tx as any).userName.slice(0, 14)}...` : ((tx as any).userName || 'User')}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                        {tx.userId.slice(0, 8)}...
                        <span className="bg-blue-50 dark:bg-blue-950/60 text-[#0B3D9E] dark:text-blue-400 px-1.5 py-0.5 rounded font-black">#{tx.userSerial || getUserSerial(tx.userId)}</span>
                      </p>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        {tx.type === 'deposit' ? <ArrowDownLeft className="text-emerald-500 w-4 h-4" /> : <ArrowUpRight className="text-[#F97316] w-4 h-4" />}
                        <span className="font-bold capitalize">{tx.type} ({tx.method})</span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                      </p>
                    </td>
                    <td className="p-6">
                      {tx.type === 'withdrawal' ? (
                        <>
                          <p className="font-black text-lg text-slate-900 dark:text-white tabular-nums">
                            {formatCurrency(tx.finalAmount !== undefined ? tx.finalAmount : (tx.amount - (tx.fee || 0)))}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5 tabular-nums">
                            with charge {formatCurrency(tx.amount)}
                          </p>
                        </>
                      ) : (
                        <p className="font-black text-lg text-slate-900 dark:text-white tabular-nums">{formatCurrency(tx.amount)}</p>
                      )}
                    </td>
                    <td className="p-6">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-colors",
                        tx.status === 'completed' ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" :
                        tx.status === 'pending' ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400" :
                        "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                      )}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-6">
                       <div className="flex items-center gap-2 mb-1">
                         <span className="text-xs text-slate-500 font-medium">P:</span>
                         <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{tx.phone}</span>
                         {tx.phone && (
                           <button 
                             onClick={() => {
                               navigator.clipboard.writeText(tx.phone);
                               toast.success('Copied!');
                             }}
                             className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-colors text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200 cursor-pointer"
                             title="Copy phone"
                           >
                             <Copy className="w-4 h-4" />
                           </button>
                         )}
                       </div>
                       <p className="text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">T: {tx.transactionId}</p>
                    </td>
                    <td className="p-6">
                      {tx.status === 'pending' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleApproveTransaction(tx)}
                            disabled={adminActionLoading}
                            className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
                          >
                             {adminActionLoading ? "..." : <CheckCircle2 className="w-5 h-5" />}
                          </button>
                          <button 
                            onClick={() => handleRejectTransaction(tx)}
                            disabled={adminActionLoading}
                            className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50 cursor-pointer"
                          >
                             {adminActionLoading ? "..." : <XCircle className="w-5 h-5" />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {activeTab === 'users' && (
           <div className="overflow-x-auto bg-white dark:bg-[#1E293B] rounded-3xl overflow-hidden transition-colors">
             <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] border-b border-blue-900/50">
                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Identity</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Financials</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Authority Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 transition-colors">
                  {sortedUsers.map((u) => (
                    <tr key={u.uid} className={cn("hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors", u.isBlocked && "bg-rose-50/50 dark:bg-rose-950/20")}>
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-br from-[#07266E] to-[#0B3D9E] text-white w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-md shrink-0">
                            #{u.serialNumber || u.uid.slice(0, 5).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                               <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight" title={(u as any).name || u.displayName || (u as any).username || 'Unnamed User'}>
                                 {(() => {
                                   const fullName = (u as any).name || u.displayName || (u as any).username || 'Unnamed User';
                                   return fullName.length > 16 ? `${fullName.slice(0, 16)}...` : fullName;
                                 })()}
                                 <span className="text-[#0B3D9E] dark:text-blue-400 ml-1">#{u.serialNumber || u.uid.slice(0, 5).toUpperCase()}</span>
                               </p>
                               <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 rounded transition-colors">{u.role}</span>
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold" title={u.uid}>
                              UID: {u.uid && u.uid.length > 12 ? `${u.uid.slice(0, 12)}...` : u.uid}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-400 font-bold" title={(u as any).username || 'nousername'}>
                              @{((u as any).username && (u as any).username.length > 14) ? `${(u as any).username.slice(0, 14)}...` : ((u as any).username || 'nousername')} • {(u as any).phone || u.email || 'No Phone'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                              IP: {u.last_ip_address || 'N/A'}
                              {(() => {
                                const isActive = !u.isBlocked && u.account_status !== 'deleted';
                                const count = isActive ? (activeIPCounts[u.last_ip_address!] || 0) : (duplicateIPCounts[u.last_ip_address!] || 0);
                                return u.last_ip_address && u.last_ip_address !== 'N/A' && typeof u.last_ip_address === 'string' && u.last_ip_address.trim() !== '' && count > 1 ? (
                                  <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest rounded">
                                    Matched: {count} Accounts
                                  </span>
                                ) : null;
                              })()}
                            </p>
                            {u.warning && (
                               <div className="mt-2 flex items-center justify-between bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 px-3 py-2 rounded-lg text-[#F97316] dark:text-[#FB923C] transition-colors">
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <p className="text-[10px] font-black uppercase tracking-widest break-all">Active Warn: {u.warning}</p>
                                  </div>
                                  <button onClick={() => handleRemoveWarning(u)} className="ml-3 p-1 shrink-0 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer" title="Remove Warning">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                               </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-4">
                             <div>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Earning Bal</p>
                                <p className="font-display font-black text-xl text-slate-900 dark:text-white tabular-nums">{formatCurrency(u.earningBalance)}</p>
                             </div>
                             <div>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Deposit Bal</p>
                                <p className="font-display font-black text-xl text-[#0B3D9E] dark:text-blue-400 tabular-nums">{formatCurrency(u.depositBalance)}</p>
                             </div>
                           </div>
                           <div className="flex flex-col gap-2">
                               <div className="flex items-center gap-1">
                                  <input 
                                    type="number"
                                    placeholder="Earning Amt"
                                    value={balanceAdjust[u.uid] || ''}
                                    onChange={(e) => setBalanceAdjust(prev => ({ ...prev, [u.uid]: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] text-slate-900 dark:text-white transition-colors"
                                  />
                                  <button 
                                    onClick={() => handleAdjustBalance(u.uid, 'earningBalance', true)}
                                    className="p-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl transition-all shadow-sm cursor-pointer"
                                    title="Add Balance"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleAdjustBalance(u.uid, 'earningBalance', false)}
                                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm cursor-pointer"
                                    title="Subtract Balance"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                               </div>
                               <div className="flex items-center gap-1">
                                  <input 
                                    type="number"
                                    placeholder="Deposit Amt"
                                    value={depositBalanceAdjust[u.uid] || ''}
                                    onChange={(e) => setDepositBalanceAdjust(prev => ({ ...prev, [u.uid]: e.target.value }))}
                                    className="w-full px-3 py-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#0B3D9E]/30 focus:border-[#0B3D9E] text-slate-900 dark:text-blue-100 transition-colors"
                                  />
                                  <button 
                                    onClick={() => handleAdjustBalance(u.uid, 'depositBalance', true)}
                                    className="p-2 bg-[#0B3D9E] hover:bg-[#07266E] text-white rounded-xl transition-all shadow-sm cursor-pointer"
                                    title="Add Balance"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleAdjustBalance(u.uid, 'depositBalance', false)}
                                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm cursor-pointer"
                                    title="Subtract Balance"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                               </div>
                           </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-3">
                           <button 
                             onClick={() => handleOpenEditModal(u)}
                             className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#07266E] hover:bg-[#0B3D9E] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer"
                           >
                             <Settings className="w-4 h-4" />
                             এডিট সেটিংস (Edit)
                           </button>
                           <div className="flex items-center gap-2 mt-1">
                              <input 
                                type="text"
                                placeholder="Notification message..."
                                value={notificationText[u.uid] || ''}
                                onChange={(e) => setNotificationText(prev => ({ ...prev, [u.uid]: e.target.value }))}
                                className="flex-1 px-4 py-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#0B3D9E]/30 text-slate-900 dark:text-blue-100 placeholder:text-slate-400 dark:placeholder:text-blue-400/50 transition-colors"
                              />
                              <button 
                                onClick={() => handleSendNotification(u)}
                                className="p-2 bg-[#0B3D9E] hover:bg-[#07266E] text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                                title="Send Notification"
                              >
                                 <Bell className="w-4 h-4" />
                              </button>
                           </div>
                           <div className="flex items-center gap-2 mt-1">
                              <input 
                                type="text"
                                placeholder="Warning message..."
                                value={warningText[u.uid] || ''}
                                onChange={(e) => setWarningText(prev => ({ ...prev, [u.uid]: e.target.value }))}
                                className="flex-1 px-4 py-2 bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#F97316]/30 text-slate-900 dark:text-orange-100 placeholder:text-slate-400 dark:placeholder:text-orange-400/50 transition-colors"
                              />
                              <button 
                                onClick={() => handleSendWarning(u)}
                                className="p-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                              >
                                 <MessageSquare className="w-4 h-4" />
                              </button>
                           </div>
                           <button 
                            onClick={() => handleToggleBlock(u)}
                            className={cn(
                              "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                              u.isBlocked 
                                ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" 
                                : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60"
                            )}
                          >
                            {u.isBlocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            {u.isBlocked ? 'Unlock' : 'Block User'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
           </div>
        )}

        {activeTab === 'jobs' && (
           <div className="p-6 sm:p-8 space-y-4">
              <div className="relative pb-2">
                 <Search className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                 <input 
                   type="text"
                   placeholder="Filter jobs by Title, Job ID, Poster UID or Serial..."
                   value={jobsSearchTerm}
                   onChange={(e) => setJobsSearchTerm(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E]"
                 />
              </div>
              {sortedJobs.map(job => (
                <div key={job.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm gap-4 transition-colors">
                   <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                          <span className="bg-blue-50 text-[#0B3D9E] dark:bg-blue-950/60 dark:text-blue-400 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800/50">
                            ID: #{job.id.split('-')[0].toUpperCase()}
                          </span>
                      </div>
                      <p className="font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">{job.title}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black flex items-center gap-1 flex-wrap">
                        <span>By: {job.posterName || job.posterId.slice(0,8)}</span>
                        {job.posterSerial && (
                            <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                UID: #{job.posterSerial}
                            </span>
                        )}
                        <span>| Status: {job.status}</span>
                      </p>
                   </div>
                   <div className="text-right flex flex-col md:flex-row items-end md:items-center gap-4">
                      <div className="text-right">
                         <p className="font-display font-black text-[#0B3D9E] dark:text-[#FB923C] text-xl tabular-nums">{formatCurrency(job.pricePerWork)}</p>
                         <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest tabular-nums">{job.completedCount} / {job.maxWorkers} Sub</p>
                         <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest tabular-nums">{job.approvedCount || 0} Appr | {(job.completedCount - (job.approvedCount || 0))} Pend</p>
                      </div>
                      
                      {job.status === 'pending' ? (
                        <div className="flex gap-2">
                           <button onClick={() => handleApproveJobPending(job)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer">এপ্রুভ করুন</button>
                           <button onClick={() => handleRejectJobPending(job)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer">রিজেক্ট করুন</button>
                        </div>
                      ) : job.status === 'delete_requested' ? (
                        <div className="flex gap-2">
                           <button onClick={() => handleApproveDeleteJob(job)} className="px-4 py-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg text-xs transition-colors cursor-pointer">Approve Delete</button>
                           <button onClick={() => handleRejectDeleteJob(job.id)} className="px-4 py-2 bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 font-bold rounded-lg text-xs transition-colors cursor-pointer">Reject Delete</button>
                        </div>
                      ) : (
                        <button onClick={() => initiateDeleteJob(job)} title="Hard delete job" className="p-2 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0 transition-colors cursor-pointer">
                           <Ban className="w-5 h-5" />
                        </button>
                      )}
                   </div>
                </div>
              ))}
           </div>
        )}

        {activeTab === 'submissions' && (
          <div className="p-6 sm:p-8 space-y-6">
             <div className="relative pb-2">
                <Search className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter submissions by Worker Name, UID, Serial, Job ID or Submission ID..."
                  value={subSearchTerm}
                  onChange={(e) => setSubSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E]"
                />
             </div>
             {sortedSubmissions.map((sub) => (
               <div key={sub.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                     <div>
                        <h4 className="font-display font-black text-slate-900 dark:text-white uppercase text-lg">{sub.jobTitle || 'Job Submission'}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                          Worker: {(sub.workerName && sub.workerName.length > 14) ? `${sub.workerName.slice(0, 14)}...` : (sub.workerName || 'Worker')} <span className="text-[#0B3D9E] dark:text-blue-400">#{sub.workerSerial || getUserSerial(sub.workerId)}</span> | Submitted: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ''}
                        </p>
                     </div>
                     <span className={cn(
                       "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0",
                       sub.status === 'approved' ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" :
                       sub.status === 'pending' ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400" :
                       "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                     )}>{sub.status}</span>
                  </div>

                  {sub.proofText && (
                    <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-700 transition-colors">
                       <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Text Proof</p>
                       <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{sub.proofText}</p>
                    </div>
                  )}

                  {sub.screenshots && sub.screenshots.length > 0 && (
                    <div className="flex gap-4 overflow-x-auto pb-2">
                       {sub.screenshots.map((s, idx) => (
                         <img key={idx} src={s} className="h-48 w-auto rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm transition-colors" alt="proof" />
                       ))}
                    </div>
                  )}

                  {sub.status === 'pending' && (
                    <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 transition-colors">
                       <button 
                         onClick={() => handleApproveSubmission(sub)}
                         disabled={adminActionLoading || processingSubmissionId !== null}
                         className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                       >
                          {processingSubmissionId === sub.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              Approve Proof
                            </>
                          )}
                       </button>
                       <button 
                         onClick={() => handleRejectSubmission(sub)}
                         disabled={adminActionLoading || processingSubmissionId !== null}
                         className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                       >
                          {processingSubmissionId === sub.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <XCircle className="w-5 h-5" />
                              Reject Proof
                            </>
                          )}
                       </button>
                    </div>
                  )}
               </div>
             ))}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="p-6 sm:p-8 space-y-6">
             <div className="relative pb-2">
                <Search className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter tickets by Subject, Ticket ID, User UID or Serial..."
                  value={ticketSearchTerm}
                  onChange={(e) => setTicketSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E]"
                />
             </div>
             {sortedTickets.length === 0 ? (
               <div className="text-center p-12 text-slate-400 dark:text-slate-500 font-bold italic">No tickets found.</div>
             ) : (
               sortedTickets.map(ticket => (
                 <div key={ticket.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                       <div>
                          <h4 className="font-display font-black text-slate-900 dark:text-white uppercase text-lg">{ticket.subject}</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                            User: {(getUserName(ticket.userId) && getUserName(ticket.userId).length > 14) ? `${getUserName(ticket.userId).slice(0, 14)}...` : getUserName(ticket.userId)} <span className="text-[#0B3D9E] dark:text-blue-400">#{ticket.userSerial || getUserSerial(ticket.userId)}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">Submitted: {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}</p>
                       </div>
                       <span className={cn(
                         "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0",
                         ticket.status === 'resolved' ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                       )}>
                         {ticket.status}
                       </span>
                    </div>

                    <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap border border-slate-200 dark:border-slate-700 transition-colors">
                      {Array.isArray(ticket.replies) && ticket.replies.length > 0 ? ticket.replies[0].text : 'No description'}
                    </div>

                    {Array.isArray(ticket.replies) && ticket.replies.length > 1 && (
                      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 transition-colors">
                        {ticket.replies.slice(1).map((reply: any, i: number) => (
                           <div key={i} className={cn(
                             "p-3 rounded-xl text-sm font-medium transition-colors",
                             reply.sender === 'admin' ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 mr-8 text-slate-900 dark:text-blue-100" : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ml-8 text-slate-700 dark:text-slate-300"
                           )}>
                              <div className="font-black text-[10px] uppercase tracking-widest opacity-60 mb-1">
                                {reply.sender === 'admin' ? 'You (Admin)' : 'User'}
                              </div>
                              {reply.text}
                           </div>
                        ))}
                      </div>
                    )}

                    {ticket.status === 'open' && (
                      <div className="flex flex-wrap sm:flex-nowrap gap-2">
                        <input 
                           type="text"
                           placeholder="Type an admin reply..."
                           className="flex-1 min-w-[200px] px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                           value={ticketReplies[ticket.id] || ''}
                           onChange={(e) => setTicketReplies(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                           onKeyDown={async (e) => {
                             if (e.key === 'Enter') {
                               e.preventDefault();
                               handleSendTicketReply(ticket);
                             }
                           }}
                        />
                        <button 
                           onClick={() => handleSendTicketReply(ticket)}
                           className="px-6 py-2.5 bg-[#0B3D9E] hover:bg-[#07266E] text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                        >
                           <Send className="w-4 h-4" />
                           Send
                        </button>
                        <button 
                          onClick={() => handleResolveTicket(ticket)}
                          className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm whitespace-nowrap shadow-sm transition-all cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                    {ticket.status === 'resolved' && ticket.adminReply && (!Array.isArray(ticket.replies) || ticket.replies.length === 0) && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4 rounded-xl text-sm font-medium text-slate-900 dark:text-blue-100">
                        <span className="font-bold text-[#0B3D9E] dark:text-blue-400 mr-2">Resolution:</span>
                        {ticket.adminReply}
                      </div>
                    )}
                 </div>
               ))
             )}
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="p-6 sm:p-8 space-y-4">
             <div className="relative pb-2">
                <Search className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter advertisements by Link, Ad ID, User UID or Serial..."
                  value={adsSearchTerm}
                  onChange={(e) => setAdsSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E]"
                />
             </div>
             {sortedAds.length === 0 ? (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-[#1E293B] rounded-[2rem] border border-slate-200 dark:border-slate-700/80 transition-colors">No Advertisements Found</div>
             ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {sortedAds.map((ad: any) => (
                    <div key={ad.id} className="bg-white dark:bg-slate-800/70 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4 relative overflow-hidden flex flex-col transition-colors">
                      <div className="flex-shrink-0">
                         <img src={ad.image} alt="Ad Banner" className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                      </div>
                      <div className="flex-1 space-y-2">
                         <div className="flex items-center justify-between gap-2">
                           <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest break-all">Link: <a href={ad.link} target="_blank" rel="noreferrer" className="text-[#0B3D9E] dark:text-blue-400 hover:underline">{ad.link}</a></p>
                           <button 
                             onClick={() => initiateDeleteAdAdmin(ad)}
                             title="Delete without refund"
                             className="p-2 text-rose-400 dark:text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                         <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">Duration: {ad.durationDays} Days | Price: {formatCurrency(ad.price)}</p>
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Submitted by: <span className="text-[#0B3D9E] dark:text-blue-400">#{ad.userSerial || ad.userId.slice(0, 6)}</span></p>
                         <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                              ad.status === 'approved' ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" :
                              ad.status === 'rejected' ? "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400" : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                            )}>
                              {ad.status}
                            </span>
                            {ad.status === 'approved' && ad.expiresAt && (
                               <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                 Expires: {new Date(ad.expiresAt.toMillis ? ad.expiresAt.toMillis() : ad.expiresAt).toLocaleString()}
                               </span>
                            )}
                         </div>
                      </div>
                      {ad.status === 'pending' && (
                        <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                          <button 
                            onClick={() => handleApproveAd(ad)}
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </button>
                          <button 
                            onClick={() => handleRejectAd(ad)}
                            className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" /> Reject & Refund
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
             )}
          </div>
        )}

        {activeTab === 'redeem_codes' && (
          <div className="p-6 sm:p-8 space-y-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-50 dark:bg-orange-950/50 rounded-2xl text-[#F97316] dark:text-[#FB923C]">
                <Gift className="w-7 h-7" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight transition-colors">Redeem Codes Manager</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">Create rewards and track user claims</p>
              </div>
            </div>

            {redeemSuccessMsg && (
              <div id="admin-redeem-success" className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-3 font-semibold text-sm transition-all animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <p>{redeemSuccessMsg}</p>
              </div>
            )}

            {redeemErrorMsg && (
              <div id="admin-redeem-error" className="p-4 bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 text-rose-800 dark:text-rose-300 rounded-xl flex items-center gap-3 font-semibold text-sm transition-all animate-fadeIn">
                <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <p>{redeemErrorMsg}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form panel */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4 transition-colors">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide text-xs">Create New Reward Code</h3>
                <form onSubmit={handleCreateRedeemCode} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2">Redeem Code (e.g. GETBDT100)</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm outline-none font-bold uppercase placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#0B3D9E] text-slate-900 dark:text-white transition-colors"
                      placeholder="BOOST20"
                      value={newRedeemCode}
                      onChange={(e) => setNewRedeemCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2">Reward Amount (BDT)</label>
                    <input 
                      type="number"
                      step="any"
                      min="0.01"
                      className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm outline-none font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#0B3D9E] text-slate-900 dark:text-white transition-colors"
                      placeholder="10"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2">Max Claims Limit (Users Count)</label>
                    <input 
                      type="number"
                      min="1"
                      className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm outline-none font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#0B3D9E] text-slate-900 dark:text-white transition-colors"
                      placeholder="5"
                      value={redeemMaxUses}
                      onChange={(e) => setRedeemMaxUses(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={redeemLoading}
                    className="w-full bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white font-bold text-sm py-4 rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {redeemLoading ? 'Creating...' : 'Create Reward Code'}
                  </button>
                </form>
              </div>

              {/* Data Table panel */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide text-xs transition-colors">Active Reward Codes ({redeemCodes.length})</h3>
                
                {redeemCodes.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/60 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                    <Gift className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500">কোন রিডিম কোড পাওয়া যায়নি</p>
                    <p className="text-xs text-slate-400 dark:text-slate-600">একটি রিডিম কোড তৈরি করতে বাম পাশের ফর্মটি ব্যবহার করুন</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden overflow-x-auto transition-colors">
                    <table className="w-full text-left border-collapse border-spacing-0">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-blue-100 border-b border-blue-900/50">
                          <th className="p-4 text-[10px] font-black uppercase tracking-wider">SN.</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-wider">Code</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-wider">Amount</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-wider">Claims (Used / Max)</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-wider">Created</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {redeemCodes.map((codeItem, index) => {
                          const percentage = Math.min(100, Math.round(((codeItem.used_count || 0) / (codeItem.max_uses || 1)) * 100));
                          return (
                            <tr key={codeItem.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 tabular-nums">{index + 1}</td>
                              <td className="p-4">
                                <span className="bg-blue-50 dark:bg-blue-950/60 text-[#0B3D9E] dark:text-blue-400 font-mono font-extrabold text-sm px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/50 transition-colors">
                                  {codeItem.code}
                                </span>
                              </td>
                              <td className="p-4 font-black text-slate-900 dark:text-white text-sm tabular-nums transition-colors">
                                {formatCurrency(codeItem.amount)}
                              </td>
                              <td className="p-4 space-y-1.5 min-w-[150px]">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums transition-colors">
                                  <span>{codeItem.used_count} / {codeItem.max_uses} claimed</span>
                                  <span>{percentage}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden transition-colors">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      percentage >= 100 ? "bg-rose-500" : "bg-[#F97316]"
                                    )}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </td>
                              <td className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap transition-colors">
                                {codeItem.created_at ? format(new Date(codeItem.created_at), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleDeleteRedeemCode(codeItem.id, codeItem.code)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 rounded-xl transition-all cursor-pointer"
                                  title="Delete Code"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deletions' && (
          <div className="p-6 md:p-8 space-y-8">
            <div className="flex items-center gap-3 mb-6 transition-colors">
              <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
              <h2 className="font-display text-2xl font-black text-slate-900 dark:text-white uppercase">Restricted Accounts</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Name, Email, Phone..."
                  value={restrictedSearchTerm}
                  onChange={(e) => setRestrictedSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] outline-none"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={restrictedFilter}
                  onChange={(e: any) => setRestrictedFilter(e.target.value)}
                  className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] outline-none"
                >
                  <option value="all">All Accounts</option>
                  <option value="blocked">Blocked Only</option>
                  <option value="deleted">Deleted Only</option>
                </select>
                <button
                  onClick={() => { fetchAdminData(); }}
                  className="px-6 py-3 bg-[#0B3D9E] hover:bg-[#07266E] text-white font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Pending Requests */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700/80 p-6 shadow-sm">
                 <h3 className="font-display text-lg font-black text-[#F97316] dark:text-[#FB923C] mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Pending Requests</h3>
                 <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {users.filter(u => u.account_status === 'pending_deletion').length === 0 ? (
                       <p className="text-slate-400 text-sm font-medium">No pending deletion requests.</p>
                    ) : (
                       users.filter(u => u.account_status === 'pending_deletion').map(u => (
                          <div key={u.id} className="p-4 bg-white dark:bg-[#1E293B] rounded-2xl border border-amber-200 dark:border-amber-800/50">
                             <div className="flex justify-between items-start mb-2">
                               <div>
                                  <p className="font-bold text-slate-900 dark:text-white">{u.displayName}</p>
                                  <p className="text-xs text-slate-500 font-mono">UID: {u.uid}</p>
                               </div>
                               <span className="px-2 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold">Pending</span>
                             </div>
                             <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl mb-4 italic">"{u.deletion_reason || 'No reason provided'}"</p>
                             <div className="flex gap-2">
                                <button onClick={() => handleRejectDeletion(u.id || u.uid)} disabled={adminActionLoading} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer">Reject</button>
                                <button onClick={() => handleApproveDeletion(u.id || u.uid)} disabled={adminActionLoading} className="flex-1 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 cursor-pointer">Approve Deletion</button>
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              </div>

              {/* Deleted Accounts */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700/80 p-6 shadow-sm">
                 <h3 className="font-display text-lg font-black text-rose-600 dark:text-rose-400 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Restricted List</h3>
                 <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {users.filter(u => {
                       const isRestricted = u.account_status === 'deleted' || u.isBlocked === true;
                       if (!isRestricted) return false;
                       if (restrictedFilter === 'blocked') return u.isBlocked === true;
                       if (restrictedFilter === 'deleted') return u.account_status === 'deleted';
                       return true;
                    }).length === 0 ? (
                       <p className="text-slate-400 text-sm font-medium">No accounts found.</p>
                    ) : (
                       users.filter(u => {
                          const isRestricted = u.account_status === 'deleted' || u.isBlocked === true;
                          if (!isRestricted) return false;
                          if (restrictedFilter === 'blocked') return u.isBlocked === true;
                          if (restrictedFilter === 'deleted') return u.account_status === 'deleted';
                          return true;
                       }).map(u => (
                          <div key={u.id} className="p-4 bg-white dark:bg-[#1E293B] rounded-2xl border border-rose-200 dark:border-rose-900/50">
                             <div className="flex justify-between items-start mb-2">
                               <div>
                                  <p className="font-bold text-slate-900 dark:text-white">{u.displayName}</p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{u.email} • {u.phoneNumber || u.phone || 'No Phone'}</p>
                                  <p className="text-xs text-slate-500 font-mono mb-1">UID: {u.uid}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    IP: {u.last_ip_address || 'N/A'}
                                    {(() => {
                                      const count = duplicateIPCounts[u.last_ip_address!] || 0;
                                      return u.last_ip_address && u.last_ip_address !== 'N/A' && count > 1 ? (
                                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest rounded">
                                          Matched: {count} Accounts
                                        </span>
                                      ) : null;
                                    })()}
                                  </p>
                               </div>
                               <span className="px-2 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-bold">
                                 {u.isBlocked ? 'Blocked' : 'Deleted'}
                               </span>
                             </div>
                             {u.deletion_reason && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 px-2">Reason: {u.deletion_reason}</p>
                             )}
                             <button onClick={() => handleRecoverAccount(u.id || u.uid)} disabled={adminActionLoading} className="mt-4 w-full py-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-xs hover:bg-emerald-200 dark:hover:bg-emerald-900/60 cursor-pointer">Recover Account</button>
                          </div>
                       ))
                    )}
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-6 sm:p-8 space-y-8">
            <div className="flex items-center gap-3 mb-6 transition-colors">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-[#0B3D9E] dark:text-blue-400">
                <Settings className="w-7 h-7" />
              </div>
              <h2 className="font-display text-2xl font-black text-slate-900 dark:text-white uppercase">System Configuration</h2>
            </div>

            <form onSubmit={handleUpdateConfig} className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="md:col-span-2 space-y-4 border-b border-slate-200 dark:border-slate-700/80 pb-8">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">Deposit Methods Status</h3>
                  <div className="flex flex-col sm:flex-row gap-8">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={config.depositBkashEnabled !== false} onChange={e => setConfig({...config, depositBkashEnabled: e.target.checked})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-pink-500"></div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">bKash Enabled</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={config.depositNagadEnabled !== false} onChange={e => setConfig({...config, depositNagadEnabled: e.target.checked})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">Nagad Enabled</span>
                    </label>
                  </div>
               </div>

               <div className="md:col-span-2 space-y-4 border-b border-slate-200 dark:border-slate-700/80 pb-8">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">Withdrawal Methods Status</h3>
                  <div className="flex flex-col sm:flex-row gap-8">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={config.withdrawBkashEnabled !== false} onChange={e => setConfig({...config, withdrawBkashEnabled: e.target.checked})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-pink-500"></div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">bKash Enabled</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={config.withdrawNagadEnabled !== false} onChange={e => setConfig({...config, withdrawNagadEnabled: e.target.checked})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">Nagad Enabled</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={config.withdrawRechargeEnabled !== false} onChange={e => setConfig({...config, withdrawRechargeEnabled: e.target.checked})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-sky-500"></div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">Recharge Enabled</span>
                    </label>
                  </div>
               </div>

               <div className="space-y-4 md:col-span-2">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Global Dashboard Notice</label>
                  <textarea 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] text-slate-900 dark:text-white transition-colors"
                    rows={4}
                    value={config.notice}
                    onChange={e => setConfig({...config, notice: e.target.value})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Min Deposit (BDT)</label>
                  <input 
                    type="number"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.minDeposit}
                    onChange={e => setConfig({...config, minDeposit: Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Min Withdraw (BDT)</label>
                  <input 
                    type="number"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.minWithdraw}
                    onChange={e => setConfig({...config, minWithdraw: Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Withdrawal Fee (%)</label>
                  <input 
                    type="number"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.withdrawalFee}
                    onChange={e => setConfig({...config, withdrawalFee: Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Job Service Charge (%)</label>
                  <input 
                    type="number"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.jobPostingFee}
                    onChange={e => setConfig({...config, jobPostingFee: Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Official bKash Number</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold flex-1 text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                      value={config.bkashNumber || ''}
                      onChange={e => setConfig({...config, bkashNumber: e.target.value})}
                    />
                    <select
                      className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold w-32 text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                      value={config.bkashMethod || 'Personal'}
                      onChange={e => setConfig({...config, bkashMethod: e.target.value})}
                    >
                      <option value="Personal">Personal</option>
                      <option value="Agent">Agent</option>
                      <option value="Merchant">Merchant</option>
                    </select>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Official Nagad Number</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold flex-1 text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                      value={config.nagadNumber || ''}
                      onChange={e => setConfig({...config, nagadNumber: e.target.value})}
                    />
                    <select
                      className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold w-32 text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                      value={config.nagadMethod || 'Personal'}
                      onChange={e => setConfig({...config, nagadMethod: e.target.value})}
                    >
                      <option value="Personal">Personal</option>
                      <option value="Agent">Agent</option>
                      <option value="Merchant">Merchant</option>
                    </select>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Earning to Deposit Fee (%)</label>
                  <input 
                    type="number"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.transferEarningToDepositFee || 0}
                    onChange={e => setConfig({...config, transferEarningToDepositFee: Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Deposit to Earning Fee (%)</label>
                  <input 
                    type="number"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.transferDepositToEarningFee || 0}
                    onChange={e => setConfig({...config, transferDepositToEarningFee: Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Referral Bonus (BDT)</label>
                  <input 
                    type="number"
                    step="0.1"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.referralBonusAmount ?? 5}
                    onChange={e => setConfig({...config, referralBonusAmount: e.target.value === '' ? '' : Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Referral Job Target</label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.referralValidationCriteria ?? 1}
                    onChange={e => setConfig({...config, referralValidationCriteria: e.target.value === '' ? '' : Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Referral Validation Timeframe (Days)</label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.referralValidityDays ?? 30}
                    onChange={e => setConfig({...config, referralValidityDays: e.target.value === '' ? '' : Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Referral Link Domain URL</label>
                  <input 
                    type="text"
                    placeholder="e.g. https://ahtaskpay.com"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.referralDomainUrl || ''}
                    onChange={e => setConfig({...config, referralDomainUrl: e.target.value})}
                  />
               </div>

               <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between">
                     <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Dynamic Referral Campaign</h3>
                     <button
                        type="button"
                        onClick={async () => {
                           if (!confirm('Are you sure you want to reset all referral campaign claims for all users?')) return;
                           try {
                              setAdminActionLoading(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              const token = session?.access_token;
                              if (!token) {
                                 alert('Admin authentication token missing or expired. Please sign in again.');
                                 return;
                              }
                              const res = await fetch('/api/admin/reset-referral-claims', {
                                 method: 'POST',
                                 headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                 }
                              });
                              const json = await res.json();
                              if (!res.ok || json.error) {
                                 alert('Reset failed: ' + (json.error || 'Request failed'));
                              } else {
                                 toast.success('All users referral campaign claims reset successfully!');
                                 alert('All users referral campaign claims reset successfully!');
                              }
                           } catch (err: any) {
                              alert('Reset failed: ' + err.message);
                           } finally {
                              setAdminActionLoading(false);
                           }
                        }}
                        disabled={adminActionLoading}
                        className="px-4 py-2 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50 cursor-pointer"
                     >
                        {adminActionLoading ? 'Resetting...' : 'Reset All User Claims'}
                     </button>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Campaign Start Date</label>
                  <input 
                    type="datetime-local"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.campaignStartDate ? new Date(config.campaignStartDate).toISOString().slice(0, 16) : ''}
                    onChange={e => setConfig({...config, campaignStartDate: e.target.value})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Campaign End Date</label>
                  <input 
                    type="datetime-local"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.campaignEndDate ? new Date(config.campaignEndDate).toISOString().slice(0, 16) : ''}
                    onChange={e => setConfig({...config, campaignEndDate: e.target.value})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Target 1: Req. Referrals</label>
                  <input 
                    type="number"
                    min="0"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.target1Referrals ?? 0}
                    onChange={e => setConfig({...config, target1Referrals: e.target.value === '' ? '' : Number(e.target.value)})}
                  />
               </div>
               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Target 1: Reward (BDT)</label>
                  <input 
                    type="number"
                    min="0"
                    step="0.1"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.target1Reward ?? 0}
                    onChange={e => setConfig({...config, target1Reward: e.target.value === '' ? '' : Number(e.target.value)})}
                  />
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Target 2: Req. Referrals</label>
                  <input 
                    type="number"
                    min="0"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.target2Referrals ?? 0}
                    onChange={e => setConfig({...config, target2Referrals: e.target.value === '' ? '' : Number(e.target.value)})}
                  />
               </div>
               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Target 2: Reward (BDT)</label>
                  <input 
                    type="number"
                    min="0"
                    step="0.1"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.target2Reward ?? 0}
                    onChange={e => setConfig({...config, target2Reward: e.target.value === '' ? '' : Number(e.target.value)})}
                  />
               </div>

               <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700/80">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Login Page Title</label>
                  <input 
                    type="text"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                    value={config.loginTitle || ''}
                    onChange={e => setConfig({...config, loginTitle: e.target.value})}
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mt-2">Use &lt;br&gt; for a new line. Use &lt;span style='color: #FF5733;'&gt;Word&lt;/span&gt; to color a specific word.</span>
               </div>

               <div className="md:col-span-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Login Page Banner Image</label>
                    <span className="text-xs text-[#0B3D9E] dark:text-blue-400 font-bold">No link required</span>
                  </div>
                  
                  {/* Current Image Banner Preview */}
                  {config.loginBannerUrl ? (
                    <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                      <img 
                        src={config.loginBannerUrl} 
                        alt="Current Banner" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 right-3 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, loginBannerUrl: '' })}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                        >
                          Remove Image
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentPresets = config.customBannerPresets || [];
                            if (!currentPresets.includes(config.loginBannerUrl)) {
                                setConfig({ ...config, customBannerPresets: [...currentPresets, config.loginBannerUrl] });
                                toast.success("Saved as preset!");
                            } else {
                                toast.error("Already saved as preset");
                            }
                          }}
                          className="bg-[#0B3D9E] hover:bg-[#07266E] text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                        >
                          Save as Preset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold bg-slate-50/70 dark:bg-slate-800/40 text-sm transition-colors">
                      No banner image selected
                    </div>
                  )}

                  {/* Device Gallery Selection or custom URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <label className="flex flex-col items-center justify-center p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-[#0B3D9E] dark:hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all text-center space-y-2 shadow-sm">
                        <Upload className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400" />
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">Choose from Device Gallery</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">PNG, JPG or GIF up to 3MB</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 3 * 1024 * 1024) {
                                alert("Image is too large. Please select an image under 3MB.");
                                return;
                              }
                              const loadingToast = toast.loading('Uploading image...');
                              try {
                                const fileExt = file.name.split('.').pop();
                                const fileName = `banner_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

                                // Use centralized image compression logic for under 100KB (approx 0.1MB)
                                const base64Data = await compressImage(file, 1920, 0.1);

                                const { data: { session } } = await supabase.auth.getSession();
                                const token = session?.access_token;

                                const res = await fetch('/api/admin/upload-banner', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': token ? `Bearer ${token}` : ''
                                  },
                                  body: JSON.stringify({
                                    fileData: base64Data,
                                    fileName,
                                    mimeType: file.type
                                  })
                                });

                                const json = await res.json();
                                if (!res.ok || json.error) {
                                  throw new Error(json.error || 'Upload failed');
                                }

                                if (json.publicUrl) {
                                  setConfig({ ...config, loginBannerUrl: json.publicUrl });
                                  toast.success('Image uploaded successfully', { id: loadingToast });
                                } else {
                                  throw new Error("Could not get public URL");
                                }
                              } catch (err: any) {
                                console.error('Upload Error:', err);
                                toast.error('Failed to upload image: ' + err.message, { id: loadingToast });
                              }
                            }
                          }}
                        />
                     </label>

                     <div className="flex flex-col justify-center space-y-2 p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm transition-colors">
                        <span className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1">Or enter URL manually</span>
                        <input 
                          type="url"
                          placeholder="https://example.com/banner.jpg"
                          className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:border-[#0B3D9E] outline-none transition-colors"
                          value={config.loginBannerUrl || ''}
                          onChange={e => setConfig({...config, loginBannerUrl: e.target.value})}
                        />
                     </div>
                  </div>

                  {/* Curated Preset Banners Gallery */}
                  <div className="space-y-4 pt-2">
                     <span className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1">My Presets Gallery</span>
                     <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {config.customBannerPresets && config.customBannerPresets.length > 0 ? (
                          config.customBannerPresets.map((presetUrl, idx) => (
                            <div key={idx} className="relative group aspect-video rounded-xl overflow-hidden transition-all hover:scale-105 border-transparent">
                              <button
                                type="button"
                                onClick={() => setConfig({ ...config, loginBannerUrl: presetUrl })}
                                className={cn(
                                  "w-full h-full rounded-xl border-2 overflow-hidden cursor-pointer",
                                  config.loginBannerUrl === presetUrl ? "border-[#0B3D9E] ring-2 ring-[#0B3D9E]/30 dark:border-[#F97316] dark:ring-[#F97316]/30" : "border-transparent"
                                )}
                              >
                                <img src={presetUrl} alt="Preset" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = config.customBannerPresets.filter((p: string) => p !== presetUrl);
                                  setConfig({ ...config, customBannerPresets: updated });
                                  toast.success("Preset removed");
                                }}
                                className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full text-center p-4 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                            No presets saved yet. Upload an image and click "Save as Preset".
                          </div>
                        )}
                     </div>
                  </div>
               </div>

               <div className="md:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Landing Page Stats Control</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">Control how stats are displayed on the landing page</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
                    <button
                      type="button"
                      onClick={() => setConfig({...config, statsMode: 'realtime'})}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${config.statsMode !== 'manual' ? 'bg-[#07266E] dark:bg-[#F97316] shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      Real-time
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({...config, statsMode: 'manual'})}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${config.statsMode === 'manual' ? 'bg-[#07266E] dark:bg-[#F97316] shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      Manual Override
                    </button>
                  </div>

                  {config.statsMode === 'manual' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700/80">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Manual Total Users</label>
                        <input 
                          type="number"
                          className="w-full p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E]"
                          value={config.manualTotalUsers || 0}
                          onChange={e => setConfig({...config, manualTotalUsers: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Manual Total Jobs</label>
                        <input 
                          type="number"
                          className="w-full p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E]"
                          value={config.manualTotalJobs || 0}
                          onChange={e => setConfig({...config, manualTotalJobs: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Manual Completed Tasks</label>
                        <input 
                          type="number"
                          className="w-full p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E]"
                          value={config.manualCompletedTasks || 0}
                          onChange={e => setConfig({...config, manualCompletedTasks: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Manual Total Withdraw</label>
                        <input 
                          type="number"
                          className="w-full p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-[#0B3D9E]"
                          value={config.manualTotalWithdraw || 0}
                          onChange={e => setConfig({...config, manualTotalWithdraw: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                  )}
               </div>

               <div className="md:col-span-2 pt-4 space-y-4">
                  <button disabled={savingConfig} type="submit" className="w-full py-4 bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] hover:opacity-95 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-50 cursor-pointer">
                     {savingConfig ? 'Saving...' : 'Save System Settings'}
                  </button>
               </div>
            </form>

            {/* Deposit Rules Settings Section */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-6 mt-8 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-50 dark:bg-orange-950/50 text-[#F97316] dark:text-[#FB923C] rounded-2xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Deposit Rules Settings</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Dynamic instructions shown to users when adding liquidity</p>
                </div>
              </div>

              {depositRulesSuccessMsg && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 text-emerald-800 dark:text-emerald-300 rounded-xl font-semibold text-sm animate-fadeIn animate-duration-300">
                  {depositRulesSuccessMsg}
                </div>
              )}

              {depositRulesErrorMsg && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 text-rose-800 dark:text-rose-300 rounded-xl font-semibold text-sm animate-fadeIn animate-duration-300">
                  {depositRulesErrorMsg}
                </div>
              )}

              <form onSubmit={handleUpdateDepositRules} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Deposit Rules (Instructions)</label>
                  <textarea
                    rows={6}
                    required
                    placeholder="উক্ত নাম্বারে টাকা পাঠিয়ে সেন্ডার নাম্বার, টাকার পরিমান ও ট্রানজেকশন আইডি দিন। ভুয়া রিকোয়েস্ট দিলে একাউন্ট ব্লক করা হবে।"
                    className="w-full p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl font-extrabold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-[#0B3D9E] transition-all text-sm leading-relaxed"
                    value={depositRules}
                    onChange={(e) => setDepositRules(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={depositRulesLoading}
                  className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {depositRulesLoading ? 'Saving...' : 'Save Deposit Rules'}
                </button>
              </form>
            </div>

            {/* Withdraw Rules Settings Section */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-6 mt-8 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-50 dark:bg-orange-950/50 text-[#F97316] dark:text-[#FB923C] rounded-2xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Withdraw Rules Settings</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Dynamic instructions shown to users when exiting capital</p>
                </div>
              </div>

              {withdrawRulesSuccessMsg && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 text-emerald-800 dark:text-emerald-300 rounded-xl font-semibold text-sm animate-fadeIn animate-duration-300">
                  {withdrawRulesSuccessMsg}
                </div>
              )}

              {withdrawRulesErrorMsg && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 text-rose-800 dark:text-rose-300 rounded-xl font-semibold text-sm animate-fadeIn animate-duration-300">
                  {withdrawRulesErrorMsg}
                </div>
              )}

              <form onSubmit={handleUpdateWithdrawRules} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Withdraw Rules (Instructions)</label>
                  <textarea
                    rows={6}
                    required
                    placeholder="নম্বরটি ভালোভাবে চেক করুন। ভুল নম্বরে টাকা গেলে কর্তৃপক্ষ দায়ী নয়। পেমেন্ট সম্পন্ন হতে ১-২৪ ঘণ্টা সময় লাগতে পারে।"
                    className="w-full p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl font-extrabold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-[#0B3D9E] transition-all text-sm leading-relaxed"
                    value={withdrawRules}
                    onChange={(e) => setWithdrawRules(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={withdrawRulesLoading}
                  className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {withdrawRulesLoading ? 'Saving...' : 'Save Withdraw Rules'}
                </button>
              </form>
            </div>

            {/* Ad Post Rules Settings Section */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-6 mt-8 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ad Post Rules Settings</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Dynamic instructions shown to users when posting an advertisement</p>
                </div>
              </div>

              {adPostRulesSuccessMsg && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 text-emerald-800 dark:text-emerald-300 rounded-xl font-semibold text-sm animate-fadeIn animate-duration-300">
                  {adPostRulesSuccessMsg}
                </div>
              )}

              {adPostRulesErrorMsg && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 text-rose-800 dark:text-rose-300 rounded-xl font-semibold text-sm animate-fadeIn animate-duration-300">
                  {adPostRulesErrorMsg}
                </div>
              )}

              <form onSubmit={handleUpdateAdPostRules} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Ad Post Rules (Instructions)</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="সতর্কতা: আপনি অ্যাড পোস্ট করার পর যদি আবার অ্যাড ডিলিট করেন, তাহলে কোনো রিফান্ড পাবেন না।"
                    className="w-full p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl font-extrabold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-rose-500 transition-all text-sm leading-relaxed"
                    value={adPostRules}
                    onChange={(e) => setAdPostRules(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={adPostRulesLoading}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {adPostRulesLoading ? 'Saving...' : 'Save Ad Post Rules'}
                </button>
              </form>
            </div>

            {isSuperAdmin && (
              <div className="mt-12 p-8 border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-[2.5rem] space-y-6 transition-colors">
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                  <Unlock className="w-8 h-8" />
                  <h2 className="font-display text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Super Admin Override</h2>
                </div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                  You are logged in as the master system administrator. This gives you complete control over the system, bypassing standard constraints.
                </p>
                <div className="flex flex-col md:flex-row gap-4">
                   <button 
                     onClick={() => alert('Super tools coming soon!')}
                     className="px-6 py-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 shadow-sm text-slate-900 dark:text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition-all cursor-pointer"
                   >
                     <Settings className="w-4 h-4" /> System Reset Override
                   </button>
                </div>
              </div>
            )}
          </div>
        )}

        {['transactions', 'users', 'jobs', 'submissions', 'tickets', 'ads', 'deletions'].includes(activeTab) && totalItems > 0 && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/30 transition-colors">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              Showing <span className="font-black text-slate-900 dark:text-white">{Math.min((currentPage - 1) * 20 + 1, totalItems)}</span> to{' '}
              <span className="font-black text-slate-900 dark:text-white">{Math.min(currentPage * 20, totalItems)}</span> of{' '}
              <span className="font-black text-slate-900 dark:text-white">{totalItems}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (currentPage > 1) {
                    fetchAdminData(false, false, activeTab, currentPage - 1);
                  }
                }}
                disabled={currentPage === 1 || tabLoading}
                className="px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="text-xs font-black text-slate-400 dark:text-slate-500 px-2 tabular-nums">
                Page {currentPage} of {Math.max(1, Math.ceil(totalItems / 20))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (currentPage < Math.ceil(totalItems / 20)) {
                    fetchAdminData(false, false, activeTab, currentPage + 1);
                  }
                }}
                disabled={currentPage >= Math.ceil(totalItems / 20) || tabLoading}
                className="px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {blockConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 transition-colors">
            <div className="flex items-center gap-4 text-rose-600 dark:text-rose-400">
              <div className="bg-rose-100 dark:bg-rose-950/60 p-3 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="font-display text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Block User</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                Are you sure you want to block <strong>{blockConfirmUser.displayName || 'this user'}</strong>? 
                This action requires administrative confirmation.
              </p>
              
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Admin Password</label>
                <input 
                  type="password"
                  placeholder="Enter admin password"
                  value={blockPassword}
                  onChange={(e) => setBlockPassword(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setBlockConfirmUser(null);
                  setBlockPassword('');
                }}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={confirmBlockUser}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 my-8 text-left transition-colors">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700/80 pb-4">
              <div className="bg-blue-50 dark:bg-blue-950/60 text-[#0B3D9E] dark:text-blue-400 p-3 rounded-2xl">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">ব্যবহারকারীর তথ্য পরিবর্তন করুন</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider">
                  User: {editingUser.displayName || 'No Name'} (#{editingUser.serialNumber || editingUser.uid.slice(0, 6).toUpperCase()})
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {!supabaseServiceRoleReady && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 space-y-2 text-xs font-semibold">
                  <p className="font-extrabold flex items-center gap-1.5 text-amber-950 dark:text-amber-100 uppercase tracking-wide">
                    ⚠️ সার্ভিস রোল কী সেটিংস করা নেই (SUPABASE_SERVICE_ROLE_KEY is missing)
                  </p>
                  <p className="leading-relaxed text-amber-800 dark:text-amber-300 font-semibold">
                    ব্যবহারকারীর ইমেইল ও পাসওয়ার্ড পরিবর্তন করতে হলে আপনার <strong>AI Studio-র Settings ➜ Secrets</strong> এ গিয়ে <strong>SUPABASE_SERVICE_ROLE_KEY</strong> ভ্যালুটি যুক্ত করতে হবে। এটি যুক্ত করা না থাকলে পাসওয়ার্ড বা ইমেইল ডাটাবেজে সেভ হবে না এবং নতুন পাসওয়ার্ডে লগইন কাজ করবে না।
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">নাম (Display Name)</label>
                <input
                  type="text"
                  placeholder="ব্যবহারকারীর পুরো নাম লিখুন"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] text-slate-900 dark:text-white transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">ইউজারনেম (Username)</label>
                <input
                  type="text"
                  placeholder="ইউনিক ইউজারনেম"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] text-slate-900 dark:text-white transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">ইমেইল (Email Address)</label>
                <input
                  type="email"
                  placeholder="ইমেইল এড্রেস"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] text-slate-900 dark:text-white transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">ফোন নম্বর (Phone Number)</label>
                <input
                  type="text"
                  placeholder="যেমন: +8801XXXXXXXXX"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] text-slate-900 dark:text-white transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Last Known IP (আইপি অ্যাড্রেস)</label>
                <input
                  type="text"
                  value={editingUser.last_ip_address || 'Not Recorded Yet'}
                  disabled
                  readOnly
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none text-slate-500 dark:text-slate-400 opacity-80 cursor-not-allowed transition-colors"
                />
              </div>

              <div className="space-y-1.5 p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/60 transition-colors">
                <label className="text-[10px] font-black text-[#0B3D9E] dark:text-blue-400 uppercase tracking-widest block mb-1">নতুন পাসওয়ার্ড সেট করুন (New Password)</label>
                <input
                  type="text"
                  placeholder="নতুন পাসওয়ার্ড লিখুন (কমপক্ষে ৬ অক্ষর)"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-blue-200 dark:border-blue-800/60 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#0B3D9E]/30 text-[#07266E] dark:text-blue-100"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                  পাসওয়ার্ড পরিবর্তন করতে চাইলে এখানে নতুন পাসওয়ার্ড লিখুন। পরিবর্তন না করতে চাইলে খালি রাখুন।
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={handleAdminImpersonate}
                className="w-full py-3.5 border-2 border-[#0B3D9E] text-[#0B3D9E] dark:border-blue-400 dark:text-blue-400 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                disabled={editSubmitLoading || impersonateLoading}
              >
                 {impersonateLoading ? (
                   <span className="w-4 h-4 border-2 border-[#0B3D9E] dark:border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                 ) : null}
                 {impersonateLoading ? 'Loading...' : 'Login As User (Support Mode)'}
              </button>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs cursor-pointer"
                  disabled={editSubmitLoading}
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleSaveUserDetails}
                  className="flex-1 py-3.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black uppercase tracking-widest transition-all text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  disabled={editSubmitLoading || impersonateLoading}
                >
                  {editSubmitLoading && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  সংরক্ষণ করুন (Save Changes)
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDeleteUserConfirmUser(editingUser)}
                className="w-full py-3.5 mt-2 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl font-black uppercase tracking-widest hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-all text-xs border border-rose-200 dark:border-rose-800/60 cursor-pointer"
              >
                Delete Account (একাউন্ট ডিলিট)
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUserConfirmUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl space-y-6">
            <h3 className="font-display text-xl font-black text-slate-900 dark:text-white">একাউন্ট ডিলিট নিশ্চিত করুন</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
              আপনি {deleteUserConfirmUser.displayName || 'এই ব্যবহারকারী'}-এর একাউন্ট পার্মানেন্টলি ডিলিট করতে যাচ্ছেন। অনুগ্রহ করে এডমিন পাসওয়ার্ড দিন।
            </p>
            <input
              type="password"
              placeholder="Enter delete password"
              value={deleteUserPassword}
              onChange={(e) => setDeleteUserPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
            />
            <div className="flex gap-4">
              <button
                onClick={() => { setDeleteUserConfirmUser(null); setDeleteUserPassword(''); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs cursor-pointer"
              >
                বাতিল
              </button>
              <button
                onClick={handleForceDeleteUser}
                disabled={adminActionLoading}
                className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all text-xs shadow-lg cursor-pointer"
              >
                {adminActionLoading ? 'লোড হচ্ছে...' : 'ডিলিট করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteAdConfirm}
        title="Delete Advertisement"
        message="Are you sure you want to delete this ad? It will NOT refund the user."
        onConfirm={executeDeleteAdAdmin}
        onCancel={() => setDeleteAdConfirm(null)}
        confirmText="Delete Ad"
      />

      <ConfirmModal
        isOpen={!!deleteJobConfirm}
        title="Delete Job"
        message="Are you sure you want to completely delete this job? This action cannot be undone."
        onConfirm={executeDeleteJob}
        onCancel={() => setDeleteJobConfirm(null)}
        confirmText="Delete Job"
      />

      {/* Reject Modal */}
      {rejectingSub && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-4">Reject Proof</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">Enter the reason for rejection:</p>
            
            <input
              type="text"
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white mb-6"
              placeholder="e.g. Invalid screenshot, incomplete task..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRejectSubmission();
                if (e.key === 'Escape') {
                  setRejectingSub(null);
                  setRejectReason('');
                }
              }}
            />

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setRejectingSub(null);
                  setRejectReason('');
                }}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRejectSubmission}
                className="flex-1 py-3.5 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all text-xs shadow-lg cursor-pointer"
              >
                Reject Proof
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
