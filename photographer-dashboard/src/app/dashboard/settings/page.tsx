'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [branding, setBranding] = useState({ brand_name: '', tagline: '', watermark_text: '', watermark_opacity: '30' });
  const [mpesa, setMpesa] = useState({ mpesa_number: '', business_name: '', auto_verification: false });
  const [subscription, setSubscription] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prof }, { data: brand }, { data: mpesaData }, { data: sub }] = await Promise.all([
      supabase.from('user_profiles').select('name, email, phone').eq('id', user.id).single(),
      supabase.from('branding_settings').select('*').eq('admin_id', user.id).maybeSingle(),
      supabase.from('simple_payment_settings').select('*').eq('admin_id', user.id).maybeSingle(),
      supabase.from('user_profiles').select('subscription_status, subscription_expires_at, is_lifetime').eq('id', user.id).single(),
    ]) as any;

    if (prof) setProfile({ name: prof.name || '', email: prof.email || '', phone: prof.phone || '' });
    if (brand) setBranding({ brand_name: brand.brand_name || '', tagline: brand.tagline || '', watermark_text: brand.watermark_text || '', watermark_opacity: String(brand.watermark_opacity || 30) });
    if (mpesaData) setMpesa({ mpesa_number: mpesaData.mpesa_number || '', business_name: mpesaData.business_name || '', auto_verification: mpesaData.auto_verification || false });
    if (sub) setSubscription(sub);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('user_profiles').update({ name: profile.name, phone: profile.phone }).eq('id', user!.id);
      setSuccess('Profile saved!');
    } catch (err: any) { setError(err.message); }
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('branding_settings').upsert({
        admin_id: user!.id,
        brand_name: branding.brand_name,
        tagline: branding.tagline,
        watermark_text: branding.watermark_text,
        watermark_opacity: parseInt(branding.watermark_opacity),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'admin_id' });
      setSuccess('Branding saved!');
    } catch (err: any) { setError(err.message); }
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
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
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
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
        <p className="text-gray-400 mt-1">Manage your profile, branding, and payments</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm">{success}</div>}

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
            <a href="/subscription-expired" className="bg-yellow-500 text-black font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90">
              Renew KES 500
            </a>
          )}
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
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50" />
        </div>
        <button type="submit" disabled={saving} className="bg-yellow-500 text-black font-bold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50">
          Save Profile
        </button>
      </form>

      {/* Branding */}
      <form onSubmit={handleSaveBranding} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">Branding & Watermark</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Studio / Brand Name</label>
          <input value={branding.brand_name} onChange={(e) => setBranding({ ...branding, brand_name: e.target.value })}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
            placeholder="Kamau Photography" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tagline</label>
          <input value={branding.tagline} onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
            placeholder="Capturing moments forever" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Watermark Text</label>
            <input value={branding.watermark_text} onChange={(e) => setBranding({ ...branding, watermark_text: e.target.value })}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Opacity (%)</label>
            <input type="number" min="0" max="100" value={branding.watermark_opacity}
              onChange={(e) => setBranding({ ...branding, watermark_opacity: e.target.value })}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="bg-yellow-500 text-black font-bold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50">
          Save Branding
        </button>
      </form>

      {/* M-Pesa */}
      <form onSubmit={handleSaveMpesa} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">M-Pesa Payments</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">M-Pesa Number</label>
          <input value={mpesa.mpesa_number} onChange={(e) => setMpesa({ ...mpesa, mpesa_number: e.target.value })}
            className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
            placeholder="0712345678" />
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
          <label htmlFor="auto" className="text-sm text-gray-300">Enable automatic STK push (requires Daraja API setup)</label>
        </div>
        <button type="submit" disabled={saving} className="bg-yellow-500 text-black font-bold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50">
          Save M-Pesa Settings
        </button>
      </form>
    </div>
  );
}
