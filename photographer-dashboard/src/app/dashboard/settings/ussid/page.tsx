'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type USSDProvider = 'hostpinnacle' | 'africastalking' | 'custom';

interface USSDSettings {
  provider: USSDProvider;
  shortCode: string;
  hostpinnacleApiKey: string;
  hostpinnacleUsername: string;
  africastalkingApiKey: string;
  africastalkingUsername: string;
  callbackUrl: string;
  isActive: boolean;
}

const defaultSettings: USSDSettings = {
  provider: 'hostpinnacle',
  shortCode: '*123',
  hostpinnacleApiKey: '',
  hostpinnacleUsername: '',
  africastalkingApiKey: '',
  africastalkingUsername: '',
  callbackUrl: '',
  isActive: false,
};

const providerInfo = {
  hostpinnacle: {
    name: 'HostPinnacle',
    description: 'Kenyan USSD provider with shared and dedicated short codes',
    website: 'https://www.hostpinnacle.co.ke/tools/ussd-services/',
    contact: '+254-111 054 710',
    pricing: 'Shared: ~KES 5,000/month | Dedicated: ~KES 50,000/year',
    features: ['Shared & Dedicated codes', 'Real-time responses', 'Multiple carriers', 'Local support'],
  },
  africastalking: {
    name: "Africa's Talking",
    description: 'Pan-African tech company with USSD, SMS, and Voice services',
    website: 'https://africastalking.com',
    contact: 'support@africastalking.com',
    pricing: 'Pay per session (~KES 0.50/session)',
    features: ['Sandbox for testing', 'Good documentation', 'Multiple countries', 'API-first'],
  },
  custom: {
    name: 'Custom / Self-Hosted',
    description: 'Use your own USSD gateway or test locally',
    website: '',
    contact: '',
    pricing: 'Depends on your setup',
    features: ['Full control', 'No external dependency', 'Custom menus', 'Local testing'],
  },
};

