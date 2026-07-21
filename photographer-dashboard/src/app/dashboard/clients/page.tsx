'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/* ─── Types ──────────────────────────────────────────────── */
type Client = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  email: string;
  loyalty_level: string;
  total_paid: number;
  gallery_count: number;
  created_at: string;
};

type Gallery = {
  id: string;
  name: string;
  access_code: string;
  is_paid: boolean;
  is_locked: boolean;
  price: number;
  shoot_type: string;
  created_at: string;
  photo_count: number;
  cover_photo_url: string | null;
  cover_signed_url: string | null;
};

type Photo = {
  id: string;
  gallery_id: string;
  photo_url: string;
  signed_url: string | null;
  file_name: string;
  upload_order: number;
};

type Message = {
  id: string;
  content: string;
  sender_role: 'admin' | 'client';
  created_at: string;
  pending?: boolean;
};

/* ─── Loyalty colours ────────────────────────────────────── */
const LOYALTY: Record<string, { bg: string; text: string }> = {
  Bronze:   { bg: 'rgba(205,127,50,0.15)',  text: '#CD7F32' },
  Silver:   { bg: 'rgba(192,192,192,0.15)', text: '#C0C0C0' },
  Gold:     { bg: 'rgba(212,175,55,0.15)',  text: '#D4AF37' },
  Platinum: { bg: 'rgba(229,228,226,0.15)', text: '#E5E4E2' },
};

