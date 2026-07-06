'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type FeatureFlag = {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  category: string;
  updated_at: string;
};

const DEFAULT_FLAGS: Omit<FeatureFlag, 'id' | 'updated_at'>[] = [
  { key: 'mpesa_enabled', label: 'M-Pesa Payments', description: 'Enable M-Pesa STK push and manual payment flows', enabled: true, category: 'Payments' },
  { key: 'sms_enabled', label: 'SMS Notifications', description: 'Enable Africa\'s Talking SMS for gallery notifications', enabled: true, category: 'Communication' },
  { key: 'whatsapp_enabled', label: 'WhatsApp Business', description: 'Enable WhatsApp Business API for gallery sharing', enabled: false, category: 'Communication' },
  { key: 'ussd_enabled', label: 'USSD Access', description: 'Enable USSD short code gallery access (*384#)', enabled: true, category: 'Access' },
  { key: 'compression_enabled', label: 'Image Compression', description: 'Enable automatic image compression on upload', enabled: true, category: 'Storage' },
  { key: 'offline_mode_enabled', label: 'Offline Gallery Mode', description: 'Allow clients to cache galleries for offline viewing', enabled: false, category: 'Access' },
  { key: 'referral_program_enabled', label: 'Referral Program', description: 'Enable photographer referral rewards', enabled: true, category: 'Growth' },
  { key: 'bts_sharing_enabled', label: 'BTS Social Sharing', description: 'Allow photographers to share BTS to Instagram/Facebook', enabled: true, category: 'Growth' },
  { key: 'calendar_enabled', label: 'Event Calendar', description: 'Enable event calendar and scheduling features', enabled: true, category: 'Features' },
  { key: 'reviews_enabled', label: 'Client Reviews', description: 'Enable client review collection after payment', enabled: true, category: 'Features' },
  { key: 'watermark_enabled', label: 'Photo Watermarks', description: 'Apply watermarks to gallery previews', enabled: true, category: 'Storage' },
  { key: 'installments_enabled', label: 'Installment Payments', description: 'Allow clients to pay in installments', enabled: false, category: 'Payments' },
  { key: 'google_business_enabled', label: 'Google Business Profile', description: 'Sync galleries to Google Business for discovery', enabled: false, category: 'Growth' },
  { key: 'fraud_detection_enabled', label: 'Fraud Detection', description: 'Auto-detect suspicious payment and access patterns', enabled: true, category: 'Security' },
  { key: 'free_lifetime_bypass', label: 'Free Lifetime Access', description: 'Allow lifetime access users to bypass all payments', enabled: true, category: 'Access' },
];

export default function FeaturesPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('feature_flags').select('*').order('category');
      if (data?.length) {
        setFlags(data);
      } else {
        setFlags(DEFAULT_FLAGS.map((f, i) => ({
          ...f,
          id: `default-${i}`,
          updated_at: new Date().toISOString(),
        })));
      }
    } catch (e) {
      setFlags(DEFAULT_FLAGS.map((f, i) => ({
        ...f,
        id: `default-${i}`,
        updated_at: new Date().toISOString(),
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  const toggleFlag = async (flag: FeatureFlag) => {
    setSaving(flag.id);
    try {
      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          id: flag.id.startsWith('default-') ? undefined : flag.id,
          key: flag.key,
          label: flag.label,
          description: flag.description,
          enabled: !flag.enabled,
          category: flag.category,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (!error) {
        setFlags(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: !f.enabled } : f));
      }
    } catch (e) {
      console.error(e);
    }
    setSaving(null);
  };

  const categories = Array.from(new Set(flags.map(f => f.category)));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Feature Flags</h1>
          <p className="text-gray-400 mt-1">Enable or disable platform features globally</p>
        </div>
        <button onClick={loadFlags} disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Total Features</p>
          <p className="text-3xl font-black" style={{ color: '#D4AF37' }}>{flags.length}</p>
        </div>
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Enabled</p>
          <p className="text-3xl font-black" style={{ color: '#34C759' }}>{flags.filter(f => f.enabled).length}</p>
        </div>
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Disabled</p>
          <p className="text-3xl font-black" style={{ color: '#FF3B30' }}>{flags.filter(f => !f.enabled).length}</p>
        </div>
      </div>

      {/* Flags by Category */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(212,175,55,0.4)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        categories.map(category => (
          <div key={category}>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: '#D4AF37' }} />
              {category}
            </h2>
            <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden mb-6">
              <div className="divide-y divide-white/5">
                {flags.filter(f => f.category === category).map(flag => (
                  <div key={flag.key} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white">{flag.label}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{flag.description}</p>
                    </div>
                    <button
                      onClick={() => toggleFlag(flag)}
                      disabled={saving === flag.id}
                      className="relative w-12 h-6 rounded-full transition-colors"
                      style={{ background: flag.enabled ? '#34C759' : 'rgba(255,255,255,0.1)' }}>
                      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                        style={{ left: flag.enabled ? '26px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
