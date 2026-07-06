'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Thread = {
  id: string;
  photographerId: string;
  photographerName: string;
  photographerEmail: string;
  photographerPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  isOnline: boolean;
};

type Message = {
  id: string;
  content: string;
  sender_role: 'super_admin' | 'photographer';
  created_at: string;
  pending?: boolean;
};

const QUICK_REPLIES = [
  'Your subscription has been activated ✅',
  'Payment received, thank you!',
  'Please renew your subscription to continue.',
  'Your account has been extended by 30 days.',
  'We will look into this and get back to you.',
  'Please check your email for instructions.',
];

export default function SuperAdminChatPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [isPhotographerOnline, setIsPhotographerOnline] = useState(false);
  const [adminUserId, setAdminUserId] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const msgChannelRef = useRef<any>(null);
  // Presence: super admin broadcasts to ALL photographer presence channels
  const presencePingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Per-thread presence channel to detect photographer online status
  const photographerPresenceRef = useRef<any>(null);
  const lastPhotographerPingRef = useRef<number>(0);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Global thread subscription for new messages across all threads
  const globalChannelRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setAdminUserId(user.id);
    })();
    loadThreads();
    return () => cleanup();
  }, []);

  // Start global presence broadcast when we have userId
  useEffect(() => {
    if (!adminUserId) return;
    startGlobalPresence(adminUserId);
    startGlobalThreadSubscription(adminUserId);
    return () => {
      if (presencePingRef.current) clearInterval(presencePingRef.current);
      if (globalChannelRef.current) supabase.removeChannel(globalChannelRef.current);
    };
  }, [adminUserId]);

  const cleanup = () => {
    if (msgChannelRef.current) supabase.removeChannel(msgChannelRef.current);
    if (photographerPresenceRef.current) supabase.removeChannel(photographerPresenceRef.current);
    if (presencePingRef.current) clearInterval(presencePingRef.current);
    if (globalChannelRef.current) supabase.removeChannel(globalChannelRef.current);
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
  };

  // Broadcast super admin presence to all photographer presence channels
  const startGlobalPresence = (userId: string) => {
    if (presencePingRef.current) clearInterval(presencePingRef.current);
    // We broadcast on a global super_admin channel; photographers listen on their own channel
    // but we also need to broadcast on each photographer's channel
    // Solution: broadcast on a shared super_admin_online channel
    const broadcastPresence = async () => {
      const { data: photographers } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin');
      (photographers || []).forEach(p => {
        supabase.channel(`support_presence_${p.id}`).send({
          type: 'broadcast', event: 'ping',
          payload: { role: 'super_admin', userId, ts: Date.now() },
        } as any);
      });
    };
    broadcastPresence();
    presencePingRef.current = setInterval(broadcastPresence, 15000);
  };

  // Subscribe to ALL new support messages so thread list updates in real-time
  const startGlobalThreadSubscription = (userId: string) => {
    if (globalChannelRef.current) supabase.removeChannel(globalChannelRef.current);
    const channel = supabase.channel('support_messages_global')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_messages',
      }, payload => {
        const m = payload.new as any;
        // Update thread list
        setThreads(prev => prev.map(t => {
          if (t.photographerId !== m.photographer_id) return t;
          const newUnread = m.sender_role === 'photographer' && selected?.photographerId !== m.photographer_id
            ? t.unread + 1 : t.unread;
          return { ...t, lastMessage: m.content, lastMessageAt: m.created_at, unread: newUnread };
        }));
        // If this message belongs to the open thread, add it
        setSelected(prev => {
          if (prev?.photographerId === m.photographer_id) {
            setMessages(msgs => msgs.some(msg => msg.id === m.id) ? msgs : [...msgs, m]);
            setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
            // Auto-mark as read
            if (m.sender_role === 'photographer') {
              supabase.from('support_messages').update({ is_read: true }).eq('id', m.id);
            }
          }
          return prev;
        });
      })
      .subscribe();
    globalChannelRef.current = channel;
  };

  const loadThreads = async () => {
    setLoading(true);
    try {
      const { data: photographers } = await supabase
        .from('user_profiles')
        .select('id, name, email, phone')
        .eq('role', 'admin')
        .order('name');

      if (!photographers?.length) { setThreads([]); return; }

      const photographerIds = photographers.map(p => p.id);

      const { data: msgs } = await supabase
        .from('support_messages')
        .select('*')
        .in('photographer_id', photographerIds)
        .order('created_at', { ascending: false });

      const threadMap = new Map<string, Thread>();

      (msgs || []).forEach(m => {
        if (!threadMap.has(m.photographer_id)) {
          const ph = photographers.find(p => p.id === m.photographer_id);
          if (ph) {
            threadMap.set(m.photographer_id, {
              id: m.photographer_id,
              photographerId: m.photographer_id,
              photographerName: ph.name || ph.email,
              photographerEmail: ph.email,
              photographerPhone: ph.phone || '',
              lastMessage: m.content,
              lastMessageAt: m.created_at,
              unread: 0,
              isOnline: false,
            });
          }
        }
        if (m.sender_role === 'photographer' && !m.is_read) {
          const t = threadMap.get(m.photographer_id);
          if (t) t.unread++;
        }
      });

      // Add photographers with no messages
      photographers.forEach(p => {
        if (!threadMap.has(p.id)) {
          threadMap.set(p.id, {
            id: p.id, photographerId: p.id,
            photographerName: p.name || p.email,
            photographerEmail: p.email,
            photographerPhone: p.phone || '',
            lastMessage: '', lastMessageAt: '', unread: 0, isOnline: false,
          });
        }
      });

      const sorted = Array.from(threadMap.values()).sort((a, b) =>
        b.lastMessageAt.localeCompare(a.lastMessageAt));
      setThreads(sorted);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openThread = async (thread: Thread) => {
    setSelected(thread);
    setIsPhotographerOnline(false);
    setMsgLoading(true);

    // Clean up previous per-thread subscriptions
    if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null; }
    if (photographerPresenceRef.current) { supabase.removeChannel(photographerPresenceRef.current); photographerPresenceRef.current = null; }
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);

    try {
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('photographer_id', thread.photographerId)
        .order('created_at', { ascending: true });
      setMessages(data || []);

      // Mark photographer messages as read
      await supabase.from('support_messages').update({ is_read: true })
        .eq('photographer_id', thread.photographerId)
        .eq('sender_role', 'photographer');
      setThreads(prev => prev.map(t =>
        t.photographerId === thread.photographerId ? { ...t, unread: 0 } : t
      ));
    } catch (e) { console.error(e); }
    finally {
      setMsgLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'auto' }), 100);
    }

    // Listen for photographer presence pings on their channel
    const presenceChannel = supabase
      .channel(`support_presence_${thread.photographerId}`)
      .on('broadcast', { event: 'ping' }, (msg: any) => {
        if (msg?.payload?.role === 'photographer' && msg?.payload?.userId === thread.photographerId) {
          lastPhotographerPingRef.current = Date.now();
          setIsPhotographerOnline(true);
          if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = setTimeout(() => {
            if (Date.now() - lastPhotographerPingRef.current >= 30000) setIsPhotographerOnline(false);
          }, 32000);
        }
      })
      .subscribe();

    // Also send our presence ping immediately on this channel
    if (adminUserId) {
      presenceChannel.send({
        type: 'broadcast', event: 'ping',
        payload: { role: 'super_admin', userId: adminUserId, ts: Date.now() },
      } as any);
    }

    photographerPresenceRef.current = presenceChannel;
  };

  const closeThread = () => {
    setSelected(null);
    setMessages([]);
    setIsPhotographerOnline(false);
    if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null; }
    if (photographerPresenceRef.current) { supabase.removeChannel(photographerPresenceRef.current); photographerPresenceRef.current = null; }
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || newMsg).trim();
    if (!content || !selected || sending || !adminUserId) return;
    setSending(true);
    const localId = 'local-' + Date.now();
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { id: localId, content, sender_role: 'super_admin', created_at: now, pending: true }]);
    if (!text) setNewMsg('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 0);
    try {
      const { data: msg, error } = await supabase.from('support_messages').insert({
        photographer_id: selected.photographerId,
        super_admin_id: adminUserId,
        content,
        sender_role: 'super_admin',
        is_read: false,
      }).select().single();
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === localId ? { ...msg, pending: false } : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== localId));
    } finally { setSending(false); }
  }, [newMsg, selected, sending, adminUserId]);

  const openWhatsApp = (thread: Thread) => {
    const phone = (thread.photographerPhone || thread.photographerEmail).replace(/[^0-9]/g, '');
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const filtered = search.trim()
    ? threads.filter(t =>
        t.photographerName.toLowerCase().includes(search.toLowerCase()) ||
        t.photographerEmail.toLowerCase().includes(search.toLowerCase())
      )
    : threads;

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex rounded-2xl overflow-hidden border border-white/5"
      style={{ background: '#0A0A0E' }}>

      {/* ── Thread list ── */}
      <div className={`flex flex-col border-r border-white/5 ${selected ? 'hidden md:flex w-72' : 'flex w-full md:w-72'}`}
        style={{ background: '#0F0F1A' }}>

        <div className="px-4 py-4 border-b border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black">Photographer Chat</h1>
              {totalUnread > 0 && (
                <p className="text-xs font-semibold" style={{ color: '#FF3B30' }}>
                  {totalUnread} unread message{totalUnread !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/30"
            placeholder="Search photographers..."
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm text-gray-400">No photographers yet</p>
            </div>
          ) : filtered.map(t => (
            <button
              key={t.id}
              onClick={() => openThread(t)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 text-left transition-colors ${
                selected?.photographerId === t.photographerId
                  ? 'bg-yellow-500/5 border-l-2 border-l-yellow-500'
                  : ''
              }`}>
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                  {(t.photographerName || '?').charAt(0).toUpperCase()}
                </div>
                {t.isOnline && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0F0F1A]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm truncate ${t.unread > 0 ? 'font-bold text-white' : 'font-medium text-gray-200'}`}>
                    {t.photographerName}
                  </p>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatTime(t.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs truncate text-gray-500">{t.lastMessage || t.photographerEmail}</p>
                  {t.unread > 0 && (
                    <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                      {t.unread > 9 ? '9+' : t.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat view ── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 flex-shrink-0"
            style={{ background: '#0F0F1A' }}>
            <button onClick={closeThread} className="md:hidden text-gray-400 hover:text-white mr-1 text-lg">←</button>
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                {selected.photographerName.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0F0F1A] ${
                isPhotographerOnline ? 'bg-green-400' : 'bg-gray-600'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">{selected.photographerName}</p>
              <p className={`text-xs ${isPhotographerOnline ? 'text-green-400' : 'text-gray-500'}`}>
                {isPhotographerOnline ? '● Online' : '○ Offline'} · {selected.photographerEmail}
              </p>
            </div>
            {selected.photographerPhone && (
              <button
                onClick={() => openWhatsApp(selected)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#25D366' }}>
                💬 WhatsApp
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {msgLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No messages yet. Start the conversation.</p>
              </div>
            ) : messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_role === 'super_admin' ? 'justify-end' : 'justify-start'}`}>
                {m.sender_role === 'photographer' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 self-end mb-1"
                    style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                    {selected.photographerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.sender_role === 'super_admin'
                      ? 'rounded-br-sm text-black'
                      : 'bg-white/10 text-white rounded-bl-sm'
                  } ${m.pending ? 'opacity-60' : ''}`}
                  style={m.sender_role === 'super_admin'
                    ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)' }
                    : {}}>
                  <p>{m.content}</p>
                  <p className={`text-xs mt-1 ${m.sender_role === 'super_admin' ? 'text-black/50' : 'text-gray-500'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.pending && ' · sending...'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick replies */}
          <div className="px-4 py-2 border-t border-white/5 overflow-x-auto flex-shrink-0">
            <div className="flex gap-2 pb-1">
              {QUICK_REPLIES.map((r, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(r)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs border border-white/10 text-gray-300 hover:border-yellow-500/30 hover:text-yellow-400 transition-colors whitespace-nowrap"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="flex items-end gap-3 px-4 py-3 border-t border-white/5 flex-shrink-0">
            <textarea
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={1}
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500/30 resize-none"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!newMsg.trim() || sending}
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
              {sending
                ? <div className="w-4 h-4 border-2 border-t-transparent border-black/50 rounded-full animate-spin" />
                : '→'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-6xl">💬</div>
            <p className="text-gray-400 font-semibold">Select a photographer</p>
            <p className="text-gray-600 text-sm">Choose from the list to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
