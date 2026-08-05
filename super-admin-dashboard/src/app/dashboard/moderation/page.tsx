'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type ContentItem = {
  id: string;
  type: 'bts_post' | 'announcement';
  title: string;
  description: string;
  media_url: string | null;
  media_type: string | null;
  visibility: string;
  is_active: boolean;
  created_at: string;
  admin_name: string;
  admin_avatar: string | null;
  likes_count: number;
  comments_count: number;
};

export default function ModerationPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const adminMap = new Map<string, { name: string; avatar: string | null }>();

      // Fetch BTS posts
      const { data: btsPosts } = await supabase
        .from('bts_posts')
        .select('id, title, caption, media_url, media_type, visibility, is_active, created_at, created_by, likes_count, comments_count')
        .order('created_at', { ascending: false });

      // Fetch announcements
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, title, description, media_url, visibility, is_active, created_at, created_by, owner_admin_id')
        .order('created_at', { ascending: false });

      // Collect all admin IDs
      const adminIds = new Set<string>();
      btsPosts?.forEach(p => { if (p.created_by) adminIds.add(p.created_by); });
      announcements?.forEach(a => { if (a.created_by) adminIds.add(a.created_by); if (a.owner_admin_id) adminIds.add(a.owner_admin_id); });

      // Fetch admin profiles
      if (adminIds.size > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, name, avatar_url')
          .in('id', Array.from(adminIds));

        profiles?.forEach(p => adminMap.set(p.id, { name: p.name || 'Unknown', avatar: p.avatar_url }));
      }

      const allItems: ContentItem[] = [];

      // Map BTS posts
      btsPosts?.forEach(p => {
        const admin = adminMap.get(p.created_by || '');
        allItems.push({
          id: p.id,
          type: 'bts_post',
          title: p.title || 'Untitled BTS',
          description: p.caption || '',
          media_url: p.media_url,
          media_type: p.media_type,
          visibility: p.visibility || 'admin_only',
          is_active: p.is_active ?? true,
          created_at: p.created_at,
          admin_name: admin?.name || 'Unknown',
          admin_avatar: admin?.avatar || null,
          likes_count: p.likes_count || 0,
          comments_count: p.comments_count || 0,
        });
      });

      // Map announcements
      announcements?.forEach(a => {
        const admin = adminMap.get(a.created_by || a.owner_admin_id || '');
        allItems.push({
          id: a.id,
          type: 'announcement',
          title: a.title || 'Untitled Announcement',
          description: a.description || '',
          media_url: a.media_url,
          media_type: null,
          visibility: a.visibility || 'assigned_only',
          is_active: a.is_active ?? true,
          created_at: a.created_at,
          admin_name: admin?.name || 'Unknown',
          admin_avatar: admin?.avatar || null,
          likes_count: 0,
          comments_count: 0,
        });
      });

      // Sort by created_at descending
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(allItems);
    } catch (e) {
      console.error('Failed to load moderation data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleActive = async (item: ContentItem) => {
    const newActive = !item.is_active;
    const table = item.type === 'bts_post' ? 'bts_posts' : 'announcements';

    const { error } = await supabase
      .from(table)
      .update({ is_active: newActive })
      .eq('id', item.id);

    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: newActive } : i));
    }
  };

  const filtered = items.filter(i => {
    if (filterType !== 'all' && i.type !== filterType) return false;
    if (filterStatus === 'active' && !i.is_active) return false;
    if (filterStatus === 'inactive' && i.is_active) return false;
    return true;
  });

  const stats = {
    total: items.length,
    bts: items.filter(i => i.type === 'bts_post').length,
    announcements: items.filter(i => i.type === 'announcement').length,
    active: items.filter(i => i.is_active).length,
    inactive: items.filter(i => !i.is_active).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Content Moderation</h1>
          <p className="text-gray-400 mt-1">Review and manage BTS posts and announcements from all photographers</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Content', value: stats.total, color: '#007AFF' },
          { label: 'BTS Posts', value: stats.bts, color: '#8B5CF6' },
          { label: 'Announcements', value: stats.announcements, color: '#F59E0B' },
          { label: 'Active', value: stats.active, color: '#34C759' },
          { label: 'Inactive', value: stats.inactive, color: '#FF3B30' },
        ].map((s, i) => (
          <div key={i} className="bg-[#111118] border border-white/5 rounded-2xl p-5">
            <p className="text-sm font-semibold text-gray-400 mb-1">{s.label}</p>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2">
          {['all', 'bts_post', 'announcement'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
              style={filterType === t
                ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              {t === 'all' ? 'All Types' : t === 'bts_post' ? 'BTS Posts' : 'Announcements'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
              style={filterStatus === s
                ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content List */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-bold">Content Items ({filtered.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgba(212,175,55,0.4)', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-gray-400 font-semibold">No content found</p>
            <p className="text-sm text-gray-500 mt-1">Adjust filters or check back later</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(item => (
              <div key={item.id} className="px-6 py-5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-4">
                  {/* Admin Avatar */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
                    {item.admin_avatar ? (
                      <img src={item.admin_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      item.admin_name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold text-white truncate">{item.title}</p>
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase flex-shrink-0"
                        style={{
                          background: item.type === 'bts_post' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)',
                          color: item.type === 'bts_post' ? '#8B5CF6' : '#F59E0B',
                        }}>
                        {item.type === 'bts_post' ? 'BTS' : 'Announcement'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold capitalize flex-shrink-0"
                        style={{
                          background: item.visibility === 'global' ? 'rgba(52,199,89,0.15)' : 'rgba(255,159,10,0.15)',
                          color: item.visibility === 'global' ? '#34C759' : '#FF9F0A',
                        }}>
                        {item.visibility}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-1">by {item.admin_name}</p>
                    {item.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <span>{new Date(item.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {item.media_url && <span className="text-blue-400">Has media</span>}
                      {item.likes_count > 0 && <span>{item.likes_count} likes</span>}
                      {item.comments_count > 0 && <span>{item.comments_count} comments</span>}
                    </div>
                  </div>

                  {/* Media Preview */}
                  {item.media_url && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Toggle Active */}
                  <button onClick={() => toggleActive(item)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                    style={item.is_active
                      ? { background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.3)', color: '#34C759' }
                      : { background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.3)', color: '#FF3B30' }
                    }>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
