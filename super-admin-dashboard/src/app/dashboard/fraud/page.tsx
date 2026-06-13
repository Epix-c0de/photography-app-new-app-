'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type FraudFlag = {
  id: string;
  flagged_user_id: string;
  flagged_by: string;
  flag_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'active' | 'resolved' | 'dismissed';
  resolution_notes: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
};

type FraudPattern = {
  user_id: string;
  pattern_type: string;
  severity: string;
  details: any;
  user_name: string;
  user_email: string;
};

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    low: { bg: 'rgba(52,199,89,0.1)', text: '#34C759' },
    medium: { bg: 'rgba(255,159,10,0.1)', text: '#FF9F0A' },
    high: { bg: 'rgba(255,59,48,0.1)', text: '#FF3B30' },
    critical: { bg: 'rgba(191,90,242,0.1)', text: '#BF5AF2' },
  };
  const color = colors[severity as keyof typeof colors] || colors.low;
  return (
    <span className="px-2 py-1 rounded-lg text-xs font-bold uppercase" style={{ background: color.bg, color: color.text }}>
      {severity}
    </span>
  );
}

export default function FraudDetectionPage() {
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [patterns, setPatterns] = useState<FraudPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'resolved' | 'dismissed'>('active');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagForm, setFlagForm] = useState({
    userId: '',
    type: 'suspicious_activity',
    severity: 'medium',
    description: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load fraud flags
      const { data: flagsData } = await supabase
        .from('fraud_flags')
        .select('*')
        .order('created_at', { ascending: false });

      // Get user details for flags
      if (flagsData?.length) {
        const userIds = Array.from(new Set(flagsData.map(f => f.flagged_user_id)));
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, name, email')
          .in('id', userIds);
        
        const userMap = new Map(users?.map(u => [u.id, u]) || []);
        setFlags(flagsData.map(f => ({
          ...f,
          user_name: userMap.get(f.flagged_user_id)?.name || 'Unknown',
          user_email: userMap.get(f.flagged_user_id)?.email || '',
        })));
      } else {
        setFlags([]);
      }

      // Load auto-detected patterns
      const { data: patternsData } = await supabase.rpc('detect_fraud_patterns');
      
      if (patternsData?.length) {
        const userIds = Array.from(new Set(patternsData.map((p: any) => p.user_id)));
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, name, email')
          .in('id', userIds);
        
        const userMap = new Map(users?.map(u => [u.id, u]) || []);
        setPatterns(patternsData.map((p: any) => ({
          ...p,
          user_name: userMap.get(p.user_id)?.name || 'Unknown',
          user_email: userMap.get(p.user_id)?.email || '',
        })));
      } else {
        setPatterns([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleResolve = async (flagId: string, notes: string) => {
    setActionLoading(flagId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('fraud_flags')
        .update({
          status: 'resolved',
          resolution_notes: notes,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', flagId);
      await loadData();
    } catch (e) {
      console.error(e);
    }
    setActionLoading(null);
  };

  const handleDismiss = async (flagId: string) => {
    if (!confirm('Dismiss this fraud flag?')) return;
    setActionLoading(flagId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('fraud_flags')
        .update({
          status: 'dismissed',
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', flagId);
      await loadData();
    } catch (e) {
      console.error(e);
    }
    setActionLoading(null);
  };

  const handleCreateFlag = async () => {
    if (!flagForm.userId || !flagForm.description) {
      alert('Please fill all fields');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('fraud_flags').insert({
        flagged_user_id: flagForm.userId,
        flagged_by: user?.id,
        flag_type: flagForm.type,
        severity: flagForm.severity,
        description: flagForm.description,
      });
      setShowFlagModal(false);
      setFlagForm({ userId: '', type: 'suspicious_activity', severity: 'medium', description: '' });
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to create flag');
    }
  };

  const filtered = filterStatus === 'all' ? flags : flags.filter(f => f.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Fraud Detection</h1>
          <p className="text-gray-400 mt-1">Monitor and manage suspicious activity</p>
        </div>
        <button
          onClick={() => setShowFlagModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          + Flag User
        </button>
      </div>

      {/* Auto-detected patterns */}
      {patterns.length > 0 && (
        <div className="bg-[#111118] border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-red-500/20 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h2 className="font-bold text-red-400">Auto-Detected Fraud Patterns</h2>
              <p className="text-xs text-gray-500 mt-0.5">{patterns.length} suspicious patterns detected</p>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {patterns.map((p, i) => (
              <div key={i} className="px-6 py-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-white">{p.user_name}</p>
                    <SeverityBadge severity={p.severity} />
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400 capitalize">
                      {p.pattern_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{p.user_email}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    {JSON.stringify(p.details, null, 2)}
                  </div>
                </div>
                <button
                  onClick={() => setFlagForm({ ...flagForm, userId: p.user_id, description: `Auto-detected: ${p.pattern_type}` })}
                  className="text-sm px-4 py-2 rounded-lg font-semibold"
                  style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#FF3B30' }}>
                  Flag User
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'resolved', 'dismissed'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
            style={filterStatus === s
              ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            {s} ({flags.filter(f => s === 'all' || f.status === s).length})
          </button>
        ))}
      </div>

      {/* Flags list */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-bold">Fraud Flags ({filtered.length})</h2>
          {loading && <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />}
        </div>
        <div className="divide-y divide-white/5">
          {filtered.map(flag => (
            <div key={flag.id} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-white">{flag.user_name}</p>
                    <SeverityBadge severity={flag.severity} />
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400 capitalize">
                      {flag.flag_type.replace(/_/g, ' ')}
                    </span>
                    {flag.status !== 'active' && (
                      <span className="text-xs px-2 py-1 rounded-lg font-bold uppercase"
                        style={{ background: flag.status === 'resolved' ? 'rgba(52,199,89,0.1)' : 'rgba(255,255,255,0.05)', 
                                 color: flag.status === 'resolved' ? '#34C759' : 'rgba(255,255,255,0.3)' }}>
                        {flag.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{flag.user_email}</p>
                  <p className="text-sm text-white">{flag.description}</p>
                  {flag.resolution_notes && (
                    <p className="text-xs text-gray-500 mt-2">Resolution: {flag.resolution_notes}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    Flagged {new Date(flag.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                {flag.status === 'active' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const notes = prompt('Resolution notes:');
                        if (notes) handleResolve(flag.id, notes);
                      }}
                      disabled={actionLoading === flag.id}
                      className="text-sm px-4 py-2 rounded-lg font-semibold"
                      style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
                      Resolve
                    </button>
                    <button
                      onClick={() => handleDismiss(flag.id)}
                      disabled={actionLoading === flag.id}
                      className="text-sm px-4 py-2 rounded-lg font-semibold"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-gray-500">
              No fraud flags found
            </div>
          )}
        </div>
      </div>

      {/* Flag modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50" onClick={() => setShowFlagModal(false)}>
          <div className="bg-[#111118] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Flag User for Fraud</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">User ID</label>
                <input
                  type="text"
                  value={flagForm.userId}
                  onChange={e => setFlagForm({ ...flagForm, userId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="User UUID"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Flag Type</label>
                <select
                  value={flagForm.type}
                  onChange={e => setFlagForm({ ...flagForm, type: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white">
                  <option value="suspicious_activity">Suspicious Activity</option>
                  <option value="payment_fraud">Payment Fraud</option>
                  <option value="content_violation">Content Violation</option>
                  <option value="spam">Spam</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Severity</label>
                <select
                  value={flagForm.severity}
                  onChange={e => setFlagForm({ ...flagForm, severity: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Description</label>
                <textarea
                  value={flagForm.description}
                  onChange={e => setFlagForm({ ...flagForm, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white h-24"
                  placeholder="Describe the suspicious activity..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateFlag}
                  className="flex-1 px-4 py-2 rounded-lg font-bold"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
                  Create Flag
                </button>
                <button
                  onClick={() => setShowFlagModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
