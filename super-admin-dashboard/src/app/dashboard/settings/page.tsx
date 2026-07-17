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
  platform_domain: string;
  admin_app_android_link: string;
  admin_app_ios_link: string;
  user_app_android_link: string;
  user_app_ios_link: string;
  photographer_signup_url: string;
  deep_link_scheme: string;
};

type ProviderSettings = {
  ussd_provider: string;
  ussd_api_key: string;
  ussd_short_code: string;
  ussd_callback_url: string;
  ussd_enabled: boolean;
  sms_provider: string;
  sms_api_key: string;
  sms_username: string;
  sms_sender_id: string;
  sms_enabled: boolean;
  whatsapp_api_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_waba_id: string;
  whatsapp_enabled: boolean;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'payment' | 'pricing' | 'webhooks' | 'links' | 'providers'>('payment');
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
    platform_domain: '',
    admin_app_android_link: '',
    admin_app_ios_link: '',
    user_app_android_link: '',
    user_app_ios_link: '',
    photographer_signup_url: '',
    deep_link_scheme: 'epixvisuals',
  });
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>({
    ussd_provider: 'hostpinnacle',
    ussd_api_key: '',
    ussd_short_code: '*384',
    ussd_callback_url: '',
    ussd_enabled: true,
    sms_api_key: '',
    sms_username: '',
    sms_sender_id: '',
    sms_enabled: false,
    whatsapp_api_token: '',
    whatsapp_phone_number_id: '',
    whatsapp_waba_id: '',
    whatsapp_enabled: false,
    sms_provider: 'africastalking',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

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

      // Load platform settings + provider settings
      const { data: platformData } = await supabase
        .from('platform_settings')
        .select('key, value');
      if (platformData && platformData.length > 0) {
        const kvMap: Record<string, string> = {};
        platformData.forEach((row: any) => { kvMap[row.key] = row.value ?? ''; });
        setPlatformSettings({
          id: 'platform',
          platform_domain: kvMap['platform_domain'] ?? '',
          admin_app_android_link: kvMap['platform_admin_app_android_link'] ?? '',
          admin_app_ios_link: kvMap['platform_admin_app_ios_link'] ?? '',
          user_app_android_link: kvMap['platform_app_android_link'] ?? '',
          user_app_ios_link: kvMap['platform_app_ios_link'] ?? '',
          photographer_signup_url: kvMap['platform_photographer_signup_url'] ?? '',
          deep_link_scheme: kvMap['platform_deep_link_scheme'] ?? 'epixvisuals',
        });
        setProviderSettings({
          ussd_provider: kvMap['ussd_provider'] || 'hostpinnacle',
          ussd_api_key: kvMap['ussd_api_key'] || '',
          ussd_short_code: kvMap['ussd_short_code'] || '*384',
          ussd_callback_url: kvMap['ussd_callback_url'] || '',
          ussd_enabled: kvMap['ussd_enabled'] === 'true',
          sms_provider: kvMap['sms_provider'] || 'africastalking',
          sms_api_key: kvMap['sms_api_key'] || '',
          sms_username: kvMap['sms_username'] || '',
          sms_sender_id: kvMap['sms_sender_id'] || '',
          sms_enabled: kvMap['sms_enabled'] === 'true',
          whatsapp_api_token: kvMap['whatsapp_api_token'] || '',
          whatsapp_phone_number_id: kvMap['whatsapp_phone_number_id'] || '',
          whatsapp_waba_id: kvMap['whatsapp_waba_id'] || '',
          whatsapp_enabled: kvMap['whatsapp_enabled'] === 'true',
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
      const keyMap: Record<keyof Omit<PlatformSettings, 'id'>, string> = {
        platform_domain: 'platform_domain',
        admin_app_android_link: 'platform_admin_app_android_link',
        admin_app_ios_link: 'platform_admin_app_ios_link',
        user_app_android_link: 'platform_app_android_link',
        user_app_ios_link: 'platform_app_ios_link',
        photographer_signup_url: 'platform_photographer_signup_url',
        deep_link_scheme: 'platform_deep_link_scheme',
      };
      const results = await Promise.all(Object.entries(keyMap).map(([field, dbKey]) =>
        supabase.from('platform_settings').upsert(
          { key: dbKey, value: String((platformSettings as any)[field] ?? '') },
          { onConflict: 'key' }
        )
      ));
      const dbError = results.find(r => r.error);
      if (dbError) {
        console.error('App links save error:', dbError.error);
        throw dbError.error;
      }
      alert('App links saved successfully!');
    } catch (e: any) {
      console.error(e);
      alert(`Failed to save app links: ${e?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveProviderSettings() {
    setSaving(true);
    try {
      const updates = [
        { key: 'ussd_provider', value: providerSettings.ussd_provider },
        { key: 'ussd_api_key', value: providerSettings.ussd_api_key },
        { key: 'ussd_short_code', value: providerSettings.ussd_short_code },
        { key: 'ussd_callback_url', value: providerSettings.ussd_callback_url },
        { key: 'ussd_enabled', value: String(providerSettings.ussd_enabled) },
        { key: 'sms_provider', value: providerSettings.sms_provider },
        { key: 'sms_api_key', value: providerSettings.sms_api_key },
        { key: 'sms_username', value: providerSettings.sms_username },
        { key: 'sms_sender_id', value: providerSettings.sms_sender_id },
        { key: 'sms_enabled', value: String(providerSettings.sms_enabled) },
        { key: 'whatsapp_api_token', value: providerSettings.whatsapp_api_token },
        { key: 'whatsapp_phone_number_id', value: providerSettings.whatsapp_phone_number_id },
        { key: 'whatsapp_waba_id', value: providerSettings.whatsapp_waba_id },
        { key: 'whatsapp_enabled', value: String(providerSettings.whatsapp_enabled) },
      ];
      const results = await Promise.all(updates.map(update =>
        supabase
          .from('platform_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' })
      ));
      const dbError = results.find(r => r.error);
      if (dbError) throw dbError.error;
      alert('Provider settings saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save provider settings');
    } finally {
      setSaving(false);
    }
  }

  async function testProviderConnection(providerType: 'ussd' | 'sms' | 'whatsapp') {
    setTestingProvider(providerType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ provider_type: providerType }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`${providerType.toUpperCase()} connection successful: ${result.message}`);
      } else {
        alert(`${providerType.toUpperCase()} connection failed: ${result.error}`);
      }
    } catch (e: any) {
      alert(`Test failed: ${e.message}`);
    } finally {
      setTestingProvider(null);
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
          { id: 'providers' as const, label: 'Providers', icon: '📡' },
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
            <h2 className="font-bold text-xl mb-1">Application Links</h2>
            <p className="text-sm text-gray-500 mb-6">
              Configure how the platform appears to users and photographers. Set your platform domain first — it controls all share links (announcements, galleries, BTS).
            </p>

            {/* Platform Domain */}
            <div className="space-y-4 mb-8">
              <h3 className="font-semibold text-sm text-purple-400 uppercase tracking-wider">
                🌐 Platform Domain
              </h3>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Base Domain URL</label>
                <input
                  type="url"
                  value={platformSettings.platform_domain}
                  onChange={e => setPlatformSettings({ ...platformSettings, platform_domain: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://epixvisuals.co.ke"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The main domain used for all share links (announcements, galleries, BTS, referrals). Falls back to epixvisuals.co.ke if empty.
                </p>
              </div>
            </div>

            {/* Admin App Links */}
            <div className="space-y-4 mb-8">
              <h3 className="font-semibold text-sm text-yellow-400 uppercase tracking-wider">
                📱 Admin App (for photographers)
              </h3>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Android Download Link</label>
                <input
                  type="url"
                  value={platformSettings.admin_app_android_link}
                  onChange={e => setPlatformSettings({ ...platformSettings, admin_app_android_link: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://play.google.com/store/apps/details?id=... or APK URL"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Google Play Store URL or direct APK download link
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">iOS Download Link</label>
                <input
                  type="url"
                  value={platformSettings.admin_app_ios_link}
                  onChange={e => setPlatformSettings({ ...platformSettings, admin_app_ios_link: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://apps.apple.com/app/... or TestFlight link"
                />
                <p className="text-xs text-gray-500 mt-1">
                  App Store URL or TestFlight / direct install link
                </p>
              </div>
            </div>

            {/* User App Links */}
            <div className="space-y-4 mb-8">
              <h3 className="font-semibold text-sm text-blue-400 uppercase tracking-wider">
                📲 User App (for clients)
              </h3>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">Android Download Link</label>
                <input
                  type="url"
                  value={platformSettings.user_app_android_link}
                  onChange={e => setPlatformSettings({ ...platformSettings, user_app_android_link: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://play.google.com/store/apps/details?id=... or APK URL"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Google Play Store URL or direct APK download link
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">iOS Download Link</label>
                <input
                  type="url"
                  value={platformSettings.user_app_ios_link}
                  onChange={e => setPlatformSettings({ ...platformSettings, user_app_ios_link: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="https://apps.apple.com/app/... or TestFlight link"
                />
                <p className="text-xs text-gray-500 mt-1">
                  App Store URL or TestFlight / direct install link
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

      {/* Providers Tab */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          {/* ── USSD Provider ── */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-xl">USSD Provider</h2>
                <p className="text-gray-400 text-sm mt-1">Configure USSD short code and API access</p>
              </div>
              <button
                onClick={() => testProviderConnection('ussd')}
                disabled={testingProvider === 'ussd'}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 hover:bg-white/5 transition-all"
              >
                {testingProvider === 'ussd' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Provider</label>
                  <select
                    value={providerSettings.ussd_provider}
                    onChange={e => setProviderSettings({ ...providerSettings, ussd_provider: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white">
                    <option value="hostpinnacle">HostPinnacle</option>
                    <option value="africastalking">Africa's Talking</option>
                    <option value="custom">Custom Provider</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Short Code</label>
                  <input
                    type="text"
                    value={providerSettings.ussd_short_code}
                    onChange={e => setProviderSettings({ ...providerSettings, ussd_short_code: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="*384"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">API Key</label>
                  <input
                    type="password"
                    value={providerSettings.ussd_api_key}
                    onChange={e => setProviderSettings({ ...providerSettings, ussd_api_key: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Enter API key"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Callback URL</label>
                  <input
                    type="url"
                    value={providerSettings.ussd_callback_url}
                    onChange={e => setProviderSettings({ ...providerSettings, ussd_callback_url: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="https://your-domain.com/ussd-callback"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: providerSettings.ussd_enabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${providerSettings.ussd_enabled ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <input
                  type="checkbox"
                  checked={providerSettings.ussd_enabled}
                  onChange={e => setProviderSettings({ ...providerSettings, ussd_enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <p className="font-semibold" style={{ color: providerSettings.ussd_enabled ? '#22c55e' : '#ef4444' }}>USSD Enabled</p>
                  <p className="text-xs text-gray-400">Toggle USSD service on/off platform-wide</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── SMS Provider ── */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-xl">SMS Provider</h2>
                <p className="text-gray-400 text-sm mt-1">Configure Africa's Talking SMS gateway</p>
              </div>
              <button
                onClick={() => testProviderConnection('sms')}
                disabled={testingProvider === 'sms'}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 hover:bg-white/5 transition-all"
              >
                {testingProvider === 'sms' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">API Key</label>
                  <input
                    type="password"
                    value={providerSettings.sms_api_key}
                    onChange={e => setProviderSettings({ ...providerSettings, sms_api_key: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Africa's Talking API key"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Username</label>
                  <input
                    type="text"
                    value={providerSettings.sms_username}
                    onChange={e => setProviderSettings({ ...providerSettings, sms_username: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="sandbox or your username"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Sender ID</label>
                  <input
                    type="text"
                    value={providerSettings.sms_sender_id}
                    onChange={e => setProviderSettings({ ...providerSettings, sms_sender_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="EPXVISUALS"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Provider</label>
                  <select
                    value={providerSettings.sms_provider}
                    onChange={e => setProviderSettings({ ...providerSettings, sms_provider: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white">
                    <option value="africastalking">Africa's Talking</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: providerSettings.sms_enabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${providerSettings.sms_enabled ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <input
                  type="checkbox"
                  checked={providerSettings.sms_enabled}
                  onChange={e => setProviderSettings({ ...providerSettings, sms_enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <p className="font-semibold" style={{ color: providerSettings.sms_enabled ? '#22c55e' : '#ef4444' }}>SMS Enabled</p>
                  <p className="text-xs text-gray-400">Toggle SMS notifications on/off platform-wide</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── WhatsApp Provider ── */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-xl">WhatsApp Business API</h2>
                <p className="text-gray-400 text-sm mt-1">Configure WhatsApp Business messaging</p>
              </div>
              <button
                onClick={() => testProviderConnection('whatsapp')}
                disabled={testingProvider === 'whatsapp'}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 hover:bg-white/5 transition-all"
              >
                {testingProvider === 'whatsapp' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Business API Token</label>
                  <input
                    type="password"
                    value={providerSettings.whatsapp_api_token}
                    onChange={e => setProviderSettings({ ...providerSettings, whatsapp_api_token: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="WhatsApp Business API token"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">Phone Number ID</label>
                  <input
                    type="text"
                    value={providerSettings.whatsapp_phone_number_id}
                    onChange={e => setProviderSettings({ ...providerSettings, whatsapp_phone_number_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Phone number ID from Meta"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-400 block mb-2">WABA ID</label>
                  <input
                    type="text"
                    value={providerSettings.whatsapp_waba_id}
                    onChange={e => setProviderSettings({ ...providerSettings, whatsapp_waba_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="WhatsApp Business Account ID"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: providerSettings.whatsapp_enabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${providerSettings.whatsapp_enabled ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <input
                  type="checkbox"
                  checked={providerSettings.whatsapp_enabled}
                  onChange={e => setProviderSettings({ ...providerSettings, whatsapp_enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <p className="font-semibold" style={{ color: providerSettings.whatsapp_enabled ? '#22c55e' : '#ef4444' }}>WhatsApp Enabled</p>
                  <p className="text-xs text-gray-400">Toggle WhatsApp messaging on/off platform-wide</p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
            <button
              onClick={saveProviderSettings}
              disabled={saving}
              className="px-6 py-3 rounded-xl font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
              {saving ? 'Saving...' : 'Save Provider Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
