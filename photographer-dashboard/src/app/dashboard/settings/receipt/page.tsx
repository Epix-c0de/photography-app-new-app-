'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReceiptSettings {
  business_name: string;
  business_tagline: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  till_number: string;
  paybill_number: string;
  business_short_code: string;
  primary_color: string;
  secondary_color: string;
  footer_text: string;
  terms_and_conditions: string;
  show_qr_code: boolean;
  show_logo: boolean;
  show_tax: boolean;
  tax_percent: number;
  template: 'standard' | 'minimal' | 'detailed' | 'branded';
}

const TEMPLATES = [
  { id: 'standard', label: 'Standard', description: 'Clean and professional layout' },
  { id: 'minimal', label: 'Minimal', description: 'Simple and concise' },
  { id: 'detailed', label: 'Detailed', description: 'Includes all information' },
  { id: 'branded', label: 'Branded', description: 'Full brand experience' },
];

const PRESET_COLORS = [
  '#d4af37', '#b8860b', '#daa520', '#ffd700',
  '#1a1a1a', '#2d2d2d', '#4a4a4a', '#666666',
  '#22c55e', '#3b82f6', '#ef4444', '#a855f7',
];

export default function ReceiptSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReceiptSettings>({
    business_name: 'Epix Visuals',
    business_tagline: 'Professional Photography',
    logo_url: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    till_number: '',
    paybill_number: '',
    business_short_code: '',
    primary_color: '#d4af37',
    secondary_color: '#1a1a1a',
    footer_text: 'Thank you for your payment!',
    terms_and_conditions: '',
    show_qr_code: true,
    show_logo: true,
    show_tax: false,
    tax_percent: 16,
    template: 'standard',
  });

  const loadSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('receipt_settings')
        .select('*')
        .eq('photographer_id', user.id)
        .single();

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to load receipt settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('receipt_settings')
        .upsert({
          photographer_id: user.id,
          ...settings,
        }, { onConflict: 'photographer_id' });

      if (error) throw error;
      alert('Receipt settings saved successfully!');
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Receipt Settings</h1>
          <p className="text-gray-400 mt-1">Customize your payment receipts</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Info */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Business Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Business Name</label>
              <input
                type="text"
                value={settings.business_name}
                onChange={(e) => updateSetting('business_name', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Tagline</label>
              <input
                type="text"
                value={settings.business_tagline}
                onChange={(e) => updateSetting('business_tagline', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Contact Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Phone</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => updateSetting('phone', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => updateSetting('email', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Address</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => updateSetting('address', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Website</label>
              <input
                type="url"
                value={settings.website}
                onChange={(e) => updateSetting('website', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Payment Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Till Number</label>
              <input
                type="text"
                value={settings.till_number}
                onChange={(e) => updateSetting('till_number', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Paybill Number</label>
              <input
                type="text"
                value={settings.paybill_number}
                onChange={(e) => updateSetting('paybill_number', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Template Selection */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Receipt Template</h2>
          
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => updateSetting('template', t.id as any)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  settings.template === t.id
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className={`font-semibold ${settings.template === t.id ? 'text-yellow-500' : 'text-white'}`}>
                  {t.label}
                </div>
                <div className="text-xs text-gray-400 mt-1">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Styling */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Styling</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Primary Color</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.slice(0, 8).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateSetting('primary_color', color)}
                    className={`w-10 h-10 rounded-full border-2 transition-transform ${
                      settings.primary_color === color
                        ? 'border-white scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Footer Text</label>
              <input
                type="text"
                value={settings.footer_text}
                onChange={(e) => updateSetting('footer_text', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Terms & Conditions</label>
              <textarea
                value={settings.terms_and_conditions}
                onChange={(e) => updateSetting('terms_and_conditions', e.target.value)}
                rows={3}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Display Options</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white">Show Logo</span>
              <input
                type="checkbox"
                checked={settings.show_logo}
                onChange={(e) => updateSetting('show_logo', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-800 border-gray-700 text-yellow-500 focus:ring-yellow-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white">Show QR Code</span>
              <input
                type="checkbox"
                checked={settings.show_qr_code}
                onChange={(e) => updateSetting('show_qr_code', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-800 border-gray-700 text-yellow-500 focus:ring-yellow-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white">Include Tax</span>
              <input
                type="checkbox"
                checked={settings.show_tax}
                onChange={(e) => updateSetting('show_tax', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-800 border-gray-700 text-yellow-500 focus:ring-yellow-500"
              />
            </label>

            {settings.show_tax && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Tax Percent (%)</label>
                <input
                  type="number"
                  value={settings.tax_percent}
                  onChange={(e) => updateSetting('tax_percent', Number(e.target.value))}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-yellow-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-8 bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Receipt Preview</h2>
        <div className="bg-white rounded-lg p-6 max-w-md mx-auto text-black">
          <div className="text-center border-b-2 pb-4 mb-4" style={{ borderColor: settings.primary_color }}>
            <h3 className="text-xl font-bold">{settings.business_name}</h3>
            <p className="text-sm text-gray-500">{settings.business_tagline}</p>
            <p className="text-xs mt-2 uppercase tracking-wider" style={{ color: settings.primary_color }}>Payment Receipt</p>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Receipt No</span>
              <span className="font-mono">EV-20260630-0001</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Client</span>
              <span className="font-semibold">Sample Client</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: settings.primary_color + '10' }}>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>KES 35,000</span>
            </div>
            {settings.show_tax && (
              <div className="flex justify-between text-sm">
                <span>Tax ({settings.tax_percent}%)</span>
                <span>KES {(35000 * settings.tax_percent / 100).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold mt-2 pt-2 border-t">
              <span>Total</span>
              <span>KES {settings.show_tax 
                ? (35000 + 35000 * settings.tax_percent / 100).toLocaleString() 
                : '35,000'}</span>
            </div>
          </div>
          
          <p className="text-center text-xs text-gray-500 mt-4 italic">{settings.footer_text}</p>
        </div>
      </div>
    </div>
  );
}