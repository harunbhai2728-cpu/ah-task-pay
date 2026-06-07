import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Ticket } from '../types';
import { LifeBuoy, PlusCircle, AlertCircle, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function SupportTickets() {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    if (!user) return;
    try {
      const { data: snap } = await supabase.from('tickets')
        .select('*')
        .eq('userId', user.id)
        .order('createdAt', { ascending: false });

      if (snap) setTickets(snap as unknown as Ticket[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setSubmitting(true);
    try {
      await supabase.from('tickets').insert({
        userId: user.id,
        userName: profile?.displayName || 'User',
        userSerial: profile?.serialNumber || null,
        subject,
        description,
        status: 'open',
        createdAt: new Date().toISOString()
      });
      setIsFormOpen(false);
      setSubject('');
      setDescription('');
      fetchTickets();
      alert('Ticket submitted successfully! We will get back to you soon.');
    } catch (error) {
      console.error(error);
      alert('Failed to submit ticket');
    }
    setSubmitting(false);
  };


  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 w-full px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl text-white">
            <LifeBuoy className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Support Tickets</h1>
            <p className="text-gray-500 font-medium">Need help? Open a new ticket.</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-xl"
        >
          {isFormOpen ? 'Cancel' : <><PlusCircle className="w-5 h-5" /> New Ticket</>}
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
            <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl border border-blue-100 mb-8 space-y-6 block">
              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 ml-1 uppercase tracking-widest">Subject line</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. My submission was unfairly rejected"
                  className="w-full px-5 py-4 border border-gray-200 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 ml-1 uppercase tracking-widest">Detailed description</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Provide any details such as Job ID, etc..."
                  className="w-full px-5 py-4 border border-gray-200 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <button 
                disabled={submitting}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="bg-white p-12 rounded-[3rem] border border-dashed border-gray-200 text-center text-gray-400 font-bold italic">
            You haven't opened any tickets yet.
          </div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.id} className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">{ticket.subject}</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Submitted: {ticket.createdAt ? new Date(ticket.createdAt as any).toLocaleString() : ''}</p>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest self-start",
                  ticket.status === 'resolved' ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
                )}>
                  {ticket.status === 'resolved' ? 'Resolved' : 'Open'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl text-gray-700 text-sm">
                {ticket.description}
              </div>

              {ticket.replies && ticket.replies.length > 0 && (
                <div className="mt-4 space-y-3">
                  {ticket.replies.map((reply, i) => (
                    <div key={i} className={cn(
                      "p-4 rounded-xl text-sm font-medium",
                      reply.sender === 'admin' ? "bg-blue-50 border border-blue-100 mr-8" : "bg-gray-100 border border-gray-200 ml-8"
                    )}>
                       <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest mb-1 opacity-50">
                          {reply.sender === 'admin' ? <><MessageSquare className="w-3 h-3" /> Admin</> : 'You'}
                       </div>
                       {reply.text}
                    </div>
                  ))}
                </div>
              )}

              {ticket.adminReply && (!ticket.replies || ticket.replies.length === 0) && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mt-4 mr-8">
                  <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest mb-2">
                    <MessageSquare className="w-3 h-3" /> Admin Reply
                  </div>
                  <p className="text-gray-800 text-sm font-medium">{ticket.adminReply}</p>
                </div>
              )}
              
              {ticket.status !== 'resolved' && (
                <ReplyBox ticketId={ticket.id} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const ReplyBox = ({ ticketId }: { ticketId: string }) => {
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;
    setSending(true);
    try {
      const snap = await supabase.from('tickets').select('*').eq('id', ticketId).single();
      if (snap.data) {
        const ticket = snap.data as unknown as Ticket;
        const newReplies = ticket.replies || [];
        newReplies.push({
          sender: 'user',
          text: replyMessage.trim(),
          createdAt: Date.now()
        });
        await supabase.from('tickets').update({ replies: newReplies }).eq('id', ticketId);
        setReplyMessage('');
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
        className="flex-1 px-4 py-2 border border-gray-200 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <button 
        disabled={sending || !replyMessage.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center shadow-lg shadow-blue-100"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
