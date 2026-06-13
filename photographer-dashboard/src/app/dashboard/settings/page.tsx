'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const SUPER_ADMIN_WHATSAPP_KEY = 'platform_whatsapp_number';

export default function SettingsPage() {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [mpesa, setMpesa] = useState({ mpesa_number: '', business_name: '', auto_verification: false });
  const [subscription, setSubscription] = useState<any>(null);
  const [superAdminWhatsApp, setSuperAdminWhatsApp] = useState('');
  const [appLinks, setAppLinks] = useState({ android: 'https://play.google.com/store', ios: 'https://apps.apple.com' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prof }, { data: mpesaData }, { data: sub }, { data: platformConfig }] = await Promise.all([
      supabase.from('user_profiles').select('name, email, phone').eq('id', user.id).single(),
      supabase.from('simple_payment_settings').select('*').eq('admin_id', user.id).maybeSingle(),
      supabase.from('user_profiles').select('subscription_status, subscription_expires_at, is_lifetime').eq('id', user.id).single(),
      supabase.from('platform_settings').select('key, value').in('key', ['platform_whatsapp_number', 'platform_admin_app_android_link', 'platform_admin_app_ios_link']),
    ]) as any;

    if (prof) setProfile({ name: prof.name || '', email: prof.email || '', phone: prof.phone || '' });
    if (mpesaData) setMpesa({ mpesa_number: mpesaData.mpesa_number || '', business_name: mpesaData.business_name || '', auto_verification: mpesaData.auto_verification || false });
    if (sub) setSubscription(sub);
    const platformMap: Record<string, string> = {};
    (platformConfig || []).forEach((r: any) => { platformMap[r.key] = r.value || ''; });
    setSuperAdminWhatsApp(platformMap['platform_whatsapp_number'] || '');
    setAppLinks({
      android: platformMap['platform_admin_app_android_link'] || 'https://play.google.com/store',
      ios: platformMap['platform_admin_app_ios_link'] || 'https://apps.apple.com',
    });
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
      await supabase.from('simple_payment_settings').upsert({
        admin_id: user!.id,
        mpesa_number: mpesa.mpesa_number,
        business_name: mpesa.business_name,
        auto_verification: mpesa.auto_verification,
        mpesa_enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'admin_id' });
      setSuccess('M-Pesa settings saved!');
    } catch (err: any) { setError(err.message); }
    setSaving(false); setTimeout(() => setSuccess(''), 3000);
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
            <p className="font-bold">{subscription?.is_lifetime ? '👑 Lifetime Account' : isActive ? '✅ Active Subscription' : '❌ Subscription Expired'}</p>
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
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Setup checklist</p>
          <ul className="space-y-1.5 text-sm text-gray-400">
            <li className="flex gap-2"><span style={{ color: '#D4AF37' }}>→</span> Sign in with your email and password</li>
            <li className="flex gap-2"><span style={{ color: '#D4AF37' }}>→</span> Go to Settings → configure your M-Pesa number</li>
            <li className="flex gap-2"><span style={{ color: '#D4AF37' }}>→</span> Upload your first gallery from the Upload tab</li>
            <li className="flex gap-2"><span style={{ color: '#D4AF37' }}>→</span> Share the access code with your client</li>
          </ul>
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
          <p className="text-sm text-gray-500 mt-0.5">Your M-Pesa number where clients pay for their galleries</p>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Your M-Pesa Number</label>
          <input value={mpesa.mpesa_number} onChange={(e) => setMpesa({ ...mpesa, mpesa_number: e.target.value })}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
            placeholder="0712345678" />
          <p className="text-xs text-gray-600 mt-1">Clients will send payment to this number</p>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Business Name (shown to clients)</label>
          <input value={mpesa.business_name} onChange={(e) => setMpesa({ ...mpesa, business_name: e.target.value })}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
            placeholder="Kamau Photography" />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="auto" checked={mpesa.auto_verification}
            onChange={(e) => setMpesa({ ...mpesa, auto_verification: e.target.checked })}
            className="w-4 h-4 accent-yellow-500" />
          <label htmlFor="auto" className="text-sm text-gray-300">Enable automatic STK push (requires Daraja API setup in admin app)</label>
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