export default function USSDSettingsPage() {
  const [settings, setSettings] = useState<USSDSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [toast, setToast] = useState('');
  const [showProviderModal, setShowProviderModal] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', [
          'ussd_provider',
          'ussd_short_code',
          'ussd_is_active',
          'hostpinnacle_api_key',
          'hostpinnacle_username',
          'africastalking_api_key',
          'africastalking_username',
          'ussd_callback_url',
        ]);

      if (data) {
        const config: Record<string, string> = {};
        data.forEach((s: any) => {
          config[s.key] = s.value || '';
        });

        setSettings({
          provider: (config.ussd_provider as USSDProvider) || 'hostpinnacle',
          shortCode: config.ussd_short_code || '*123',
          hostpinnacleApiKey: config.hostpinnacle_api_key || '',
          hostpinnacleUsername: config.hostpinnacle_username || '',
          africastalkingApiKey: config.africastalking_api_key || '',
          africastalkingUsername: config.africastalking_username || '',
          callbackUrl: config.ussd_callback_url || '',
          isActive: config.ussd_is_active === 'true',
        });
      }
    } catch (error) {
      console.error('Failed to load USSD settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: 'ussd_provider', value: settings.provider },
        { key: 'ussd_short_code', value: settings.shortCode },
        { key: 'ussd_is_active', value: String(settings.isActive) },
        { key: 'hostpinnacle_api_key', value: settings.hostpinnacleApiKey },
        { key: 'hostpinnacle_username', value: settings.hostpinnacleUsername },
        { key: 'africastalking_api_key', value: settings.africastalkingApiKey },
        { key: 'africastalking_username', value: settings.africastalkingUsername },
        { key: 'ussd_callback_url', value: settings.callbackUrl },
      ];

      for (const update of updates) {
        await supabase
          .from('platform_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });
      }

      showToast('USSD settings saved successfully!');
    } catch (error) {
      console.error('Failed to save USSD settings:', error);
      showToast('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testUSSD = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const testCode = settings.shortCode.replace('*', '').replace('#', '');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ussd-handler`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            sessionId: `test_${Date.now()}`,
            phoneNumber: '+254712345678',
            serviceCode: testCode,
            text: '',
          }),
        }
      );

      const text = await response.text();

      if (response.ok) {
        setTestResult({
          success: true,
          message: `USSD test successful!\n\nResponse:\n${text}`,
        });
      } else {
        setTestResult({
          success: false,
          message: `USSD test failed: ${text}`,
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Connection error: ${error.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const copyCallbackUrl = () => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ussd-handler`;
    navigator.clipboard.writeText(url);
    showToast('Callback URL copied!');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: 'rgba(255,255,255,0.5)' }}>
        Loading USSD settings...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, background: 'rgba(13,13,25,0.95)',
          border: '1px solid rgba(212,175,55,0.3)', borderRadius: 14, padding: '12px 20px',
          color: '#D4AF37', fontWeight: 600, fontSize: 14, zIndex: 100, backdropFilter: 'blur(20px)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8 }}>USSD Settings</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Configure USSD access for clients to retrieve gallery links via phone
        </p>
      </div>

      {/* Provider Selection */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
          USSD Provider
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {(Object.keys(providerInfo) as USSDProvider[]).map((key) => (
            <button
              key={key}
              onClick={() => setSettings({ ...settings, provider: key })}
              style={{
                padding: 16,
                borderRadius: 12,
                border: settings.provider === key ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                background: settings.provider === key ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                textAlign: 'left' as const,
              }}
            >
              <div style={{ fontWeight: 700, color: settings.provider === key ? '#D4AF37' : 'white', fontSize: 14, marginBottom: 4 }}>
                {providerInfo[key].name}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                {providerInfo[key].description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Provider Info Card */}
      <div style={{
        background: 'rgba(212,175,55,0.05)',
        border: '1px solid rgba(212,175,55,0.2)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#D4AF37', marginBottom: 12 }}>
          {providerInfo[settings.provider].name} Details
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Pricing</div>
            <div style={{ fontSize: 14, color: 'white' }}>{providerInfo[settings.provider].pricing}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Contact</div>
            <div style={{ fontSize: 14, color: 'white' }}>{providerInfo[settings.provider].contact || 'N/A'}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Features</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {providerInfo[settings.provider].features.map((f, i) => (
              <span key={i} style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.08)',
                fontSize: 12,
                color: 'rgba(255,255,255,0.7)',
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>
        {providerInfo[settings.provider].website && (
          <a
            href={providerInfo[settings.provider].website}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 12,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(212,175,55,0.15)',
              color: '#D4AF37',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Visit Website →
          </a>
        )}
      </div>

      {/* Settings Form */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 20 }}>Configuration</h3>

        {/* Short Code */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
            USSD Short Code
          </label>
          <input
            type="text"
            value={settings.shortCode}
            onChange={(e) => setSettings({ ...settings, shortCode: e.target.value })}
            placeholder="*123"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              fontSize: 16,
              fontFamily: 'monospace',
              letterSpacing: 2,
            }}
          />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
            Clients will dial: {settings.shortCode}*{`{ACCESS_CODE}`}#
          </p>
        </div>

        {/* HostPinnacle Settings */}
        {settings.provider === 'hostpinnacle' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                API Key
              </label>
              <input
                type="password"
                value={settings.hostpinnacleApiKey}
                onChange={(e) => setSettings({ ...settings, hostpinnacleApiKey: e.target.value })}
                placeholder="Enter your HostPinnacle API key"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Username
              </label>
              <input
                type="text"
                value={settings.hostpinnacleUsername}
                onChange={(e) => setSettings({ ...settings, hostpinnacleUsername: e.target.value })}
                placeholder="Enter your username"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: 14,
                }}
              />
            </div>
          </>
        )}

        {/* Africa's Talking Settings */}
        {settings.provider === 'africastalking' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                API Key
              </label>
              <input
                type="password"
                value={settings.africastalkingApiKey}
                onChange={(e) => setSettings({ ...settings, africastalkingApiKey: e.target.value })}
                placeholder="Enter your Africa's Talking API key"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Username
              </label>
              <input
                type="text"
                value={settings.africastalkingUsername}
                onChange={(e) => setSettings({ ...settings, africastalkingUsername: e.target.value })}
                placeholder="sandbox or your username"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: 14,
                }}
              />
            </div>
          </>
        )}

        {/* Callback URL */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
            Callback URL
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ussd-handler`}
              readOnly
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={copyCallbackUrl}
              style={{
                padding: '12px 20px',
                borderRadius: 10,
                border: '1px solid rgba(212,175,55,0.3)',
                background: 'rgba(212,175,55,0.1)',
                color: '#D4AF37',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Copy
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
            Configure this URL in your {providerInfo[settings.provider].name} dashboard
          </p>
        </div>

        {/* Active Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Enable USSD Access</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              Allow clients to access galleries via USSD codes
            </div>
          </div>
          <button
            onClick={() => setSettings({ ...settings, isActive: !settings.isActive })}
            style={{
              width: 52,
              height: 28,
              borderRadius: 14,
              border: 'none',
              background: settings.isActive ? '#34C759' : 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              background: 'white',
              position: 'absolute',
              top: 3,
              left: settings.isActive ? 27 : 3,
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      {/* Test Section */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 12 }}>Test USSD</h3>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
          Test your USSD configuration by sending a test request
        </p>

        <button
          onClick={testUSSD}
          disabled={testing}
          style={{
            padding: '12px 24px',
            borderRadius: 10,
            border: 'none',
            background: testing ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #D4AF37, #F0D060)',
            color: testing ? 'rgba(255,255,255,0.5)' : '#080810',
            fontWeight: 700,
            fontSize: 14,
            cursor: testing ? 'not-allowed' : 'pointer',
          }}
        >
          {testing ? 'Testing...' : 'Run Test'}
        </button>

        {testResult && (
          <div style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 10,
            background: testResult.success ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
            border: `1px solid ${testResult.success ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)'}`,
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: testResult.success ? '#34C759' : '#FF3B30',
              marginBottom: 8,
            }}>
              {testResult.success ? '✓ Test Passed' : '✗ Test Failed'}
            </div>
            <pre style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.7)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
            }}>
              {testResult.message}
            </pre>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 40 }}>
        <button
          onClick={loadSettings}
          style={{
            padding: '12px 24px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{
            padding: '12px 32px',
            borderRadius: 10,
            border: 'none',
            background: saving ? 'rgba(212,175,55,0.5)' : 'linear-gradient(135deg, #D4AF37, #F0D060)',
            color: '#080810',
            fontWeight: 700,
            fontSize: 14,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* How It Works */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 40,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>How It Works</h3>
        
        <div style={{ display: 'grid', gap: 16 }}>
          {[
            { step: 1, title: 'Client receives access code', desc: 'After upload, client gets SMS/WhatsApp with their access code' },
            { step: 2, title: 'Client dials USSD code', desc: `Client dials ${settings.shortCode}*{ACCESS_CODE}# on their phone` },
            { step: 3, title: 'USSD gateway processes', desc: `${providerInfo[settings.provider].name} sends request to your callback URL` },
            { step: 4, title: 'Gallery link returned', desc: 'Client receives gallery link via USSD response' },
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: 16 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                background: 'rgba(212,175,55,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37',
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
