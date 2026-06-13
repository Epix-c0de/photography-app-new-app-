'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type PaymentSettings = {
  id: string;
  mpesa_consumer_key: string | null;
  mpesa_consumer_secret: string | null;
  mpesa_passkey: string | null;
  mpesa_shortcode: string | null;
  mpesa_type: 'paybill' | 'till' | null;
  mpesa_account_reference: string | null;
  subscription_monthly_price: number;
  subscription_quarterly_price: number;
  subscription_annual_price: number;
  lifetime_price: number;
  platform_commission_percentage: number;
  payment_gateway: 'mpesa' | 'stripe' | 'paystack';
  test_mode: boolean;
  payment_success_webhook_url: string | null;
  payment_failed_webhook_url: string | null;
};

type PlatformSettings = {
  id: string;
  // Admin app download links (photographer mobile app)
  admin_app_android_link: string;
  admin_app_ios_link: string;
  // User app download links (client mobile app)
  user_app_android_link: string;
  user_app_ios_link: string;
  // Other platform links
  photographer_signup_url: string;
  deep_link_scheme: string;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'payment' | 'pricing' | 'webhooks' | 'links'>('payment');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    id: '',
    mpesa_consumer_key: null,
    mpesa_consumer_secret: null,
    mpesa_passkey: null,
    mpesa_shortcode: null,
    mpesa_type: 'paybill',
    mpesa_account_reference: null,
    subscription_monthly_price: 500,
    subscription_quarterly_price: 1400,
    subscription_annual_price: 5000,
    lifetime_price: 15000,
    platform_commission_percentage: 0,
    payment_gateway: 'mpesa',
    test_mode: false,
    payment_success_webhook_url: null,
    payment_failed_webhook_url: null,
  });
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    id: 'platform',
    admin_app_android_link: '',
    admin_app_ios_link: '',
    user_app_android_link: '',
    user_app_ios_link: '',
    photographer_signup_url: '',
    deep_link_scheme: 'epixvisuals',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      // Load payment settings — may not exist yet; safe to ignore error
      const { data: paymentData } = await supabase
        .from('platform_payment_settings')
        .select('*')
        .maybeSingle();
      if (paymentData) {
        setPaymentSettings(paymentData);
      }

      // Load platform settings
      const { data: platformData } = await supabase
        .from('platform_settings')
        .select('key, value');
      if (platformData && platformData.length > 0) {
        const kvMap: Record<string, string> = {};
        platformData.forEach((row: any) => { kvMap[row.key] = row.value ?? ''; });
        setPlatformSettings({
          id: 'platform',
          admin_app_android_link: kvMap['platform_admin_app_android_link'] ?? '',
          admin_app_ios_link: kvMap['platform_admin_app_ios_link'] ?? '',
          user_app_android_link: kvMap['platform_app_android_link'] ?? '',
          user_app_ios_link: kvMap['platform_app_ios_link'] ?? '',
          photographer_signup_url: kvMap['platform_photographer_signup_url'] ?? '',
          deep_link_scheme: kvMap['platform_deep_link_scheme'] ?? 'epixvisuals',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function savePaymentSettings() {
    if (!paymentSettings.id) {
      // No existing record — insert instead
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('platform_payment_settings')
          .insert({ ...paymentSettings, updated_by: user?.id });
        if (error) throw error;
        alert('Payment settings saved!');
      } catch (e) {
        console.error(e);
        alert('Failed to save payment settings');
      } finally { setSaving(false); }
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('platform_payment_settings')
        .update({
          ...paymentSettings,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('id', paymentSettings.id);
      if (error) throw error;
      alert('Payment settings saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save payment settings');
    } finally {
      setSaving(false);
    }
  }

  async function savePlatformSettings() {
    if (!platformSettings) return;
    setSaving(true);
    try {
      // Map UI fields to their platform_settings DB keys
      const keyMap: Record<keyof Omit<PlatformSettings, 'id'>, string> = {
        admin_app_android_link: 'platform_admin_app_android_link',
        admin_app_ios_link: 'platform_admin_app_ios_link',
        user_app_android_link: 'platform_app_android_link',
        user_app_ios_link: 'platform_app_ios_link',
        photographer_signup_url: 'platform_photographer_signup_url',
        deep_link_scheme: 'platform_deep_link_scheme',
      };
      for (const [field, dbKey] of Object.entries(keyMap)) {
        await supabase.from('platform_settings').upsert(
          { key: dbKey, value: String((platformSettings as any)[field] ?? '') },
          { onConflict: 'key' }
        );
      }
      alert('Platform settings saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save platform settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Platform Settings</h1>
        <p className="text-gray-400 mt-1">Configure payment integration and app links</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/5">
        {[
          { id: 'payment' as const, label: 'Payment Gateway', icon: '💳' },
          { id: 'pricing' as const, label: 'Pricing Tiers', icon: '💰' },
          { id: 'webhooks' as const, label: 'Webhooks', icon: '🔗' },
          { id: 'links' as const, label: 'App Links', icon: '🌐' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-3 rounded-t-xl text-sm font-semibold flex items-center gap-2 transition-all"
            style={activeTab === tab.id
              ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }
              : { color: 'rgba(255,255,255,0.5)' }}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Payment Gateway Tab */}
      {activeTab === 'payment' && (
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="font-bold text-xl mb-4">M-Pesa Configuration</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Consumer Key</label>
                  <input
                    type="text"
                    value={paymentSettings.mpesa_consumer_key || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, mpesa_consumer_key: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Enter M-Pesa consumer key"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Consumer Secret</label>
                  <input
                    type="password"
                    value={paymentSettings.mpesa_consumer_secret || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, mpesa_consumer_secret: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Enter M-Pesa consumer secret"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Shortcode</label>
                  <input
                    type="text"
                    value={paymentSettings.mpesa_shortcode || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, mpesa_shortcode: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Business shortcode"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Passkey</label>
                  <input
                    type="password"
                    value={paymentSettings.mpesa_passkey || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, mpesa_passkey: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Lipa Na M-Pesa passkey"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Type</label>
                  <select
                    value={paymentSettings.mpesa_type || 'paybill'}
                    onChange={e => setPaymentSettings({ ...paymentSettings, mpesa_type: e.target.value as 'paybill' | 'till' })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white">
                    <option value="paybill">Paybill</option>
                    <option value="till">Till Number</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Account Reference</label>
                  <input
                    type="text"
                    value={paymentSettings.mpesa_account_reference || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, mpesa_account_reference: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Default account reference"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)' }}>
                <input
                  type="checkbox"
                  checked={paymentSettings.test_mode}
                  onChange={e => setPaymentSettings({ ...paymentSettings, test_mode: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <p className="font-semibold" style={{ color: '#FF9F0A' }}>Test Mode</p>
                  <p className="text-xs text-gray-400">Use sandbox environment for testing</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={savePaymentSettings}
            disabled={saving}
            className="px-6 py-3 rounded-xl font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            {saving ? 'Saving...' : 'Save Payment Settings'}
          </button>
        </div>
      )}

      {/* Pricing Tiers Tab */}
      {activeTab === 'pricing' && (
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="font-bold text-xl mb-4">Subscription Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Monthly Price (KES)</label>
                <input
                  type="number"
                  value={paymentSettings.subscription_monthly_price}
                  onChange={e => setPaymentSettings({ ...paymentSettings, subscription_monthly_price: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Quarterly Price (KES)</label>
                <input
                  type="number"
                  value={paymentSettings.subscription_quarterly_price}
                  onChange={e => setPaymentSettings({ ...paymentSettings, subscription_quarterly_price: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Annual Price (KES)</label>
                <input
                  type="number"
                  value={paymentSettings.subscription_annual_price}
                  onChange={e => setPaymentSettings({ ...paymentSettings, subscription_annual_price: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Lifetime Price (KES)</label>
                <input
                  type="number"
                  value={paymentSettings.lifetime_price}
                  onChange={e => setPaymentSettings({ ...paymentSettings, lifetime_price: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-xl mb-4">Revenue Share</h2>
            <div>
              <label className="text-sm font-semibold text-gray-400 block mb-2">Platform Commission (%)</label>
              <input
                type="number"
                step="0.1"
                value={paymentSettings.platform_commission_percentage}
                onChange={e => setPaymentSettings({ ...paymentSettings, platform_commission_percentage: parseFloat(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white max-w-xs"
              />
              <p className="text-xs text-gray-500 mt-2">Percentage taken from photographer gallery payments</p>
            </div>
          </div>

          <button
            onClick={savePaymentSettings}
            disabled={saving}
            className="px-6 py-3 rounded-xl font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            {saving ? 'Saving...' : 'Save Pricing Settings'}
          </button>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="font-bold text-xl mb-4">Payment Webhooks</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Success Webhook URL</label>
                <input
                  type="url"
                  value={paymentSettings.payment_success_webhook_url || ''}
                  onChange={e => setPaymentSettings({ ...paymentSettings, payment_success_webhook_url: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://your-domain.com/webhooks/payment-success"
                />
                <p className="text-xs text-gray-500 mt-2">Called when a payment succeeds</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Failed Webhook URL</label>
                <input
                  type="url"
                  value={paymentSettings.payment_failed_webhook_url || ''}
                  onChange={e => setPaymentSettings({ ...paymentSettings, payment_failed_webhook_url: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://your-domain.com/webhooks/payment-failed"
                />
                <p className="text-xs text-gray-500 mt-2">Called when a payment fails</p>
              </div>
            </div>
          </div>

          <button
            onClick={savePaymentSettings}
            disabled={saving}
            className="px-6 py-3 rounded-xl font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            {saving ? 'Saving...' : 'Save Webhook Settings'}
          </button>
        </div>
      )}

      {/* App Links Tab */}
      {activeTab === 'links' && (
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="font-bold text-xl mb-1">Application Download Links</h2>
            <p className="text-sm text-gray-500 mb-6">
              These links are displayed in the photographer dashboard's <strong className="text-gray-300">Settings → Download Admin App</strong> section
              and in the success page after signup. User app links are included in the invite messages sent to clients.
            </p>

            {/* Admin App Links */}
            <div className="space-y-4 mb-8">
              <h3 className="font-semibold text-sm text-yellow-400 uppercase tracking-wider">
                📱 Admin App (for photographers)
              </h3>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Android Download Link (Google Play)</label>
                <input
                  type="url"
                  value={platformSettings.admin_app_android_link}
                  onChange={e => setPlatformSettings({ ...platformSettings, admin_app_android_link: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://play.google.com/store/apps/details?id=com.epixvisuals.admin"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Shown to photographers after signup and on the dashboard Settings page
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">iOS Download Link (App Store)</label>
                <input
                  type="url"
                  value={platformSettings.admin_app_ios_link}
                  onChange={e => setPlatformSettings({ ...platformSettings, admin_app_ios_link: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://apps.apple.com/app/epixvisuals-admin/id000000000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Shown to photographers after signup and on the dashboard Settings page
                </p>
              </div>
            </div>

            {/* User App Links */}
            <div className="space-y-4 mb-8">
              <h3 className="font-semibold text-sm text-blue-400 uppercase tracking-wider">
                📲 User App (for clients)
              </h3>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Android Download Link (Google Play)</label>
                <input
                  type="url"
                  value={platformSettings.user_app_android_link}
                  onChange={e => setPlatformSettings({ ...platformSettings, user_app_android_link: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://play.google.com/store/apps/details?id=com.epixvisuals.client"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Included in access code invite messages sent to non-existing clients
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">iOS Download Link (App Store)</label>
                <input
                  type="url"
                  value={platformSettings.user_app_ios_link}
                  onChange={e => setPlatformSettings({ ...platformSettings, user_app_ios_link: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://apps.apple.com/app/epixvisuals/id000000000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Included in access code invite messages sent to non-existing clients
                </p>
              </div>
            </div>

            {/* Other Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">
                🔗 Other Platform Links
              </h3>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Photographer Signup URL</label>
                <input
                  type="url"
                  value={platformSettings.photographer_signup_url}
                  onChange={e => setPlatformSettings({ ...platformSettings, photographer_signup_url: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://join.epixvisuals.co"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Shown to unassigned clients as a "refer your photographer" share link
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Deep Link Scheme</label>
                <input
                  type="text"
                  value={platformSettings.deep_link_scheme}
                  onChange={e => setPlatformSettings({ ...platformSettings, deep_link_scheme: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="epixvisuals"
                />
                <p className="text-xs text-gray-500 mt-1">
                  App deep link scheme (e.g. epixvisuals://join?ref=...)
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={savePlatformSettings}
            disabled={saving}
            className="px-6 py-3 rounded-xl font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            {saving ? 'Saving...' : 'Save App Links'}
          </button>
        </div>
      )}
    </div>
  );
}
