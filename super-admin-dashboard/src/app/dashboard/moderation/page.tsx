'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type FlaggedContent = {
  id: string;
  content_type: string;
  content_id: string;
  title: string;
  reported_by: string;
  reason: string;
  status: 'pending' | 'approved' | 'removed' | 'dismissed';
  created_at: string;
  reporter_name: string;
  photographer_name: string;
};

export default function ModerationPage() {
  const [items, setItems] = useState<FlaggedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Try loading from a moderation/flagged_content table
      const { data, error } = await supabase
        .from('content_moderation')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data?.length) {
        // Fallback: check for flagged content in BTS posts
        const { data: btsPosts } = await supabase
          .from('bts_posts')
          .select('id, title, created_at, photographer_id')
          .eq('is_flagged', true)
          .order('created_at', { ascending: false });

        if (btsPosts?.length) {
          const userIds = Array.from(new Set(btsPosts.map(p => p.created_by || p.photographer_id).filter(Boolean)));
          const { data: profiles } = await supabase.from('user_profiles').select('id, name').in('id', userIds);
          const pMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

          setItems(btsPosts.map(p => ({
            id: p.id,
            content_type: 'bts_post',
            content_id: p.id,
            title: p.title || 'Untitled',
            reported_by: '',
            reason: 'Auto-flagged',
            status: 'pending',
            created_at: p.created_at,
            reporter_name: 'System',
            photographer_name: pMap.get(p.photographer_id) || 'Unknown',
          })));
        } else {
          setItems([]);
        }
      } else {
        const userIds = Array.from(new Set([
          ...data.map(d => d.reported_by).filter(Boolean),
          ...data.map(d => d.photographer_id).filter(Boolean),
        ]));
        const { data: profiles } = await supabase.from('user_profiles').select('id, name').in('id', userIds);
        const pMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

        setItems(data.map(d => ({
          ...d,
          reporter_name: pMap.get(d.reported_by) || 'Unknown',
          photographer_name: pMap.get(d.photographer_id) || 'Unknown',
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (id: string, action: 'approved' | 'removed' | 'dismissed', source?: string) => {
    try {
      if (source === 'bts_post') {
        await supabase.from('bts_posts').update({ is_flagged: action === 'removed' }).eq('id', id);
      } else {
        await supabase
          .from('content_moderation')
          .update({ status: action, reviewed_at: new Date().toISOString() })
          .eq('id', id);
      }
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = filterStatus === 'all' ? items : items.filter(i => i.status === filterStatus);

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'rgba(255,159,10,0.1)', text: '#FF9F0A' },
    approved: { bg: 'rgba(52,199,89,0.1)', text: '#34C759' },
    removed: { bg: 'rgba(255,59,48,0.1)', text: '#FF3B30' },
    dismissed: { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.4)' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Content Moderation</h1>
          <p className="text-gray-400 mt-1">Review flagged content and take action</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', value: items.filter(i => i.status === 'pending').length, color: '#FF9F0A' },
          { label: 'Approved', value: items.filter(i => i.status === 'approved').length, color: '#34C759' },
          { label: 'Removed', value: items.filter(i => i.status === 'removed').length, color: '#FF3B30' },
          { label: 'Dismissed', value: items.filter(i => i.status === 'dismissed').length, color: 'rgba(255,255,255,0.4)' },
        ].map((s, i) => (
          <div key={i} className="bg-[#111118] border border-white/5 rounded-2xl p-6">
            <p className="text-sm font-semibold text-gray-400 mb-2">{s.label}</p>
            <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['pending', 'all', 'approved', 'removed', 'dismissed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
            style={filterStatus === s
              ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Flagged Content List */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-bold">Flagged Content ({filtered.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgba(212,175,55,0.4)', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-4xl mb-4">✅</p>
            <p className="text-gray-400 font-semibold">No flagged content</p>
            <p className="text-sm text-gray-500 mt-1">All clear — no items need review</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(item => (
              <div key={item.id} className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-white">{item.title}</p>
                      <span className="px-2 py-1 rounded text-xs font-bold uppercase"
                        style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF' }}>
                        {item.content_type.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-xs font-bold capitalize"
                        style={statusColors[item.status]}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">Photographer: {item.photographer_name}</p>
                    <p className="text-sm text-gray-500 mt-1">Reason: {item.reason}</p>
                    <p className="text-xs text-gray-600 mt-2">
                      Reported by {item.reporter_name} • {new Date(item.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {item.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(item.id, 'approved', item.content_type)}
                        className="text-sm px-4 py-2 rounded-lg font-semibold"
                        style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
                        Approve
                      </button>
                      <button onClick={() => handleAction(item.id, 'removed', item.content_type)}
                        className="text-sm px-4 py-2 rounded-lg font-semibold"
                        style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#FF3B30' }}>
                        Remove
                      </button>
                      <button onClick={() => handleAction(item.id, 'dismissed', item.content_type)}
                        className="text-sm px-4 py-2 rounded-lg font-semibold"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
