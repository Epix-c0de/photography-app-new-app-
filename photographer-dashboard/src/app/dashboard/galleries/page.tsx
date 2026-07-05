'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { generateAccessCodeLink, type BrandSettings } from '@/lib/shareable-links';
import Link from 'next/link';

type Gallery = {
  id: string;
  name: string;
  access_code: string;
  is_paid: boolean;
  is_locked: boolean;
  price: number;
  shoot_type: string;
  created_at: string;
  cover_photo_url: string | null;
  client_id: string;
  clientName: string;
  photoCount: number;
};

const S = {
  card: { background: 'linear-gradient(135deg, rgba(212,175,55,0.04) 0%, rgba(13,13,25,0.8) 100%)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: 20, overflow: 'hidden' as const, transition: 'all 0.2s' },
  input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '11px 16px', color: 'white', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  btn: (color: string) => ({ padding: '7px 14px', borderRadius: 10, border: `1px solid ${color}30`, background: `${color}10`, color, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }),
  badge: (paid: boolean) => ({ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: paid ? 'rgba(52,199,89,0.15)' : 'rgba(255,159,10,0.15)', color: paid ? '#34C759' : '#FF9F0A' }),
  lockBadge: (locked: boolean) => ({ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: locked ? 'rgba(255,59,48,0.15)' : 'rgba(10,132,255,0.15)', color: locked ? '#FF3B30' : '#0A84FF' }),
};

export default function GalleriesPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'locked'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadGalleries = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('galleries')
      .select('id, name, access_code, is_paid, is_locked, price, shoot_type, created_at, cover_photo_url, client_id')
      .eq('owner_admin_id', user.id)
      .order('created_at', { ascending: false });

    const clientIds = [...new Set((data || []).map((g: any) => g.client_id).filter(Boolean))];
    let clientMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
      (clients || []).forEach((c: any) => clientMap.set(c.id, c.name));
    }

    const galleryIds = (data || []).map((g: any) => g.id);
    let photoCounts = new Map<string, number>();
    if (galleryIds.length > 0) {
      const { data: photos } = await supabase.from('gallery_photos').select('gallery_id').in('gallery_id', galleryIds);
      (photos || []).forEach((p: any) => photoCounts.set(p.gallery_id, (photoCounts.get(p.gallery_id) || 0) + 1));
    }

    setGalleries((data || []).map((g: any) => ({
      ...g,
      clientName: clientMap.get(g.client_id) || 'Unknown',
      photoCount: photoCounts.get(g.id) || 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadGalleries(); }, [loadGalleries]);

  const toggleLock = async (id: string, current: boolean) => {
    setActionLoading(id);
    await supabase.from('galleries').update({ is_locked: !current }).eq('id', id);
    await loadGalleries();
    setActionLoading(null);
    showToast(current ? 'Gallery unlocked' : 'Gallery locked');
  };

  const markPaid = async (id: string) => {
    setActionLoading(id);
    await supabase.from('galleries').update({ is_paid: true, is_locked: false }).eq('id', id);
    await loadGalleries();
    setActionLoading(null);
    showToast('Gallery marked as paid and unlocked');
  };

  const deleteGallery = async (id: string) => {
    setActionLoading(id);
    // Delete photos first
    await supabase.from('gallery_photos').delete().eq('gallery_id', id);
    await supabase.from('galleries').delete().eq('id', id);
    setDeleteConfirm(null);
    await loadGalleries();
    setActionLoading(null);
    showToast('Gallery deleted');
  };

  const promoteToAnnouncement = async (gallery: Gallery) => {
    setActionLoading(gallery.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('announcements').insert({
        title: `New Gallery: ${gallery.name}`,
        description: `Check out the photos from ${gallery.name}!`,
        is_active: true,
        owner_admin_id: user!.id,
        created_by: user!.id,
      });
      showToast('Promoted to announcement!');
    } catch { showToast('Failed to promote'); }
    setActionLoading(null);
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Access code copied!');
  };

  const copyShareLink = async (code: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('user_profiles').select('brand_name, business_name').eq('id', user.id).single();
    const brandName = profile?.brand_name || profile?.business_name || 'Studio';
    const link = generateAccessCodeLink(code, { brand_name: brandName, brand_slug: brandName.toLowerCase().replace(/\s+/g, '-') });
    navigator.clipboard.writeText(link);
    showToast('Share link copied!');
  };

  const filtered = galleries.filter((g) => {
    const matchSearch = !search || g.name?.toLowerCase().includes(search.toLowerCase()) || g.clientName?.toLowerCase().includes(search.toLowerCase()) || g.access_code?.toLowerCase().includes(search.toLowerCase());
    if (filter === 'paid') return matchSearch && g.is_paid;
    if (filter === 'unpaid') return matchSearch && !g.is_paid;
    if (filter === 'locked') return matchSearch && g.is_locked;
    return matchSearch;
  });

  const counts = { all: galleries.length, paid: galleries.filter(g => g.is_paid).length, unpaid: galleries.filter(g => !g.is_paid).length, locked: galleries.filter(g => g.is_locked).length };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, background: 'rgba(13,13,25,0.95)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 14, padding: '12px 20px', color: '#D4AF37', fontWeight: 600, fontSize: 14, zIndex: 100, backdropFilter: 'blur(20px)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white' }}>Galleries</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 4, fontSize: 14 }}>{galleries.length} total · {counts.paid} paid · {counts.unpaid} unpaid</p>
        </div>
        <Link href="/dashboard/upload" style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810', fontWeight: 700, borderRadius: 14, padding: '10px 20px', fontSize: 14, textDecoration: 'none' }}>
          + Upload New
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
        <input type="text" placeholder="Search galleries, clients, or codes..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ ...S.input, maxWidth: 360 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'paid', 'unpaid', 'locked'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '10px 16px', borderRadius: 12, border: filter === f ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.08)', background: filter === f ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)', color: filter === f ? '#D4AF37' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' as const }}>
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>Loading galleries...</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...S.card, padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
          No galleries found.{' '}
          <Link href="/dashboard/upload" style={{ color: '#D4AF37', textDecoration: 'none' }}>Upload your first gallery →</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map((g) => (
            <div key={g.id} style={S.card}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.1)')}>

              {/* Cover image */}
              <div style={{ height: 140, background: '#0A0A0E', position: 'relative', overflow: 'hidden' }}>
                {g.cover_photo_url ? (
                  <img src={g.cover_photo_url.startsWith('http') ? g.cover_photo_url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-photos/${g.cover_photo_url}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: 'rgba(255,255,255,0.1)' }}>🖼️</div>
                )}
                {/* Overlay badges */}
                <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                  <span style={S.badge(g.is_paid)}>{g.is_paid ? 'Paid' : 'Unpaid'}</span>
                  <span style={S.lockBadge(g.is_locked)}>{g.is_locked ? '🔒' : '🔓'}</span>
                </div>
                {/* Photo count */}
                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '3px 8px', fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                  {g.photoCount} photos
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: '14px 16px' }}>
                <p style={{ fontWeight: 800, fontSize: 15, color: 'white', marginBottom: 3 }}>{g.name}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{g.clientName} · {g.shoot_type}</p>
                {g.price > 0 && <p style={{ fontSize: 14, fontWeight: 800, color: '#D4AF37', marginBottom: 10 }}>KES {g.price.toLocaleString()}</p>}

                {/* Access code row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#D4AF37', fontSize: 15, letterSpacing: 2, flex: 1 }}>{g.access_code}</span>
                  <button onClick={() => copyCode(g.id, g.access_code)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.5)' }} title="Copy code">
                    {copiedId === g.id ? '✅' : '📋'}
                  </button>
                  <button onClick={() => copyShareLink(g.access_code)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.5)' }} title="Copy share link">
                    🔗
                  </button>
                </div>

                {/* USSD Code */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '6px 12px', marginBottom: 12, border: '1px solid rgba(212,175,55,0.1)' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>USSD:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#D4AF37', fontSize: 13, letterSpacing: 1, flex: 1 }}>*123*{g.access_code?.replace('-', '')}#</span>
                  <button onClick={() => { navigator.clipboard.writeText(`*123*${g.access_code?.replace('-', '')}#`); showToast('USSD code copied!'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.4)' }} title="Copy USSD">
                    📋
                  </button>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  <button onClick={() => toggleLock(g.id, g.is_locked)} disabled={actionLoading === g.id}
                    style={{ ...S.btn(g.is_locked ? '#0A84FF' : '#FF9F0A'), flex: 1 }}>
                    {g.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                  </button>
                  {!g.is_paid && (
                    <button onClick={() => markPaid(g.id)} disabled={actionLoading === g.id}
                      style={{ ...S.btn('#34C759'), flex: 1 }}>
                      ✅ Mark Paid
                    </button>
                  )}
                  <button onClick={() => promoteToAnnouncement(g)} disabled={actionLoading === g.id}
                    style={S.btn('#AF52DE')} title="Promote to announcement">
                    📢
                  </button>
                  <button onClick={() => setDeleteConfirm(g.id)} disabled={actionLoading === g.id}
                    style={S.btn('#FF3B30')} title="Delete gallery">
                    🗑️
                  </button>
                </div>

                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 10 }}>
                  {new Date(g.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#13131F', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 24, padding: 32, maxWidth: 400, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Delete Gallery?</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>This will permanently delete the gallery and all its photos. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => deleteGallery(deleteConfirm)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: '#FF3B30', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
