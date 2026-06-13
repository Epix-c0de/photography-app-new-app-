'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Photographer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  is_lifetime: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  allow_original_download: boolean;
  created_at: string;
};

type Stats = {
  total_photos: number;
  total_storage_bytes: number;
  total_storage_gb: number;
  gallery_count: number;
  avg_photo_size_bytes: number;
  total_revenue_kes: number;
  total_galleries: number;
  paid_galleries: number;
  total_clients: number;
};

type ChatMessage = {
  id: string;
  content: string;
  sender_role: 'super_admin' | 'photographer';
  created_at: string;
  pending?: boolean;
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: checked ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(24px)' : 'translateX(4px)' }}
      />
    </button>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#111118] border border-white/5 rounded-2xl p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-black" style={{ color: color || 'white' }}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function PhotographerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const photographerId = params.id as string;

  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [adminUserId, setAdminUserId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: profile }, { data: statsData }] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, name, email, phone, subscription_status, subscription_expires_at, is_lifetime, is_suspended, suspended_at, suspended_reason, allow_original_download, created_at')
          .eq('id', photographerId)
          .single() as any,
        supabase.rpc('get_photographer_full_stats', { p_photographer_id: photographerId }) as any,
      ]);
      if (profile) setPhotographer(profile);
      if (statsData) setStats(statsData as Stats);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [photographerId]);

  const loadChat = useCallback(async () => {
    setChatLoading(true);
    try {
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('photographer_id', photographerId)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      // Mark photographer messages as read
      await supabase.from('support_messages').update({ is_read: true })
        .eq('photographer_id', photographerId).eq('sender_role', 'photographer');
    } catch (e) { console.error(e); }
    finally {
      setChatLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'auto' }), 100);
    }
  }, [photographerId]);

  useEffect(() => {
    loadData();
    loadChat();
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setAdminUserId(user.id); });
  }, [loadData, loadChat]);

  // Realtime chat subscription
  useEffect(() => {
    if (!photographerId) return;
    const channel = supabase
      .channel(`support_detail_${photographerId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_messages',
        filter: `photographer_id=eq.${photographerId}`,
      }, (payload) => {
        const m = payload.new as any;
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
        if (m.sender_role === 'photographer') {
          supabase.from('support_messages').update({ is_read: true }).eq('id', m.id);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [photographerId]);

  const sendMessage = async (text?: string) => {
    const content = (text || newMsg).trim();
    if (!content || sending || !adminUserId) return;
    setSending(true);
    const localId = `local-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { id: localId, content, sender_role: 'super_admin', created_at: now, pending: true }]);
    setNewMsg('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 0);
    try {
      const { data: msg, error } = await supabase.from('support_messages').insert({
        photographer_id: photographerId,
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
  };

  const handleToggleOriginalDownload = async (value: boolean) => {
    setActionLoading('toggle_original');
    try {
      const { error } = await supabase.rpc('toggle_photographer_original_download', {
        p_photographer_id: photographerId,
        p_allow: value,
      });
      if (error) throw error;
      setPhotographer(prev => prev ? { ...prev, allow_original_download: value } : prev);
    } catch (e: any) {
      alert('Failed to update setting: ' + e.message);
    }
    setActionLoading(null);
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) { alert('Please enter a reason for suspension.'); return; }
    setActionLoading('suspend');
    try {
      const { error } = await supabase.rpc('suspend_photographer', {
        p_photographer_id: photographerId,
        p_reason: suspendReason.trim(),
      });
      if (error) throw error;
      setSuspendModal(false);
      setSuspendReason('');
      await loadData();
    } catch (e: any) {
      alert('Failed to suspend: ' + e.message);
    }
    setActionLoading(null);
  };

  const handleUnsuspend = async () => {
    if (!confirm(`Restore access for ${photographer?.name}?`)) return;
    setActionLoading('unsuspend');
    try {
      const { error } = await supabase.rpc('unsuspend_photographer', { p_photographer_id: photographerId });
      if (error) throw error;
      await loadData();
    } catch (e: any) {
      alert('Failed to unsuspend: ' + e.message);
    }
    setActionLoading(null);
  };

  const handleExtend = async (days: number) => {
    setActionLoading('extend');
    try {
      const base = photographer?.subscription_expires_at && new Date(photographer.subscription_expires_at) > new Date()
        ? new Date(photographer.subscription_expires_at) : new Date();
      base.setDate(base.getDate() + days);
      await supabase.from('user_profiles').update({
        subscription_status: 'active',
        subscription_expires_at: base.toISOString(),
      }).eq('id', photographerId);
      await loadData();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const handleMakeLifetime = async () => {
    if (!confirm('Grant lifetime access?')) return;
    setActionLoading('lifetime');
    try {
      await supabase.from('user_profiles').update({
        is_lifetime: true,
        subscription_status: 'active',
        subscription_expires_at: '2099-12-31T23:59:59Z',
      }).eq('id', photographerId);
      await loadData();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  };

  const subStatus = () => {
    if (!photographer) return { label: 'Unknown', color: 'rgba(255,255,255,0.3)' };
    if (photographer.is_suspended) return { label: '⛔ Suspended', color: '#FF3B30' };
    if (photographer.is_lifetime) return { label: '👑 Lifetime', color: '#AF52DE' };
    const now = new Date();
    const exp = photographer.subscription_expires_at ? new Date(photographer.subscription_expires_at) : null;
    if (photographer.subscription_status === 'active' && exp && exp > now) {
      const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      return { label: `● Active · ${days}d left`, color: '#34C759' };
    }
    if (photographer.subscription_status === 'inactive') return { label: '○ Inactive', color: 'rgba(255,255,255,0.4)' };
    return { label: '✕ Expired', color: '#FF3B30' };
  };

  const status = subStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(212,175,55,0.4)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!photographer) {
    return (
      <div className="text-center py-20 text-gray-500">
        Photographer not found.{' '}
        <Link href="/dashboard/photographers" className="text-yellow-500 hover:underline">← Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/photographers"
            className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            ← Back
          </Link>
          <div>
            <h1 className="text-3xl font-black">{photographer.name || 'Unnamed'}</h1>
            <p className="text-gray-400 mt-0.5 text-sm">{photographer.email} · {photographer.phone || 'No phone'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold px-3 py-1.5 rounded-lg"
            style={{ background: status.color + '18', color: status.color, border: `1px solid ${status.color}30` }}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Suspension banner */}
      {photographer.is_suspended && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
          <span className="text-2xl">⛔</span>
          <div className="flex-1">
            <p className="font-bold text-red-400">Account Suspended</p>
            {photographer.suspended_reason && (
              <p className="text-sm text-gray-400 mt-1">Reason: {photographer.suspended_reason}</p>
            )}
            {photographer.suspended_at && (
              <p className="text-xs text-gray-600 mt-0.5">
                Since {new Date(photographer.suspended_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            onClick={handleUnsuspend}
            disabled={actionLoading === 'unsuspend'}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
            {actionLoading === 'unsuspend' ? 'Restoring...' : 'Restore Access'}
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={stats?.total_revenue_kes ? `KES ${stats.total_revenue_kes.toLocaleString()}` : '—'}
          sub="Subscription payments"
          color="#D4AF37"
        />
        <StatCard
          label="Total Photos"
          value={stats?.total_photos?.toLocaleString() ?? '0'}
          sub={`Avg ${formatBytes(stats?.avg_photo_size_bytes ?? 0)}/photo`}
          color="white"
        />
        <StatCard
          label="Storage Used"
          value={formatBytes(stats?.total_storage_bytes ?? 0)}
          sub={`${stats?.total_galleries ?? 0} galleries`}
        />
        <StatCard
          label="Clients"
          value={stats?.total_clients?.toLocaleString() ?? '0'}
          sub={`${stats?.paid_galleries ?? 0} paid galleries`}
          color="#34C759"
        />
      </div>

      {/* Two-column: Settings + Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Settings card */}
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-5">
          <h2 className="font-bold text-lg">Download Settings</h2>

          {/* Allow original download toggle */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/5">
            <div className="flex-1">
              <p className="font-semibold text-sm text-white">Allow Original Downloads</p>
              <p className="text-xs text-gray-500 mt-1">
                When ON: clients download the original uploaded file (can be 20-50MB).<br />
                When OFF: clients receive the optimized 5MB web version (default, recommended).
              </p>
            </div>
            <Toggle
              checked={photographer.allow_original_download}
              onChange={handleToggleOriginalDownload}
              disabled={actionLoading === 'toggle_original'}
            />
          </div>

          <div className="rounded-xl p-3 text-xs"
            style={{ background: photographer.allow_original_download ? 'rgba(255,159,10,0.08)' : 'rgba(52,199,89,0.08)', border: `1px solid ${photographer.allow_original_download ? 'rgba(255,159,10,0.2)' : 'rgba(52,199,89,0.2)'}` }}>
            <p className="font-semibold" style={{ color: photographer.allow_original_download ? '#FF9F0A' : '#34C759' }}>
              {photographer.allow_original_download
                ? '⚠️ Original downloads enabled — clients receive full-size files'
                : '✅ Optimized downloads active — clients receive 5MB web-quality photos'}
            </p>
          </div>
        </div>

        {/* Subscription & Actions card */}
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-lg">Subscription & Actions</h2>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Status</p>
              <p className="font-bold mt-1" style={{ color: status.color }}>{status.label}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Member Since</p>
              <p className="font-semibold text-white mt-1">
                {new Date(photographer.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {photographer.subscription_expires_at && (
              <div className="bg-white/5 rounded-xl p-3 col-span-2">
                <p className="text-gray-400 text-xs">Expires</p>
                <p className="font-semibold text-white mt-1">
                  {new Date(photographer.subscription_expires_at).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {!photographer.is_lifetime && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleExtend(30)}
                  disabled={!!actionLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
                  {actionLoading === 'extend' ? '...' : '+30 Days'}
                </button>
                <button
                  onClick={() => handleExtend(90)}
                  disabled={!!actionLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
                  +90 Days
                </button>
                <button
                  onClick={handleMakeLifetime}
                  disabled={!!actionLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(175,82,222,0.1)', border: '1px solid rgba(175,82,222,0.2)', color: '#AF52DE' }}>
                  {actionLoading === 'lifetime' ? '...' : '👑 Lifetime'}
                </button>
              </div>
            )}

            {!photographer.is_suspended ? (
              <button
                onClick={() => setSuspendModal(true)}
                disabled={!!actionLoading}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#FF3B30' }}>
                ⛔ Suspend Photographer
              </button>
            ) : (
              <button
                onClick={handleUnsuspend}
                disabled={actionLoading === 'unsuspend'}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
                {actionLoading === 'unsuspend' ? 'Restoring...' : '✅ Restore Access'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat section */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Support Chat</h2>
            <p className="text-xs text-gray-500">Direct message with {photographer.name}</p>
          </div>
          {photographer.phone && (
            <a
              href={`https://wa.me/${photographer.phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#25D366' }}>
              💬 WhatsApp
            </a>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="overflow-y-auto px-5 py-4 space-y-3" style={{ height: 360 }}>
          {chatLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgba(212,175,55,0.4)', borderTopColor: 'transparent' }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm">No messages yet. Start the conversation.</p>
            </div>
          ) : messages.map(m => (
            <div key={m.id} className={`flex ${m.sender_role === 'super_admin' ? 'justify-end' : 'justify-start'}`}>
              {m.sender_role === 'photographer' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 self-end mb-1"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                  {(photographer.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.sender_role === 'super_admin' ? 'rounded-br-sm text-black' : 'bg-white/10 text-white rounded-bl-sm'
                } ${m.pending ? 'opacity-60' : ''}`}
                style={m.sender_role === 'super_admin' ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)' } : {}}>
                <p>{m.content}</p>
                <p className={`text-xs mt-1 ${m.sender_role === 'super_admin' ? 'text-black/50' : 'text-gray-500'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {m.pending && ' · sending...'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-end gap-3 px-4 py-3 border-t border-white/5">
          <textarea
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            rows={1}
            placeholder="Type a message... (Enter to send)"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500/30 resize-none"
            style={{ maxHeight: 96 }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!newMsg.trim() || sending}
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            {sending
              ? <div className="w-4 h-4 border-2 border-t-transparent border-black/40 rounded-full animate-spin" />
              : '→'}
          </button>
        </div>
      </div>

      {/* Suspend modal */}
      {suspendModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
          onClick={() => setSuspendModal(false)}>
          <div className="bg-[#111118] border border-red-500/20 rounded-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-red-400 mb-2">⛔ Suspend {photographer.name}</h3>
            <p className="text-sm text-gray-400 mb-4">
              This will immediately block access for this photographer and all their clients will see suspended content.
            </p>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Reason for suspension *</label>
            <textarea
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              rows={3}
              placeholder="e.g. Payment dispute, Terms of service violation..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/30 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setSuspendModal(false); setSuspendReason(''); }}
                className="flex-1 py-3 rounded-xl font-semibold text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={!suspendReason.trim() || actionLoading === 'suspend'}
                className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(255,59,48,0.9)', color: 'white' }}>
                {actionLoading === 'suspend' ? 'Suspending...' : 'Confirm Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
