'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Photographer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  sms_credits: number;
};

export default function BulkSmsPage() {
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const loadPhotographers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, name, email, phone, sms_credits')
        .eq('role', 'admin')
        .order('name');

      setPhotographers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPhotographers(); }, [loadPhotographers]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selectAll) {
      setSelected(new Set());
    } else {
      setSelected(new Set(photographers.map(p => p.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSend = async () => {
    if (!message.trim() || selected.size === 0) return;
    if (!confirm(`Send SMS to ${selected.size} photographers?`)) return;

    setSending(true);
    setResult(null);
    let sent = 0;
    let failed = 0;

    // Send in batches of 5 to avoid rate limits
    const batchSize = 5;
    const ids = Array.from(selected);
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (photographerId) => {
          const p = photographers.find(ph => ph.id === photographerId);
          if (!p?.phone) throw new Error('No phone');
          const { error } = await supabase.functions.invoke('send-sms', {
            body: {
              to: p.phone,
              message: message.replace(/{name}/g, p.name).replace(/{credits}/g, String(p.sms_credits)),
            },
          });
          if (error) throw error;
        })
      );
      results.forEach(r => r.status === 'fulfilled' ? sent++ : failed++);
    }

    setResult({ sent, failed });
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Bulk SMS</h1>
          <p className="text-gray-400 mt-1">Send SMS messages to all photographers at once</p>
        </div>
        <span className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
          {selected.size} selected
        </span>
      </div>

      {/* Compose */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="font-bold">Compose Message</h2>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white h-32 text-sm"
          placeholder="Type your SMS message... Use {name} for photographer name, {credits} for SMS credits."
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{message.length} characters • Supports {'{name}'} and {'{credits}'} variables</p>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || selected.size === 0}
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            {sending ? 'Sending...' : `Send to ${selected.size} photographers`}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-[#111118] border rounded-2xl p-6"
          style={{ borderColor: result.failed > 0 ? 'rgba(255,159,10,0.3)' : 'rgba(52,199,89,0.3)' }}>
          <p className="font-bold" style={{ color: result.failed > 0 ? '#FF9F0A' : '#34C759' }}>
            SMS Sent: {result.sent} delivered, {result.failed} failed
          </p>
        </div>
      )}

      {/* Photographer List */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-bold">Photographers ({photographers.length})</h2>
          <button onClick={toggleAll}
            className="text-sm px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
            {selectAll ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgba(212,175,55,0.4)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {photographers.map(p => (
              <div key={p.id} className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/2"
                onClick={() => toggleSelect(p.id)}>
                <div className="w-5 h-5 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: selected.has(p.id) ? '#D4AF37' : 'rgba(255,255,255,0.2)', background: selected.has(p.id) ? '#D4AF37' : 'transparent' }}>
                  {selected.has(p.id) && <span className="text-xs font-bold" style={{ color: '#080810' }}>✓</span>}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{p.phone || 'No phone'}</p>
                  <p className="text-xs text-gray-500">{p.sms_credits ?? 0} credits</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
