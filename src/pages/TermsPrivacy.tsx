import React from 'react';
import { Shield, Book, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TermsPrivacy() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-12 pb-20">
      
      <div className="flex items-center gap-4 border-b border-gray-200 pb-6">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Terms & Privacy Policy</h1>
          <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-xs">Read carefully before continuing</p>
        </div>
      </div>

      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 space-y-8">
        <div className="flex items-center gap-3 text-indigo-600">
          <Book className="w-8 h-8" />
          <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">1. শর্ত ও নিয়মাবলী (Terms and Conditions)</h2>
        </div>
        
        <div className="space-y-6 text-gray-600 font-medium leading-relaxed">
          <div>
            <h3 className="text-gray-900 font-bold mb-2 uppercase tracking-wide text-sm">অ্যাকাউন্ট তৈরি</h3>
            <p>প্রতিটি ইউজারের জন্য কেবল একটি অ্যাকাউন্ট খোলার অনুমতি রয়েছে। একাধিক অ্যাকাউন্ট তৈরি করা, ভিপিএন (VPN) ব্যবহার করা বা ফেক তথ্য দিলে অ্যাকাউন্ট স্থায়ীভাবে ব্লক করা হবে।</p>
          </div>
          <div>
            <h3 className="text-gray-900 font-bold mb-2 uppercase tracking-wide text-sm">কাজের সততা (Worker Rules)</h3>
            <p>ওয়ার্কারদের অবশ্যই বায়ারের দেওয়া নিয়ম অনুযায়ী সঠিক কাজ সম্পন্ন করতে হবে। কোনো প্রকার ভুয়ো বা এডিট করা স্ক্রিনশট (Fake Proof) জমা দিলে কোনো নোটিশ ছাড়াই আপনার অ্যাকাউন্টটি বাতিল এবং অর্জিত ব্যালেন্স বাজেয়াপ্ত করা হবে।</p>
          </div>
          <div>
            <h3 className="text-gray-900 font-bold mb-2 uppercase tracking-wide text-sm">জব পোস্ট করার নিয়ম (Buyer Rules)</h3>
            <p>বায়াররা কোনো অবৈধ, জুয়া, পর্নোগ্রাফি বা প্রতারণামূলক কাজ পোস্ট করতে পারবেন না। পদের সংখ্যা (Slots) পূর্ণ হওয়া বা রিজেক্ট হওয়ার বিষয়টি সিস্টেমের নির্দিষ্ট নিয়ম অনুযায়ী স্বয়ংক্রিয়ভাবে পরিচালিত হবে।</p>
          </div>
          <div>
            <h3 className="text-gray-900 font-bold mb-2 uppercase tracking-wide text-sm">তহবিল ও পেমেন্ট</h3>
            <p>সাইটের নিয়ম ভঙ্গ করলে বা কোনো জালিয়াতি প্রমাণিত হলে অ্যাডমিন যেকোনো অ্যাকাউন্টের পেমেন্ট আটকে রাখার বা অ্যাকাউন্ট বাতিল করার পূর্ণ অধিকার রাখে।</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 space-y-8">
        <div className="flex items-center gap-3 text-green-600">
          <Shield className="w-8 h-8" />
          <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">2. গোপনীয়তা নীতি (Privacy Policy)</h2>
        </div>
        
        <div className="space-y-6 text-gray-600 font-medium leading-relaxed">
          <div>
            <h3 className="text-gray-900 font-bold mb-2 uppercase tracking-wide text-sm">তথ্য সংগ্রহ</h3>
            <p>আমাদের ওয়েবসাইটে রেজিস্ট্রেশন এবং কাজ করার সুবিধার্থে আমরা আপনার নাম, ইমেল এড্রেস, মোবাইল ব্যাংকিং নম্বর (বিকাশ/নগদ) এবং কাজের প্রমাণ হিসেবে জমা দেওয়া স্ক্রিনশট বা তথ্য সংগ্রহ করে থাকি।</p>
          </div>
          <div>
            <h3 className="text-gray-900 font-bold mb-2 uppercase tracking-wide text-sm">তথ্যের ব্যবহার</h3>
            <p>সংগৃহীত তথ্যগুলো শুধুমাত্র আপনার উইথড্র বা ডিপোজিট প্রসেস করতে, কাজের সত্যতা যাচাই করতে এবং আপনার অ্যাকাউন্টের নিরাপত্তা নিশ্চিত করার উদ্দেশ্যে ব্যবহার করা হয়।</p>
          </div>
          <div>
            <h3 className="text-gray-900 font-bold mb-2 uppercase tracking-wide text-sm">তথ্য সুরক্ষা</h3>
            <p>আমরা আপনার কোনো ব্যক্তিগত তথ্য বা পেমেন্ট ডিটেইলস কোনো তৃতীয় পক্ষের কাছে বিক্রি, লিক বা শেয়ার করি না। আপনার সমস্ত ডাটা আমাদের সার্ভারে সম্পূর্ণ সুরক্ষিত ও গোপনীয় রাখা হয়।</p>
          </div>
        </div>
      </section>

    </div>
  );
}
