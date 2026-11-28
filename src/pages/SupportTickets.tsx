import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Ticket } from '../types';
import { LifeBuoy, PlusCircle, AlertCircle, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

export function SupportTickets() {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchTickets = async () => {
    if (!user) return;
    try {
      const { data: snap, error } = await supabase.from('tickets')
        .select('*')
        .eq('userId', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tickets:', error);
      } else if (snap) {
        setTickets(snap as unknown as Ticket[]);
      }
    } catch (err) {
      console.error('Unexpected error fetching tickets:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
    if (!user) return;

    // Real-time listener for ticket updates
    const channel = supabase.channel(`public:tickets:user_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `user_id=eq.${user.id}` },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setSubmitting(true);
    const newTicket = {
      userId: user.id,
      userSerial: profile?.serialNumber || null,
      subject,
      status: 'open',
      replies: [{ sender: 'user', text: description, createdAt: Date.now() }],
      createdAt: new Date().toISOString()
    };
    
    // Optimistic UI Update
    setTickets([{ ...newTicket, id: 'temp-' + Date.now() } as unknown as Ticket, ...tickets]);
    
    try {
      await supabase.from('tickets').insert(newTicket);
      setIsFormOpen(false);
      setSubject('');
      setDescription('');
      fetchTickets(); // Refetch to get actual IDs
    } catch (error) {
      console.error(error);
      alert('Failed to submit ticket');
      fetchTickets(); // Revert optimistic update
    }
    setSubmitting(false);
  };


  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTickets = tickets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 w-full">
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2rem] p-6 sm:p-8 text-white border border-blue-400/20 shadow-xl shadow-blue-950/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 border border-white/15 p-3.5 rounded-2xl text-[#FB923C]">
            <LifeBuoy className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">Support Tickets</h1>
            <p className="text-blue-100 font-medium text-sm mt-0.5">Need help? Open a new ticket.</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="px-6 py-3.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/25 shrink-0"
        >
          {isFormOpen ? 'Cancel' : <><PlusCircle className="w-4 h-4" /> New Ticket</>}
        </button>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-white dark:bg-[#0A1638] p-6 sm:p-8 rounded-[2.5rem] shadow-sm shadow-blue-950/[0.04] border border-[#D7E3F7] dark:border-[#1C3882]/55 mb-8 space-y-6 block transition-colors">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 ml-1 uppercase tracking-widest">Subject line</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. My submission was unfairly rejected"
                  className="w-full px-5 py-4 border border-[#CEDDF6] dark:border-[#1E3B8A]/65 bg-[#F4F7FE] dark:bg-[#050F2B] text-[#071845] dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] placeholder:text-slate-400 dark:placeholder:text-blue-200/40 transition-all"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 ml-1 uppercase tracking-widest">Detailed description</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Provide any details such as Job ID, etc..."
                  className="w-full px-5 py-4 border border-[#CEDDF6] dark:border-[#1E3B8A]/65 bg-[#F4F7FE] dark:bg-[#050F2B] text-[#071845] dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] resize-none placeholder:text-slate-400 dark:placeholder:text-blue-200/40 transition-all"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <button 
                disabled={submitting}
                className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all"
              >
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="bg-white dark:bg-[#0A1638] p-12 rounded-[2.5rem] border border-dashed border-[#D7E3F7] dark:border-[#1C3882]/55 text-center text-slate-500 dark:text-blue-200/70 font-bold italic">
            You haven't opened any tickets yet.
          </div>
        ) : (
          paginatedTickets.map(ticket => (
            <div key={ticket.id} className="bg-white dark:bg-[#0A1638] p-6 sm:p-8 rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-4 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-[#071845] dark:text-white leading-tight">{ticket.subject}</h3>
                  <p className="text-xs text-slate-500 dark:text-blue-200/70 font-bold uppercase tracking-widest">Submitted: {ticket.createdAt ? new Date(ticket.createdAt as any).toLocaleString() : ''}</p>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest self-start",
                  ticket.status === 'resolved' ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                )}>
                  {ticket.status === 'resolved' ? 'Resolved' : 'Open'}
                </div>
              </div>

              <div className="bg-[#F2F6FE] dark:bg-[#050F2B] p-4 rounded-2xl text-[#071845] dark:text-blue-100 text-sm border border-[#DCE7FA] dark:border-[#1C3882]/60">
                {Array.isArray(ticket.replies) && ticket.replies.length > 0 ? ticket.replies[0].text : 'No description'}
              </div>

              {Array.isArray(ticket.replies) && ticket.replies.length > 1 && (
                <div className="mt-4 space-y-3">
                  {ticket.replies.slice(1).map((reply: any, i: number) => (
                    <div key={i} className={cn(
                      "p-4 rounded-2xl text-sm font-medium",
                      reply.sender === 'admin'
                        ? "bg-[#EFF4FC] dark:bg-[#102255] border border-[#B6CCF4] dark:border-[#2C4DA3] text-[#071845] dark:text-blue-100 mr-6 sm:mr-10"
                        : "bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 text-[#071845] dark:text-blue-100 ml-6 sm:ml-10"
                    )}>
                       <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest mb-1 text-[#0B3D9E] dark:text-[#FB923C]">
                          {reply.sender === 'admin' ? <><MessageSquare className="w-3 h-3" /> Admin</> : 'You'}
                       </div>
                       {reply.text}
                    </div>
                  ))}
                </div>
              )}

              {ticket.adminReply && (!Array.isArray(ticket.replies) || ticket.replies.length === 0) && (
                <div className="bg-[#EFF4FC] dark:bg-[#102255] border border-[#B6CCF4] dark:border-[#2C4DA3] p-4 rounded-2xl mt-4 mr-6 sm:mr-10">
                  <div className="flex items-center gap-2 text-[#0B3D9E] dark:text-[#FB923C] font-black text-[10px] uppercase tracking-widest mb-2">
                    <MessageSquare className="w-3 h-3" /> Admin Reply
                  </div>
                  <p className="text-[#071845] dark:text-blue-100 text-sm font-medium">{ticket.adminReply}</p>
                </div>
              )}
              
              {ticket.status !== 'resolved' && (
                <ReplyBox ticketId={ticket.id} onOptimisticReply={(reply) => {
                  setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, replies: [...(t.replies || []), reply] } : t));
                }} />
              )}
            </div>
          ))
        )}
      </div>

      {tickets.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={tickets.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="tickets"
        />
      )}
    </div>
  );
}

const ReplyBox = ({ ticketId, onOptimisticReply }: { ticketId: string, onOptimisticReply: (reply: any) => void }) => {
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;
    setSending(true);
    
    const reply: { sender: 'user' | 'admin'; text: string; createdAt: number } = {
      sender: 'user',
      text: replyMessage.trim(),
      createdAt: Date.now()
    };
    
    // Optimistic UI Update
    onOptimisticReply(reply);
    const msg = replyMessage.trim();
    setReplyMessage('');

    try {
      const snap = await supabase.from('tickets').select('*').eq('id', ticketId).single();
      if (snap.data) {
        const ticket = snap.data as unknown as Ticket;
        let parsedReplies = ticket.replies;
        if (typeof parsedReplies === 'string') {
          try { parsedReplies = JSON.parse(parsedReplies); } catch (e) { parsedReplies = []; }
        }
        const newReplies = Array.isArray(parsedReplies) ? [...parsedReplies] : [];
        newReplies.push(reply);
        await supabase.from('tickets').update({ replies: newReplies }).eq('id', ticketId);
      }
    } catch (err) {
      console.error(err);
    }
    setSending(false);
  };
  return (
    <form onSubmit={handleSend} className="mt-4 flex gap-2">
      <input 
        type="text" 
        value={replyMessage}
        onChange={e => setReplyMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 px-4 py-3 border border-[#CEDDF6] dark:border-[#1E3B8A]/65 bg-[#F4F7FE] dark:bg-[#050F2B] text-[#071845] dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] text-sm placeholder:text-slate-400 dark:placeholder:text-blue-200/40 transition-all"
      />
      <button 
        disabled={sending || !replyMessage.trim()}
        className="px-5 py-3 bg-[#07266E] hover:bg-[#0B3D9E] text-white rounded-xl disabled:opacity-50 transition-all flex items-center justify-center shadow-md"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
