'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const SUPER_ADMIN_WHATSAPP_KEY = 'platform_whatsapp_number';

const REFILL_AMOUNTS = [100, 250, 500, 1000];

export default function SettingsPage() {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [mpesa, setMpesa] = useState({ shortcode: '', till_number: '', business_name: '', environment: 'sandbox' as 'sandbox' | 'production' });
  const [subscription, setSubscription] = useState<any>(null);
  const [superAdminWhatsApp, setSuperAdminWhatsApp] = useState('');
  const [appLinks, setAppLinks] = useState({ android: 'https://play.google.com/store', ios: 'https://apps.apple.com' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [smsCredits, setSmsCredits] = useState(0);
  const [smsStats, setSmsStats] = useState({ sent: 0, spent: 0 });
  const [smsPackages, setSmsPackages] = useState<any[]>([]);
  const [storageInfo, setStorageInfo] = useState({ used_mb: 0, total_mb: 10240, extra_mb: 0, galleries: 0 });

  // SMS Refill state
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillAmount, setRefillAmount] = useState(250);
  const [customAmount, setCustomAmount] = useState('');
  const [refillReason, setRefillReason] = useState('');
  const [refilling, setRefilling] = useState(false);
  const [refillSuccess, setRefillSuccess] = useState('');
  const [refillError, setRefillError] = useState('');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prof }, { data: gatewayData }, { data: sub }, { data: platformConfig }, { data: smsData }, { data: packages }, { data: storageAlloc }, { data: storageUsage }, { data: galleries }] = await Promise.all([
      supabase.from('user_profiles').select('name, email, phone, sms_credits').eq('id', user.id).single(),
      supabase.from('payment_gateways').select('*').eq('owner_admin_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('user_profiles').select('subscription_status, subscription_expires_at, is_lifetime').eq('id', user.id).single(),
      supabase.from('platform_settings').select('key, value').in('key', ['platform_whatsapp_number', 'platform_admin_app_android_link', 'platform_admin_app_ios_link']),
      supabase.from('sms_logs').select('id, cost').eq('photographer_id', user.id),
      supabase.from('sms_credit_packages').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('admin_storage_allocations').select('*').eq('admin_id', user.id).single(),
      supabase.from('admin_storage_usage').select('used_mb').eq('admin_id', user.id).single(),
      supabase.from('galleries').select('id', { count: 'exact', head: true }).eq('admin_id', user.id),
    ]) as any;

    if (prof) {
      setProfile({ name: prof.name || '', email: prof.email || '', phone: prof.phone || '' });
      setSmsCredits(prof.sms_credits || 0);
    }
    if (gatewayData) {
      setMpesa({
        shortcode: gatewayData.shortcode || '',
        till_number: gatewayData.till_number || '',
        business_name: gatewayData.business_name || '',
        environment: gatewayData.environment || 'sandbox',
      });
    }
    if (sub) setSubscription(sub);
    if (smsData) {
      setSmsStats({
        sent: smsData.length,
        spent: smsData.reduce((sum: number, log: any) => sum + (log.cost || 0), 0),
      });
    }
    const platformMap: Record<string, string> = {};
    (platformConfig || []).forEach((r: any) => { platformMap[r.key] = r.value || ''; });
    setSuperAdminWhatsApp(platformMap['platform_whatsapp_number'] || '');
    setAppLinks({
      android: platformMap['platform_admin_app_android_link'] || 'https://play.google.com/store',
      ios: platformMap['platform_admin_app_ios_link'] || 'https://apps.apple.com',
    });
    if (packages) setSmsPackages(packages);
    if (storageAlloc) {
      const used = storageUsage?.used_mb || 0;
      const base = storageAlloc.base_storage_mb || 10240;
      const extra = storageAlloc.extra_storage_mb || 0;
      setStorageInfo({ used_mb: used, total_mb: base + extra, extra_mb: extra, galleries: galleries || 0 });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('user_profiles').update({ name: profile.name, phone: profile.phone }).eq('id', user!.id);
      setSuccess('Profile saved!');
    } catch (err: any) { setError(err.message); }
    setSaving(false); setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveMpesa = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('payment_gateways').upsert({
        owner_admin_id: user!.id,
        shortcode: mpesa.shortcode,
        till_number: mpesa.till_number,
        business_name: mpesa.business_name,
        environment: mpesa.environment,
        is_active: true,
        gateway_type: 'mpesa',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_admin_id' });
      setSuccess('M-Pesa settings saved!');
    } catch (err: any) { setError(err.message); }
    setSaving(false); setTimeout(() => setSuccess(''), 3000);
  };

  const handleRefill = async () => {
    const amount = customAmount ? parseInt(customAmount) : refillAmount;
    if (!amount || amount < 10) {
      setRefillError('Minimum refill is KES 10');
      return;
    }

    setRefilling(true); setRefillError(''); setRefillSuccess('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: fnError } = await supabase.functions.invoke('admin-refill-sms', {
        body: {
          target_admin_id: user.id,
          amount: amount,
          reason: refillReason || 'Self-refill from web dashboard',
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const newBalance = data?.new_balance || smsCredits + amount;
      setSmsCredits(newBalance);
      setRefillSuccess(`Refilled ${amount} credits! New balance: KES ${newBalance}`);
      setShowRefillModal(false);
      setRefillAmount(250);
      setCustomAmount('');
      setRefillReason('');
    } catch (err: any) {
      setRefillError(err.message || 'Refill failed');
    }
    setRefilling(false);
  };

  const openWhatsApp = () => {
    if (!superAdminWhatsApp) return;
    const phone = superAdminWhatsApp.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(`Hello, I need support with my Epix Visuals account. My email is ${profile.email}`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const isActive = subscription?.is_lifetime ||
    (subscription?.subscription_status === 'active' && subscription?.subscription_expires_at &&
      new Date(subscription.subscription_expires_at) > new Date());

  const daysLeft = subscription?.subscription_expires_at && !subscription?.is_lifetime
    ? Math.max(0, Math.ceil((new Date(subscription.subscription_expires_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-black">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your profile and payment configuration</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm">✓ {success}</div>}

      {/* Subscription status */}
      <div className={`border rounded-2xl p-5 ${isActive ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold">{subscription?.is_lifetime ? 'Lifetime Account' : isActive ? 'Active Subscription' : 'Subscription Expired'}</p>
            {daysLeft !== null && <p className="text-sm text-gray-400 mt-0.5">{daysLeft} days remaining</p>}
            {subscription?.subscription_expires_at && !subscription?.is_lifetime && (
              <p className="text-xs text-gray-500 mt-0.5">Expires: {new Date(subscription.subscription_expires_at).toLocaleDateString('en-KE')}</p>
            )}
          </div>
          {!isActive && (
            <a href="/subscription-expired" className="font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
              Renew KES 500
            </a>
          )}
        </div>
      </div>

      {/* SMS Credits */}
      <div className="border border-blue-500/20 rounded-2xl p-6 space-y-4" style={{ background: 'rgba(0,122,255,0.04)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">💬</div>
            <div>
              <h2 className="text-lg font-bold text-blue-400">SMS Credits</h2>
              <p className="text-sm text-gray-400">Send gallery notifications via cloud SMS</p>
            </div>
          </div>
          <button onClick={() => setShowRefillModal(true)}
            className="font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', color: '#FFFFFF' }}>
            Refill
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-xl bg-white/5">
            <p className="text-2xl font-black text-blue-400">{smsCredits}</p>
            <p className="text-xs text-gray-400 mt-1">Credits</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-white/5">
            <p className="text-2xl font-black text-green-400">{smsStats.sent}</p>
            <p className="text-xs text-gray-400 mt-1">Sent</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-white/5">
            <p className="text-2xl font-black text-yellow-400">KES {smsStats.spent.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-1">Spent</p>
          </div>
        </div>
        <p className="text-xs text-gray-500">SMS costs 1 credit per message via Africa's Talking</p>
      </div>

      {/* Refill Success */}
      {refillSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm">{refillSuccess}</div>
      )}

      {/* SMS Refill Modal */}
      {showRefillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Refill SMS Credits</h3>
              <button onClick={() => setShowRefillModal(false)} className="text-gray-400 hover:text-white text-xl">&times;</button>
            </div>

            <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-gray-400">Current Balance</p>
              <p className="text-3xl font-black text-blue-400">{smsCredits} credits</p>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-3">SMS Packages</p>
              {smsPackages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {smsPackages.map((pkg: any) => (
                    <button key={pkg.id}
                      onClick={() => { setRefillAmount(pkg.sms_count); setCustomAmount(''); }}
                      className={`py-3 rounded-xl font-bold text-sm transition-all ${
                        refillAmount === pkg.sms_count && !customAmount
                          ? 'text-black'
                          : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                      style={refillAmount === pkg.sms_count && !customAmount ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)' } : {}}>
                      <div>{pkg.sms_count} SMS</div>
                      <div className="text-xs opacity-70">KES {pkg.price}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {REFILL_AMOUNTS.map((amount) => (
                    <button key={amount}
                      onClick={() => { setRefillAmount(amount); setCustomAmount(''); }}
                      className={`py-3 rounded-xl font-bold text-sm transition-all ${
                        refillAmount === amount && !customAmount
                          ? 'text-black'
                          : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                      style={refillAmount === amount && !customAmount ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)' } : {}}>
                      {amount}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">Custom Amount</p>
              <input type="number" value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setRefillAmount(0); }}
                placeholder="Enter amount"
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50" />
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">Reason (optional)</p>
              <input type="text" value={refillReason}
                onChange={(e) => setRefillReason(e.target.value)}
                placeholder="e.g., Monthly SMS bundle"
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50" />
            </div>

            {refillError && <p className="text-sm text-red-400">{refillError}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowRefillModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 text-white hover:bg-white/10">
                Cancel
              </button>
              <button onClick={handleRefill} disabled={refilling}
                className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
                {refilling ? 'Refilling...' : `Refill ${customAmount || refillAmount} Credits`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Info */}
      <div className="border border-purple-500/20 rounded-2xl p-6 space-y-4" style={{ background: 'rgba(147,51,234,0.04)' }}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">☁️</div>
          <div>
            <h2 className="text-lg font-bold text-purple-400">Cloud Storage</h2>
            <p className="text-sm text-gray-400">Your gallery media storage allocation</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-white/5">
            <p className="text-xs text-gray-400">Used</p>
            <p className="text-xl font-black text-purple-400">{(storageInfo.used_mb / 1024).toFixed(1)} GB</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-xl font-black text-white">{(storageInfo.total_mb / 1024).toFixed(1)} GB</p>
          </div>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2.5">
          <div className="h-2.5 rounded-full" style={{
            width: `${Math.min(100, (storageInfo.used_mb / storageInfo.total_mb) * 100)}%`,
            background: 'linear-gradient(135deg, #9333EA, #C084FC)',
          }} />
        </div>
        <p className="text-xs text-gray-500">{storageInfo.galleries} galleries · {storageInfo.extra_mb > 0 ? `${(storageInfo.extra_mb / 1024).toFixed(1)} GB extra purchased` : 'Base 10 GB'}</p>
      </div>

      {/* Download Admin App */}
      <div className="border border-yellow-500/20 rounded-2xl p-6 space-y-4" style={{ background: 'rgba(212,175,55,0.04)' }}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">📱</div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#D4AF37' }}>Download the Admin App</h2>
            <p className="text-sm text-gray-400">Manage galleries, clients, and bookings from your phone</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <a href={appLinks.android} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-xs text-gray-400">Get it on</p>
              <p className="font-bold text-sm text-white">Google Play</p>
            </div>
          </a>
          <a href={appLinks.ios} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
            <span className="text-2xl">🍎</span>
            <div>
              <p className="text-xs text-gray-400">Download on</p>
              <p className="font-bold text-sm text-white">App Store</p>
            </div>
          </a>
        </div>
      </div>

      {/* Profile */}
      <form onSubmit={handleSaveProfile} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">Profile</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name</label>
          <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email (read-only)</label>
          <input value={profile.email} readOnly
            className="w-full bg-[#0A0A0E] border border-white/5 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
            placeholder="+254712345678" />
        </div>
        <button type="submit" disabled={saving}
          className="font-bold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          Save Profile
        </button>
      </form>

      {/* M-Pesa — for collecting from clients */}
      <form onSubmit={handleSaveMpesa} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold">M-Pesa Payments</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configure how clients pay for their galleries</p>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Business Name</label>
          <input value={mpesa.business_name} onChange={(e) => setMpesa({ ...mpesa, business_name: e.target.value })}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
            placeholder="Kamau Photography" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Shortcode (Paybill)</label>
            <input value={mpesa.shortcode} onChange={(e) => setMpesa({ ...mpesa, shortcode: e.target.value })}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
              placeholder="123456" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Till Number</label>
            <input value={mpesa.till_number} onChange={(e) => setMpesa({ ...mpesa, till_number: e.target.value })}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
              placeholder="123456" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Environment</label>
          <div className="flex gap-3">
            {(['sandbox', 'production'] as const).map((env) => (
              <button key={env} type="button"
                onClick={() => setMpesa({ ...mpesa, environment: env })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  mpesa.environment === env
                    ? 'text-black'
                    : 'bg-white/5 text-white hover:bg-white/10'
                }`}
                style={mpesa.environment === env ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)' } : {}}>
                {env === 'sandbox' ? 'Sandbox (Testing)' : 'Production (Live)'}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="font-bold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          Save M-Pesa Settings
        </button>
      </form>

      {/* Support */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">Support</h2>
        <p className="text-sm text-gray-400">Need help? Chat with the Epix Visuals support team directly on WhatsApp.</p>
        <button onClick={openWhatsApp} disabled={!superAdminWhatsApp}
          className="flex items-center gap-3 px-5 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40"
          style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>
          <span className="text-xl">💬</span>
          Chat with Support on WhatsApp
        </button>
        <p className="text-xs text-gray-600">Or email: <a href="mailto:epixshots002@gmail.com" className="text-yellow-500 hover:underline">epixshots002@gmail.com</a></p>
      </div>
    </div>
  );
}