/* ─── Helpers ────────────────────────────────────────────── */
async function signUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from('client-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/* ═══════════════════════════════════════════════════════════
   CLIENT LIST
═══════════════════════════════════════════════════════════ */
export default function ClientsPage() {
  const [clients, setClients]               = useState<Client[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating]             = useState(false);
  const [createError, setCreateError]       = useState('');
  const [newClient, setNewClient]           = useState({ name: '', phone: '' });
  const [deletingId, setDeletingId]         = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Try full select first; fall back if loyalty_level / total_paid don't exist yet
    let rows: any[] = [];
    const { data, error } = await supabase
      .from('clients')
      .select('id, user_id, name, phone, email, loyalty_level, total_paid, created_at')
      .eq('owner_admin_id', user.id)
      .order('name');

    if (error) {
      console.warn('[ClientsPage] fallback select:', error.message);
      const { data: fb } = await supabase
        .from('clients')
        .select('id, user_id, name, phone, email, created_at')
        .eq('owner_admin_id', user.id)
        .order('name');
      rows = (fb || []).map((c: any) => ({ ...c, loyalty_level: 'Bronze', total_paid: 0 }));
    } else {
      rows = data || [];
    }

    // Gallery counts
    const ids = rows.map((c: any) => c.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: gals } = await supabase.from('galleries').select('client_id').in('client_id', ids);
      (gals || []).forEach((g: any) => counts.set(g.client_id, (counts.get(g.client_id) || 0) + 1));
    }

    // Enrich with avatar_url from user_profiles (by user_id if linked, else by phone)
    const enriched = await Promise.all(rows.map(async (c: any) => {
      let avatar_url: string | null = null;
      if (c.user_id) {
        const { data: prof } = await supabase
          .from('user_profiles').select('avatar_url').eq('id', c.user_id).maybeSingle();
        avatar_url = prof?.avatar_url ?? null;
      } else if (c.phone) {
        // Use phone-based lookup for pre-created clients not yet linked
        const { data: rpc } = await supabase.rpc('get_profile_by_phone' as any, { p_phone: c.phone }) as any;
        avatar_url = rpc?.avatar_url ?? null;
      }
      return { ...c, avatar_url, gallery_count: counts.get(c.id) || 0 };
    }));

    setClients(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const handleDelete = async (clientId: string, clientName: string) => {
    if (!confirm(`Delete client "${clientName}"? This will also remove all their galleries and photos.`)) return;
    setDeletingId(clientId);
    try {
      // Delete associated galleries first (cascade)
      const { data: gals } = await supabase.from('galleries').select('id').eq('client_id', clientId);
      if (gals?.length) {
        const galIds = gals.map((g: any) => g.id);
        await supabase.from('gallery_photos').delete().in('gallery_id', galIds);
        await supabase.from('galleries').delete().in('id', galIds);
      }
      // Delete messages
      await supabase.from('messages').delete().eq('client_id', clientId);
      // Delete the client record
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      setClients(prev => prev.filter(c => c.id !== clientId));
      if (selectedClient?.id === clientId) setSelectedClient(null);
    } catch (err: any) {
      alert('Failed to delete client: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.phone.trim()) {
      setCreateError('Phone number is required.'); return;
    }
    setCreateError(''); setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const normalizedPhone = newClient.phone.trim().replace(/[^\d+]/g, '');

      // Check if this phone already exists under this admin
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_admin_id', user.id)
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existing) {
        setCreateError('A client with this phone number already exists.');
        setCreating(false);
        return;
      }

      // Try to find a user_profiles row by phone to auto-link
      const { data: existingProfile } = await supabase.rpc('get_profile_by_phone' as any, { p_phone: normalizedPhone }) as any;

      const { error } = await supabase.from('clients').insert({
        owner_admin_id: user.id,
        name: newClient.name.trim() || (existingProfile?.name ?? normalizedPhone),
        phone: normalizedPhone,
        mobile_number: normalizedPhone,
        user_id: existingProfile?.id ?? null,  // auto-link if user already exists
        total_paid: 0,
      });
      if (error) throw error;
      setShowCreateModal(false);
      setNewClient({ name: '', phone: '' });
      await loadClients();
    } catch (err: any) { setCreateError(err.message); }
    finally { setCreating(false); }
  };

  const filtered = clients.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Client detail view ─────────────────────────────────── */
  if (selectedClient) {
    return (
      <ClientDetail
        client={selectedClient}
        onBack={() => { setSelectedClient(null); loadClients(); }}
      />
    );
  }

  /* ── List view ──────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Clients</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 4, fontSize: 14 }}>
            {clients.length} total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ background: 'linear-gradient(135deg,#D4AF37,#F0D060)', color: '#080810', fontWeight: 700, borderRadius: 14, padding: '10px 20px', fontSize: 14, border: 'none', cursor: 'pointer' }}>
          + Add Client
        </button>
      </div>

      <input
        type="text" placeholder="Search by name, phone, or email…"
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 14, outline: 'none' }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="premium-card p-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
          No clients found.{' '}
          <button onClick={() => setShowCreateModal(true)}
            style={{ color: '#D4AF37', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Add your first client
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {filtered.map(c => {
            const ls = LOYALTY[c.loyalty_level || 'Bronze'] || LOYALTY.Bronze;
            return (
              <div key={c.id} className="premium-card" style={{ cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                onClick={() => setSelectedClient(c)}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Avatar — real photo if available, else initial */}
                    {(c as any).avatar_url ? (
                      <img src={(c as any).avatar_url} alt={c.name}
                        style={{ width: 44, height: 44, borderRadius: 14, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(212,175,55,0.2)' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#D4AF37', flexShrink: 0 }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                        <span style={{ ...ls, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {c.loyalty_level || 'Bronze'}
                        </span>
                        {!c.user_id && (
                          <span title="No app account yet" style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(255,159,10,0.12)', color: '#FF9F0A', flexShrink: 0 }}>
                            📵 No account
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{c.phone || '—'}</p>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(c.id, c.name); }}
                      disabled={deletingId === c.id}
                      title="Delete client"
                      style={{ background: 'none', border: 'none', cursor: deletingId === c.id ? 'not-allowed' : 'pointer', padding: '4px 6px', color: 'rgba(255,59,48,0.5)', borderRadius: 8, fontSize: 16, flexShrink: 0, lineHeight: 1 }}
                      onMouseOver={e => (e.currentTarget.style.color = '#FF3B30')}
                      onMouseOut={e => { e.currentTarget.style.color = 'rgba(255,59,48,0.5)'; }}>
                      {deletingId === c.id ? '…' : '🗑'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>{c.gallery_count}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Galleries</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#D4AF37' }}>
                        {c.total_paid > 0 ? `KES ${c.total_paid.toLocaleString()}` : '—'}
                      </p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Total Paid</p>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <a href={`/dashboard/upload?clientId=${c.id}`}
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                        ⬆️ Upload
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#13131F', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Add Client</h2>
              <button onClick={() => { setShowCreateModal(false); setCreateError(''); setNewClient({ name: '', phone: '' }); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {createError && (
              <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: 12, color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={newClient.phone}
                  placeholder="0712345678"
                  required
                  autoFocus
                  onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                  Required. When the client signs up with this number they'll be automatically linked to your account.
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={newClient.name}
                  placeholder="Defaults to phone number"
                  onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" disabled={creating}
                style={{ background: creating ? 'rgba(212,175,55,0.4)' : 'linear-gradient(135deg,#D4AF37,#F0D060)', color: '#080810', fontWeight: 700, borderRadius: 14, padding: 14, fontSize: 15, border: 'none', cursor: creating ? 'not-allowed' : 'pointer', marginTop: 8 }}>
                {creating ? 'Adding…' : 'Add Client'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CLIENT DETAIL  (photos + analytics + chat)
═══════════════════════════════════════════════════════════ */
type Tab = 'photos' | 'chat';

function ClientDetail({ client, onBack }: { client: Client; onBack: () => void }) {
  const [tab, setTab]                           = useState<Tab>('photos');
  const [galleries, setGalleries]               = useState<Gallery[]>([]);
  const [allPhotos, setAllPhotos]               = useState<Photo[]>([]);
  const [selectedGallery, setSelectedGallery]   = useState<Gallery | null>(null);
  const [galleryPhotos, setGalleryPhotos]        = useState<Photo[]>([]);
  const [lightboxPhoto, setLightboxPhoto]       = useState<Photo | null>(null);
  const [gLoading, setGLoading]                 = useState(true);
  const [actionLoading, setActionLoading]       = useState<string | null>(null);
  const [copiedCode, setCopiedCode]             = useState<string | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState({
    totalPhotos: 0,
    totalGalleries: 0,
    paidGalleries: 0,
    unpaidGalleries: 0,
    totalRevenue: 0,
    totalMessages: 0,
  });

  // Chat
  const [messages, setMessages]     = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending]       = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [isOnline, setIsOnline]     = useState(false);
  const scrollRef                   = useRef<HTMLDivElement>(null);
  const msgChannelRef               = useRef<any>(null);
  const presenceRef                 = useRef<any>(null);

  const QUICK_REPLIES = [
    'Your photos are ready! 🎉',
    'Please complete the payment to unlock.',
    'Gallery has been unlocked.',
    'Thanks for booking with us.',
    'Can you confirm the shoot date?',
  ];

  /* ── Load galleries + photos ───────────────────────────── */
  useEffect(() => {
    loadGalleries();
    return () => {
      if (msgChannelRef.current) supabase.removeChannel(msgChannelRef.current);
      if (presenceRef.current) { clearInterval(presenceRef.current.interval); supabase.removeChannel(presenceRef.current.channel); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const loadGalleries = async () => {
    setGLoading(true);
    try {
      const { data: gals } = await supabase
        .from('galleries')
        .select('id, name, access_code, is_paid, is_locked, price, shoot_type, created_at, cover_photo_url')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      const galList = gals || [];

      // Sign cover photos
      const signedGals: Gallery[] = await Promise.all(galList.map(async (g: any) => ({
        ...g,
        photo_count: 0,
        cover_signed_url: g.cover_photo_url ? await signUrl(g.cover_photo_url) : null,
      })));

      // Photo counts per gallery
      const galIds = signedGals.map(g => g.id);
      if (galIds.length > 0) {
        const { data: photos } = await supabase
          .from('gallery_photos')
          .select('id, gallery_id, photo_url, file_name, upload_order')
          .in('gallery_id', galIds)
          .order('upload_order');

        const photoRows = photos || [];

        // Sign up to 3 photos per gallery for preview grid
        const signed: Photo[] = await Promise.all(
          photoRows.slice(0, 60).map(async (p: any) => ({
            ...p,
            signed_url: await signUrl(p.photo_url),
          }))
        );

        // Count per gallery
        const countMap = new Map<string, number>();
        photoRows.forEach((p: any) => countMap.set(p.gallery_id, (countMap.get(p.gallery_id) || 0) + 1));
        signedGals.forEach(g => (g.photo_count = countMap.get(g.id) || 0));

        setAllPhotos(signed);

        // Analytics
        const totalRevenue = signedGals.filter(g => g.is_paid).reduce((s, g) => s + (g.price || 0), 0);
        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id);

        setAnalytics({
          totalPhotos: photoRows.length,
          totalGalleries: signedGals.length,
          paidGalleries: signedGals.filter(g => g.is_paid).length,
          unpaidGalleries: signedGals.filter(g => !g.is_paid).length,
          totalRevenue,
          totalMessages: msgCount || 0,
        });
      }

      setGalleries(signedGals);
    } catch (e) { console.error('loadGalleries', e); }
    finally { setGLoading(false); }
  };

  const loadGalleryPhotos = async (gallery: Gallery) => {
    setSelectedGallery(gallery);
    const { data } = await supabase
      .from('gallery_photos')
      .select('id, gallery_id, photo_url, file_name, upload_order')
      .eq('gallery_id', gallery.id)
      .order('upload_order');
    const signed: Photo[] = await Promise.all(
      (data || []).map(async (p: any) => ({ ...p, signed_url: await signUrl(p.photo_url) }))
    );
    setGalleryPhotos(signed);
  };

  /* ── Gallery actions ───────────────────────────────────── */
  const toggleLock = async (galleryId: string, current: boolean) => {
    setActionLoading(galleryId);
    await supabase.from('galleries').update({ is_locked: !current }).eq('id', galleryId);
    setGalleries(prev => prev.map(g => g.id === galleryId ? { ...g, is_locked: !current } : g));
    setActionLoading(null);
  };

  const markPaid = async (galleryId: string) => {
    setActionLoading(galleryId);
    await supabase.from('galleries').update({ is_paid: true, is_locked: false }).eq('id', galleryId);
    setGalleries(prev => prev.map(g => g.id === galleryId ? { ...g, is_paid: true, is_locked: false } : g));
    setActionLoading(null);
  };

  const copyCode = (galleryId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(galleryId);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  /* ── Chat ───────────────────────────────────────────────── */
  const loadMessages = useCallback(async () => {
    setMsgLoading(true);
    // messages.client_id references user_profiles(id), use client.user_id
    const userId = client.user_id || client.id;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('client_id', userId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    await supabase.from('messages').update({ is_read: true })
      .eq('client_id', userId).eq('sender_role', 'client');
    setMsgLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100);
  }, [client.id, client.user_id]);

  const subscribeMessages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = client.user_id || client.id;

    if (msgChannelRef.current) supabase.removeChannel(msgChannelRef.current);
    const ch = supabase.channel(`client_chat_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${userId}` }, payload => {
        const m = payload.new as Message;
        setMessages(prev => prev.some(p => p.id === m.id) ? prev : [...prev, m]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
      })
      .subscribe();
    msgChannelRef.current = ch;

    if (presenceRef.current) { clearInterval(presenceRef.current.interval); supabase.removeChannel(presenceRef.current.channel); }
    const presence = supabase.channel(`presence_admin_${user.id}`)
      .on('broadcast', { event: 'status' }, (msg: any) => {
        const p = msg?.payload || {};
        if (p.role === 'client' && p.clientId === client.id) setIsOnline(true);
      })
      .subscribe();
    const ping = () => presence.send({ type: 'broadcast', event: 'status', payload: { role: 'admin', userId: user.id } } as any);
    ping();
    const interval = setInterval(ping, 15000);
    presenceRef.current = { channel: presence, interval };
  }, [client.id]);

  useEffect(() => {
    if (tab === 'chat') { loadMessages(); subscribeMessages(); }
  }, [tab, loadMessages, subscribeMessages]);

  const sendMessage = async (text?: string) => {
    const content = (text || newMessage).trim();
    if (!content || sending) return;
    setSending(true);
    const localId = 'local-' + Date.now();
    setMessages(prev => [...prev, { id: localId, content, sender_role: 'admin', created_at: new Date().toISOString(), pending: true }]);
    if (!text) setNewMessage('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // messages.client_id references user_profiles(id), use client.user_id
      let resolvedUserId = client.user_id || client.id;

      const { data: msg, error } = await supabase.from('messages').insert({
        client_id: resolvedUserId,
        owner_admin_id: user.id,
        content,
        sender_role: 'admin',
        is_read: false,
      }).select().single();
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === localId ? { ...msg, pending: false } : m));
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== localId));
      console.error('sendMessage error:', e?.message);
    } finally { setSending(false); }
  };

  const loyaltyStyle = LOYALTY[client.loyalty_level || 'Bronze'] || LOYALTY.Bronze;

  return (
    <div className="space-y-6">
      {/* Back + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>
          ← All Clients
        </button>
        <a href={`/dashboard/upload?clientId=${client.id}`}
          style={{ background: 'linear-gradient(135deg,#D4AF37,#F0D060)', color: '#080810', fontWeight: 700, borderRadius: 12, padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}>
          ⬆️ Upload Gallery
        </a>
        <button onClick={() => setTab('chat')}
          style={{ background: tab === 'chat' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (tab === 'chat' ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'), borderRadius: 12, padding: '8px 16px', color: tab === 'chat' ? '#D4AF37' : 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>
          💬 Message
        </button>
      </div>

      {/* Client header card */}
      <div className="premium-card p-6">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#D4AF37', flexShrink: 0 }}>
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white' }}>{client.name}</h1>
              <span style={{ ...loyaltyStyle, padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                {client.loyalty_level || 'Bronze'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {client.phone && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>📱 {client.phone}</span>}
              {client.email && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>✉️ {client.email}</span>}
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                Since {new Date(client.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Analytics strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'Total Photos',   value: analytics.totalPhotos,    color: '#0A84FF' },
            { label: 'Galleries',      value: analytics.totalGalleries,  color: '#D4AF37' },
            { label: 'Paid',           value: analytics.paidGalleries,   color: '#34C759' },
            { label: 'Unpaid',         value: analytics.unpaidGalleries, color: '#FF9F0A' },
            { label: 'Total Revenue',  value: analytics.totalRevenue > 0 ? `KES ${analytics.totalRevenue.toLocaleString()}` : '—', color: '#D4AF37' },
            { label: 'Messages',       value: analytics.totalMessages,   color: '#AF52DE' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {(['photos', 'chat'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', borderRadius: '12px 12px 0 0', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: tab === t ? 'linear-gradient(135deg,#D4AF37,#F0D060)' : 'transparent', color: tab === t ? '#080810' : 'rgba(255,255,255,0.4)' }}>
            {t === 'photos' ? '🖼️ Photos & Galleries' : '💬 Chat'}
          </button>
        ))}
      </div>

      {/* ── PHOTOS TAB ──────────────────────────────────────── */}
      {tab === 'photos' && (
        gLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>Loading galleries…</div>
        ) : galleries.length === 0 ? (
          <div className="premium-card p-10 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No galleries yet.{' '}
            <a href={`/dashboard/upload?clientId=${client.id}`} style={{ color: '#D4AF37' }}>Upload the first one →</a>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Gallery cards */}
            {galleries.map(g => {
              const photosForGallery = allPhotos.filter(p => p.gallery_id === g.id);
              return (
                <div key={g.id} className="premium-card overflow-hidden">
                  {/* Gallery header */}
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                    {/* Cover thumbnail */}
                    {g.cover_signed_url ? (
                      <img src={g.cover_signed_url} alt="cover"
                        style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🖼️</div>
                    )}
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: 'white' }}>{g.name}</p>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: g.is_paid ? 'rgba(52,199,89,0.15)' : 'rgba(255,159,10,0.15)', color: g.is_paid ? '#34C759' : '#FF9F0A' }}>
                          {g.is_paid ? 'Paid' : 'Unpaid'}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: g.is_locked ? 'rgba(255,59,48,0.12)' : 'rgba(10,132,255,0.12)', color: g.is_locked ? '#FF3B30' : '#0A84FF' }}>
                          {g.is_locked ? '🔒 Locked' : '🔓 Unlocked'}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {g.photo_count} photos · {g.shoot_type} · {new Date(g.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {g.price > 0 && ` · KES ${g.price.toLocaleString()}`}
                      </p>
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => copyCode(g.id, g.access_code)}
                        style={{ fontFamily: 'monospace', fontWeight: 700, color: '#D4AF37', fontSize: 13, letterSpacing: 1, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                        {copiedCode === g.id ? '✅ Copied' : g.access_code}
                      </button>
                      <button onClick={() => toggleLock(g.id, g.is_locked)} disabled={actionLoading === g.id}
                        style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
                        {g.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                      </button>
                      {!g.is_paid && (
                        <button onClick={() => markPaid(g.id)} disabled={actionLoading === g.id}
                          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(52,199,89,0.2)', background: 'rgba(52,199,89,0.08)', color: '#34C759', fontSize: 12, cursor: 'pointer' }}>
                          ✅ Mark Paid
                        </button>
                      )}
                      <button onClick={() => loadGalleryPhotos(g)}
                        style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
                        View All
                      </button>
                    </div>
                  </div>

                  {/* Photo grid — first 12 photos */}
                  {photosForGallery.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 4, padding: 12 }}>
                      {photosForGallery.slice(0, 12).map(p => (
                        <div key={p.id} onClick={() => setLightboxPhoto(p)}
                          style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'rgba(255,255,255,0.04)' }}>
                          {p.signed_url ? (
                            <img src={p.signed_url} alt={p.file_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.15s' }}
                              onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                              onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📷</div>
                          )}
                        </div>
                      ))}
                      {photosForGallery.length > 12 && (
                        <div onClick={() => loadGalleryPhotos(g)}
                          style={{ aspectRatio: '1', borderRadius: 8, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}>
                          <span style={{ fontSize: 20, color: '#D4AF37' }}>+{photosForGallery.length - 12}</span>
                          <span style={{ fontSize: 10, color: 'rgba(212,175,55,0.7)' }}>more</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '20px 18px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No photos uploaded yet.</div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── CHAT TAB ───────────────────────────────────────── */}
      {tab === 'chat' && (
        <div className="premium-card overflow-hidden" style={{ height: 560, display: 'flex', flexDirection: 'column' }}>
          {/* Chat header */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10, background: '#0F0F1A' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#D4AF37', flexShrink: 0 }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'white' }}>{client.name}</p>
              <p style={{ fontSize: 11, color: isOnline ? '#34C759' : 'rgba(255,255,255,0.3)' }}>
                {isOnline ? '● Online' : '○ Offline'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                No messages yet. Send the first one!
              </div>
            ) : messages.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_role === 'admin' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '70%', padding: '10px 14px', borderRadius: m.sender_role === 'admin' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.sender_role === 'admin' ? '#D4AF37' : 'rgba(255,255,255,0.08)',
                  color: m.sender_role === 'admin' ? '#080810' : 'white',
                  opacity: m.pending ? 0.6 : 1,
                  fontSize: 14,
                }}>
                  <p>{m.content}</p>
                  <p style={{ fontSize: 10, marginTop: 4, color: m.sender_role === 'admin' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.4)' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.pending && ' · sending…'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick replies */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
              {QUICK_REPLIES.map((r, i) => (
                <button key={i} onClick={() => sendMessage(r)}
                  style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={1} placeholder="Type a message… (Enter to send)"
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 14, outline: 'none', resize: 'none', maxHeight: 100 }} />
            <button onClick={() => sendMessage()} disabled={!newMessage.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: 12, background: '#D4AF37', border: 'none', color: '#080810', fontSize: 18, cursor: 'pointer', opacity: (!newMessage.trim() || sending) ? 0.4 : 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {sending ? '…' : '→'}
            </button>
          </div>
        </div>
      )}

      {/* ── Full gallery modal ──────────────────────────────── */}
      {selectedGallery && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px', background: '#0F0F1A', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => { setSelectedGallery(null); setGalleryPhotos([]); }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: '6px 14px', color: 'white', cursor: 'pointer', fontSize: 13 }}>
              ← Back
            </button>
            <p style={{ fontWeight: 700, color: 'white' }}>{selectedGallery.name}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{galleryPhotos.length} photos</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
            {galleryPhotos.map(p => (
              <div key={p.id} onClick={() => setLightboxPhoto(p)}
                style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}>
                {p.signed_url
                  ? <img src={p.signed_url} alt={p.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lightbox ────────────────────────────────────────── */}
      {lightboxPhoto && (
        <div onClick={() => setLightboxPhoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          {lightboxPhoto.signed_url
            ? <img src={lightboxPhoto.signed_url} alt={lightboxPhoto.file_name}
                style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
            : <div style={{ color: 'white', fontSize: 16 }}>Image unavailable</div>
          }
          <button onClick={() => setLightboxPhoto(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: 'white', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
}
