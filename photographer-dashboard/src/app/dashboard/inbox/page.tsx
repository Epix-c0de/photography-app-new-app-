'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Thread = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  isOnline: boolean;
};

type Message = {
  id: string;
  content: string;
  sender_role: 'admin' | 'client';
  created_at: string;
  pending?: boolean;
};

const QUICK_REPLIES = [
  'Your photos are ready! 🎉',
  'Thanks for booking with us.',
  'Can you confirm the date?',
  'Please complete the payment.',
  'Gallery has been unlocked.',
  'We will be in touch soon.',
];

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientOnline, setIsClientOnline] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const presenceChannelRef = useRef<any>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientLastPingRef = useRef<number>(0);
  const msgChannelRef = useRef<any>(null);

  useEffect(() => {
    loadThreads();
    loadClients();
  }, []);

  const loadThreads = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all clients for this admin — we need user_id for the messages FK
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, user_id, name, phone')
        .eq('owner_admin_id', user.id);

      if (!clientsData?.length) { setThreads([]); return; }

      // messages.client_id references user_profiles(id), so we use clients.user_id
      const userProfileIds = clientsData.filter(c => c.user_id).map(c => c.user_id);

      // Get latest message per user_profile
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .in('client_id', userProfileIds)
        .order('created_at', { ascending: false });

      // Build thread map keyed by user_profile id
      const threadMap = new Map<string, Thread>();
      (msgs || []).forEach(m => {
        if (!threadMap.has(m.client_id)) {
          const client = clientsData.find(c => c.user_id === m.client_id);
          if (client) {
            threadMap.set(m.client_id, {
              id: m.client_id,
              clientId: m.client_id,
              clientName: client.name,
              clientPhone: client.phone || '',
              clientAvatar: null,
              lastMessage: m.content,
              lastMessageAt: m.created_at,
              unread: 0,
              isOnline: false,
            });
          }
        }
        // Count unread (client messages not read by admin)
        if (m.sender_role === 'client' && !m.is_read) {
          const t = threadMap.get(m.client_id);
          if (t) t.unread++;
        }
      });

      // Add clients with no messages
      clientsData.forEach(c => {
        if (c.user_id && !threadMap.has(c.user_id)) {
          threadMap.set(c.user_id, {
            id: c.user_id, clientId: c.user_id, clientName: c.name,
            clientPhone: c.phone || '', clientAvatar: null,
            lastMessage: '', lastMessageAt: '', unread: 0, isOnline: false,
          });
        }
      });

      const sorted = Array.from(threadMap.values()).sort((a, b) =>
        b.lastMessageAt.localeCompare(a.lastMessageAt));
      setThreads(sorted);
    } catch (e) { console.error('loadThreads:', e); }
    finally { setLoading(false); }
  };

  const loadClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('clients').select('id, user_id, name, phone').eq('owner_admin_id', user.id).order('name');
    setClients(data || []);
  };

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setMsgLoading(true);
    setIsClientOnline(false);

    // Unsubscribe previous channel
    if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null; }
    if (presenceChannelRef.current) { supabase.removeChannel(presenceChannelRef.current); presenceChannelRef.current = null; }

    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('client_id', thread.clientId)
        .order('created_at', { ascending: true });
      setMessages(data || []);

      // Mark client messages as read
      await supabase.from('messages').update({ is_read: true })
        .eq('client_id', thread.clientId).eq('sender_role', 'client');

      setThreads(prev => prev.map(t => t.clientId === thread.clientId ? { ...t, unread: 0 } : t));
    } catch (e) { console.error('openThread:', e); }
    finally { setMsgLoading(false); setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100); }

    // Subscribe to new messages
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const msgChannel = supabase.channel(`messages_${thread.clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${thread.clientId}` },
        payload => {
          const m = payload.new as Message;
          setMessages(prev => prev.some(p => p.id === m.id) ? prev : [...prev, m]);
          setThreads(prev => prev.map(t => t.clientId === thread.clientId
            ? { ...t, lastMessage: m.content, lastMessageAt: m.created_at }
            : t));
          setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
        })
      .subscribe();
    msgChannelRef.current = msgChannel;

    // Presence channel
    const presenceChannel = supabase.channel(`presence_admin_${user.id}`)
      .on('broadcast', { event: 'status' }, (msg: any) => {
        const p = msg?.payload || {};
        if (p.role === 'client' && p.clientId === thread.clientId) {
          clientLastPingRef.current = Date.now();
          setIsClientOnline(true);
          if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = setTimeout(() => {
            if (Date.now() - clientLastPingRef.current >= 30000) setIsClientOnline(false);
          }, 32000);
        }
      })
      .subscribe();

    const sendPing = () => presenceChannel.send({
      type: 'broadcast', event: 'status',
      payload: { role: 'admin', userId: user.id, ts: Date.now() }
    } as any);
    sendPing();
    const pingInterval = setInterval(sendPing, 15000);
    presenceChannelRef.current = { channel: presenceChannel, interval: pingInterval };
  };

  const closeThread = () => {
    setSelectedThread(null);
    setMessages([]);
    if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null; }
    if (presenceChannelRef.current) {
      clearInterval(presenceChannelRef.current.interval);
      supabase.removeChannel(presenceChannelRef.current.channel);
      presenceChannelRef.current = null;
    }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || newMessage).trim();
    if (!content || !selectedThread || sending) return;
    setSending(true);
    const localId = 'local-' + Date.now();
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { id: localId, content, sender_role: 'admin', created_at: now, pending: true }]);
    if (!text) setNewMessage('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify the client row exists — we need the user_id for messages.client_id FK
      let resolvedUserId = selectedThread.clientId; // clientId is now user_profiles.id
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, user_id')
        .eq('user_id', resolvedUserId)
        .eq('owner_admin_id', user.id)
        .maybeSingle();

      if (!clientRow) {
        // Try to find by phone
        if (selectedThread.clientPhone) {
          const { data: byPhone } = await supabase
            .from('clients')
            .select('id, user_id')
            .eq('owner_admin_id', user.id)
            .or(`phone.eq.${selectedThread.clientPhone},mobile_number.eq.${selectedThread.clientPhone}`)
            .maybeSingle();

          if (byPhone && byPhone.user_id) {
            resolvedUserId = byPhone.user_id;
          } else {
            throw new Error('Client record not found. Please refresh the page.');
          }
        } else {
          throw new Error('Client record not found. Please refresh the page.');
        }
      } else if (clientRow.user_id) {
        resolvedUserId = clientRow.user_id;
      }

      const { data: msg, error } = await supabase.from('messages').insert({
        client_id: resolvedUserId,
        owner_admin_id: user.id,
        content,
        sender_role: 'admin',
        is_read: false,
      }).select().single();
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === localId ? { ...msg, pending: false } : m));
      setThreads(prev => prev.map(t => t.clientId === selectedThread.clientId
        ? { ...t, lastMessage: content, lastMessageAt: now } : t));
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== localId));
      console.error('sendMessage error:', e?.message || e);
      // Show error to user
      alert('Failed to send message: ' + (e?.message || 'Unknown error'));
    } finally { setSending(false); }
  }, [newMessage, selectedThread, sending]);

  const startNewChat = (client: any) => {
    // Use user_id as the thread identifier (messages.client_id -> user_profiles.id)
    const userId = client.user_id || client.id;
    const existing = threads.find(t => t.clientId === userId);
    if (existing) { openThread(existing); }
    else {
      const newThread: Thread = {
        id: userId, clientId: userId, clientName: client.name,
        clientPhone: client.phone || '', clientAvatar: null,
        lastMessage: '', lastMessageAt: '', unread: 0, isOnline: false,
      };
      setThreads(prev => [newThread, ...prev]);
      openThread(newThread);
    }
    setShowNewChat(false);
    setClientSearch('');
  };

  const filteredThreads = searchQuery.trim()
    ? threads.filter(t => t.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || t.clientPhone.includes(searchQuery))
    : threads;

  const filteredClients = clientSearch.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.phone || '').includes(clientSearch))
    : clients;

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-0 rounded-2xl overflow-hidden border border-white/5" style={{ background: '#0A0A0E' }}>

      {/* Thread list */}
      <div className={`flex flex-col border-r border-white/5 ${selectedThread ? 'hidden md:flex w-72' : 'flex w-full md:w-72'}`}
        style={{ background: '#0F0F1A' }}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-black">Inbox</h1>
              {totalUnread > 0 && <p className="text-xs text-yellow-400">{totalUnread} unread</p>}
            </div>
            <button onClick={() => setShowNewChat(true)}
              className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center hover:bg-yellow-500/20 text-lg">+</button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-none"
              placeholder="Search..." />
          </div>
        </div>

        {/* Threads */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent border-yellow-500/60 rounded-full animate-spin" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-gray-400 text-sm">No conversations yet</p>
              <p className="text-gray-600 text-xs mt-1">Messages from clients appear here</p>
            </div>
          ) : filteredThreads.map(t => (
            <button key={t.id} onClick={() => openThread(t)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 text-left transition-colors ${
                selectedThread?.clientId === t.clientId ? 'bg-yellow-500/5 border-l-2 border-l-yellow-500' : ''
              }`}>
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                  {t.clientName.charAt(0).toUpperCase()}
                </div>
                {t.isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0F0F1A]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm truncate ${t.unread > 0 ? 'font-bold text-white' : 'font-medium text-gray-200'}`}>{t.clientName}</p>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatTime(t.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className={`text-xs truncate ${t.unread > 0 ? 'text-gray-300' : 'text-gray-500'}`}>{t.lastMessage || 'No messages yet'}</p>
                  {t.unread > 0 && (
                    <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center">{t.unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat view */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5" style={{ background: '#0F0F1A' }}>
            <button onClick={closeThread} className="md:hidden text-gray-400 hover:text-white mr-1">←</button>
            <div className="relative">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                {selectedThread.clientName.charAt(0).toUpperCase()}
              </div>
              {isClientOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0F0F1A]" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-white">{selectedThread.clientName}</p>
              <p className={`text-xs ${isClientOnline ? 'text-green-400' : 'text-gray-500'}`}>
                {isClientOnline ? '● Online' : '○ Offline'} · {selectedThread.clientPhone}
              </p>
            </div>
            <a href={`/dashboard/upload?clientId=${selectedThread.clientId}`}
              className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-lg text-xs font-semibold hover:bg-yellow-500/20">
              📸 Upload
            </a>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {msgLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-t-transparent border-yellow-500/60 rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No messages yet. Say hello!</p>
              </div>
            ) : messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                  m.sender_role === 'admin'
                    ? 'bg-yellow-500 text-black rounded-br-sm'
                    : 'bg-white/10 text-white rounded-bl-sm'
                } ${m.pending ? 'opacity-60' : ''}`}>
                  <p>{m.content}</p>
                  <p className={`text-xs mt-1 ${m.sender_role === 'admin' ? 'text-black/50' : 'text-gray-500'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.pending && ' · sending...'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick replies */}
          <div className="px-4 py-2 border-t border-white/5 overflow-x-auto">
            <div className="flex gap-2 pb-1">
              {QUICK_REPLIES.map((r, i) => (
                <button key={i} onClick={() => sendMessage(r)}
                  className="flex-shrink-0 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300 hover:bg-yellow-500/10 hover:border-yellow-500/20 hover:text-yellow-400 transition-colors">
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="flex items-end gap-3 px-4 py-3 border-t border-white/5">
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={1} placeholder="Type a message... (Enter to send)"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500/30 resize-none"
              style={{ maxHeight: 120 }} />
            <button onClick={() => sendMessage()} disabled={!newMessage.trim() || sending}
              className="w-10 h-10 rounded-xl bg-yellow-500 text-black flex items-center justify-center hover:opacity-90 disabled:opacity-40 flex-shrink-0">
              {sending ? <div className="w-4 h-4 border-2 border-t-transparent border-black rounded-full animate-spin" /> : '→'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-gray-400 font-semibold">Select a conversation</p>
            <p className="text-gray-600 text-sm mt-1">Choose a client from the list to start chatting</p>
          </div>
        </div>
      )}

      {/* New chat modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#111118] border border-white/10 rounded-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="font-bold">New Message</h3>
              <button onClick={() => { setShowNewChat(false); setClientSearch(''); }}
                className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-4">
              <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none mb-3"
                placeholder="Search clients..." autoFocus />
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredClients.map(c => (
                  <button key={c.id} onClick={() => startNewChat(c)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </div>
                  </button>
                ))}
                {filteredClients.length === 0 && <p className="text-center text-gray-500 text-sm py-4">No clients found</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
