import { useEffect } from 'react';
import { Shield, Book, ArrowLeft, Sun, Moon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { BrandLogo } from '../components/BrandLogo';

export function TermsPrivacy() {
  const { theme, toggleTheme } = useTheme();
  const { hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [hash]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#EFF4FC] dark:bg-[#040C24] transition-colors pb-20">
      {/* Royal Blue Header Banner */}
      <div className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-white border-b border-white/10 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-colors text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-extrabold text-white font-display tracking-tight">Terms & Privacy Policy</h1>
              <p className="text-blue-200 font-semibold mt-0.5 uppercase tracking-widest text-[11px]">Read carefully before continuing</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/15 transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4 text-blue-100" /> : <Sun className="w-4 h-4 text-[#FB923C]" />}
            </button>
            <Link to="/" className="hidden sm:block">
              <BrandLogo size="sm" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto pt-8 px-4 sm:px-6 space-y-8">
        <section id="terms" className="bg-white dark:bg-[#0A1638] rounded-[2rem] p-7 sm:p-9 shadow-sm shadow-blue-950/[0.04] border border-[#D7E3F7] dark:border-[#1C3882]/55 space-y-8 transition-colors scroll-mt-6">
          <div className="flex items-center gap-3 text-[#0B3D9E] dark:text-[#FB923C]">
            <div className="w-11 h-11 rounded-2xl bg-[#EFF4FC] dark:bg-[#102255] border border-[#DCE7FA] dark:border-[#1C3882]/60 flex items-center justify-center">
              <Book className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#071845] dark:text-white font-display">1. শর্ত ও নিয়মাবলী (Terms and Conditions)</h2>
          </div>
          
          <div className="space-y-6 text-slate-600 dark:text-blue-100/80 font-medium leading-relaxed">
            <div className="p-5 rounded-2xl bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60">
              <h3 className="text-[#07266E] dark:text-[#FB923C] font-bold mb-2 uppercase tracking-wide text-sm">অ্যাকাউন্ট তৈরি</h3>
              <p>প্রতিটি ইউজারের জন্য কেবল একটি অ্যাকাউন্ট খোলার অনুমতি রয়েছে। একাধিক অ্যাকাউন্ট তৈরি করা, ভিপিএন (VPN) ব্যবহার করা বা ফেক তথ্য দিলে অ্যাকাউন্ট স্থায়ীভাবে ব্লক করা হবে।</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60">
              <h3 className="text-[#07266E] dark:text-[#FB923C] font-bold mb-2 uppercase tracking-wide text-sm">কাজের সততা (Worker Rules)</h3>
              <p>ওয়ার্কারদের অবশ্যই বায়ারের দেওয়া নিয়ম অনুযায়ী সঠিক কাজ সম্পন্ন করতে হবে। কোনো প্রকার ভুয়ো বা এডিট করা স্ক্রিনশট (Fake Proof) জমা দিলে কোনো নোটিশ ছাড়াই আপনার অ্যাকাউন্টটি বাতিল এবং অর্জিত ব্যালেন্স বাজেয়াপ্ত করা হবে।</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60">
              <h3 className="text-[#07266E] dark:text-[#FB923C] font-bold mb-2 uppercase tracking-wide text-sm">জব পোস্ট করার নিয়ম (Buyer Rules)</h3>
              <p>বায়াররা কোনো অবৈধ, জুয়া, পর্নোগ্রাফি বা প্রতারণামূলক কাজ পোস্ট করতে পারবেন না। পদের সংখ্যা (Slots) পূর্ণ হওয়া বা রিজেক্ট হওয়ার বিষয়টি সিস্টেমের নির্দিষ্ট নিয়ম অনুযায়ী স্বয়ংক্রিয়ভাবে পরিচালিত হবে।</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60">
              <h3 className="text-[#07266E] dark:text-[#FB923C] font-bold mb-2 uppercase tracking-wide text-sm">তহবিল ও পেমেন্ট</h3>
              <p>সাইটের নিয়ম ভঙ্গ করলে বা কোনো জালিয়াতি প্রমাণিত হলে অ্যাডমিন যেকোনো অ্যাকাউন্টের পেমেন্ট আটকে রাখার বা অ্যাকাউন্ট বাতিল করার পূর্ণ অধিকার রাখে।</p>
            </div>
          </div>
        </section>

        <section id="privacy" className="bg-white dark:bg-[#0A1638] rounded-[2rem] p-7 sm:p-9 shadow-sm shadow-blue-950/[0.04] border border-[#D7E3F7] dark:border-[#1C3882]/55 space-y-8 transition-colors scroll-mt-6">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#071845] dark:text-white font-display">2. গোপনীয়তা নীতি (Privacy Policy)</h2>
          </div>
          
          <div className="space-y-6 text-slate-600 dark:text-blue-100/80 font-medium leading-relaxed">
            <div className="p-5 rounded-2xl bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60">
              <h3 className="text-emerald-700 dark:text-emerald-400 font-bold mb-2 uppercase tracking-wide text-sm">তথ্য সংগ্রহ</h3>
              <p>আমাদের ওয়েবসাইটে রেজিস্ট্রেশন এবং কাজ করার সুবিধার্থে আমরা আপনার নাম, ইমেল এড্রেস, মোবাইল ব্যাংকিং নম্বর (বিকাশ/নগদ) এবং কাজের প্রমাণ হিসেবে জমা দেওয়া স্ক্রিনশট বা তথ্য সংগ্রহ করে থাকি।</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60">
              <h3 className="text-emerald-700 dark:text-emerald-400 font-bold mb-2 uppercase tracking-wide text-sm">তথ্যের ব্যবহার</h3>
              <p>সংগৃহীত তথ্যগুলো শুধুমাত্র আপনার উইথড্র বা ডিপোজিট প্রসেস করতে, কাজের সত্যতা যাচাই করতে এবং আপনার অ্যাকাউন্টের নিরাপত্তা নিশ্চিত করার উদ্দেশ্যে ব্যবহার করা হয়।</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60">
              <h3 className="text-emerald-700 dark:text-emerald-400 font-bold mb-2 uppercase tracking-wide text-sm">তথ্য সুরক্ষা</h3>
              <p>আমরা আপনার কোনো ব্যক্তিগত তথ্য বা পেমেন্ট ডিটেইলস কোনো তৃতীয় পক্ষের কাছে বিক্রি, লিক বা শেয়ার করি না। আপনার সমস্ত ডাটা আমাদের সার্ভারে সম্পূর্ণ সুরক্ষিত ও গোপনীয় রাখা হয়।</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
