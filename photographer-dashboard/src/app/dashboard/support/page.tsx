'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  content: string;
  sender_role: 'photographer' | 'super_admin';
  created_at: string;
  pending?: boolean;
};

const QUICK_REPLIES = [
  'I need help with my subscription',
  'My M-Pesa payment was not confirmed',
  'I cannot upload photos',
  'I need to reset my access code',
  'How do I add a new client?',
];

export default function SupportPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [appLinks, setAppLinks] = useState({ android: '', ios: '' });
  const [isOnline, setIsOnline] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const presenceRef = useRef<any>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    init();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (presenceRef.current) supabase.removeChannel(presenceRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Load platform settings (WhatsApp + app links)
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['platform_whatsapp_number', 'platform_app_android_link', 'platform_app_ios_link']);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value || ''; });
    setWhatsappNumber(settingsMap['platform_whatsapp_number'] || '');
    setAppLinks({
      android: settingsMap['platform_app_android_link'] || 'https://play.google.com/store',
      ios: settingsMap['platform_app_ios_link'] || 'https://apps.apple.com',
    });

    // Load messages
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('photographer_id', user.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'auto' }), 100);

    // Mark super_admin messages as read
    await supabase.from('support_messages')
      .update({ is_read: true })
      .eq('photographer_id', user.id)
      .eq('sender_role', 'super_admin');

    // Subscribe to new messages (real-time)
    const channel = supabase
      .channel(`support_photographer_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `photographer_id=eq.${user.id}`,
      }, (payload) => {
        const m = payload.new as Message;
        setMessages(prev => prev.some(p => p.id === m.id) ? prev : [...prev, m]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
        // Mark incoming super_admin messages as read immediately
        if (m.sender_role === 'super_admin') {
          supabase.from('support_messages').update({ is_read: true }).eq('id', m.id);
        }
      })
      .subscribe();
    channelRef.current = channel;

    // Presence — detect if super admin is online
    const presenceChannel = supabase
      .channel(`support_presence_${user.id}`)
      .on('broadcast', { event: 'ping' }, (msg: any) => {
        if (msg?.payload?.role === 'super_admin') {
          lastPingRef.current = Date.now();
          setIsOnline(true);
          if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = setTimeout(() => {
            if (Date.now() - lastPingRef.current >= 30000) setIsOnline(false);
          }, 32000);
        }
      })
      .subscribe();

    // Send photographer presence ping
    const sendPing = () => presenceChannel.send({
      type: 'broadcast', event: 'ping',
      payload: { role: 'photographer', userId: user.id, ts: Date.now() },
    } as any);
    sendPing();
    pingRef.current = setInterval(sendPing, 15000);
    presenceRef.current = presenceChannel;
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || newMsg).trim();
    if (!content || !userId || sending) return;
    setSending(true);
    const localId = 'local-' + Date.now();
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { id: localId, content, sender_role: 'photographer', created_at: now, pending: true }]);
    if (!text) setNewMsg('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 0);
    try {
      const { data: msg, error } = await supabase.from('support_messages').insert({
        photographer_id: userId,
        content,
        sender_role: 'photographer',
        is_read: false,
      }).select().single();
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === localId ? { ...msg, pending: false } : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== localId));
    } finally { setSending(false); }
  }, [newMsg, userId, sending]);

  const openWhatsApp = () => {
    if (!whatsappNumber) return;
    const phone = whatsappNumber.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent('Hello Epix Visuals support, I need help with my account.');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-white/5 mb-0">
        <div>
          <h1 className="text-2xl font-black">Support Chat</h1>
          <p className="text-sm text-gray-400 mt-0.5">Chat directly with the Epix Visuals team</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {whatsappNumber && (
            <button onClick={openWhatsApp}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>
              <span>💬</span> WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Chat container */}
      <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-white/5 mt-4"
        style={{ background: '#0A0A0E' }}>
        {/* Chat header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5"
          style={{ background: '#0F0F1A' }}>
          <div className="relative">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>E</div>
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0F0F1A] ${isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
          </div>
          <div>
            <p className="font-bold text-sm text-white">Epix Visuals Support</p>
            <p className={`text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
              {isOnline ? '● Online — replies instantly' : '○ Offline — will reply soon'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="text-5xl">👋</div>
              <p className="font-semibold text-white">Welcome to Epix Visuals Support</p>
              <p className="text-sm text-gray-400">Send us a message and we'll get back to you as soon as possible.</p>
              {/* App download links */}
              <div className="mt-6 p-4 rounded-2xl border border-white/5 text-left space-y-3"
                style={{ background: 'rgba(212,175,55,0.04)' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#D4AF37' }}>Download the Admin App</p>
                <div className="flex gap-3">
                  <a href={appLinks.android} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-sm">
                    <span>🤖</span> <span className="text-white font-semibold">Android</span>
                  </a>
                  <a href={appLinks.ios} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-sm">
                    <span>🍎</span> <span className="text-white font-semibold">iOS</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_role === 'photographer' ? 'justify-end' : 'justify-start'}`}>
                  {m.sender_role === 'super_admin' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mr-2 flex-shrink-0 self-end mb-1"
                      style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>E</div>
                  )}
                  <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                    m.sender_role === 'photographer'
                      ? 'rounded-br-sm text-black'
                      : 'bg-white/10 text-white rounded-bl-sm'
                  } ${m.pending ? 'opacity-60' : ''}`}
                    style={m.sender_role === 'photographer' ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)' } : {}}>
                    <p className="leading-relaxed">{m.content}</p>
                    <p className={`text-xs mt-1 ${m.sender_role === 'photographer' ? 'text-black/50' : 'text-gray-500'}`}>
                      {formatTime(m.created_at)}{m.pending && ' · sending...'}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Quick replies */}
        {messages.length === 0 && !loading && (
          <div className="px-4 py-2 border-t border-white/5 overflow-x-auto">
            <div className="flex gap-2 pb-1">
              {QUICK_REPLIES.map((r, i) => (
                <button key={i} onClick={() => sendMessage(r)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs border border-white/10 text-gray-300 hover:border-yellow-500/30 hover:text-yellow-400 transition-colors whitespace-nowrap"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex items-end gap-3 px-4 py-3 border-t border-white/5">
          <textarea
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            rows={1}
            placeholder="Type your message... (Enter to send)"
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
    </div>
  );
}
