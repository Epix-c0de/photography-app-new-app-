'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useBranding, WATERMARK_PRESETS } from '@/contexts/BrandingContext';
import { 
  Droplets, Eye, EyeOff, Save, Loader2, CheckCircle, 
  AlertTriangle, Image, Settings 
} from 'lucide-react';

export default function WatermarkSettingsPage() {
  const { settings, update } = useBranding();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  
  const [isEnabled, setIsEnabled] = useState(true);
  const [watermarkText, setWatermarkText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('center');
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] = useState<string>('center');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.watermark_text !== null && settings.watermark_text !== '');
      setWatermarkText(settings.watermark_text || '');
      setOpacity(settings.watermark_opacity || 30);
      setRotation(settings.watermark_rotation || 45);
      setPosition(settings.watermark_position || 'center');
    }
  }, [settings]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handlePresetSelect = (presetKey: string) => {
    const preset = WATERMARK_PRESETS[presetKey as keyof typeof WATERMARK_PRESETS];
    if (preset) {
      setSelectedPreset(presetKey);
      setOpacity(preset.opacity);
      setRotation(preset.rotation);
      setPosition(preset.position);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await update({
        watermark_text: isEnabled ? watermarkText : null,
        watermark_opacity: opacity,
        watermark_rotation: rotation,
        watermark_position: position as any,
      });
      showToast('Watermark settings saved!');
    } catch (error: any) {
      showToast('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

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
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8 }}>Watermark Settings</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Protect your photos with branded watermarks
        </p>
      </div>

      {/* Enable Toggle */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Droplets size={20} color={isEnabled ? '#D4AF37' : 'rgba(255,255,255,0.3)'} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Enable Watermark</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              Apply watermark to all gallery photos
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          style={{
            width: 52,
            height: 28,
            borderRadius: 14,
            border: 'none',
            background: isEnabled ? '#34C759' : 'rgba(255,255,255,0.2)',
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
            left: isEnabled ? 27 : 3,
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {isEnabled && (
        <>
          {/* Watermark Text */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>Watermark Text</h3>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              placeholder="Enter your studio name"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16,
                marginBottom: 12,
              }}
            />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              This text will appear as a watermark on your photos
            </p>
          </div>

          {/* Preset Selection */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>Quick Presets</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {Object.entries(WATERMARK_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePresetSelect(key)}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: selectedPreset === key ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedPreset === key ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    textAlign: 'left' as const,
                  }}
                >
                  <div style={{ 
                    fontWeight: 700, 
                    color: selectedPreset === key ? '#D4AF37' : 'white', 
                    fontSize: 14, 
                    marginBottom: 4 
                  }}>
                    {preset.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Settings */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 20 }}>Custom Settings</h3>

            {/* Opacity */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  Opacity
                </label>
                <span style={{ fontSize: 13, color: '#D4AF37', fontWeight: 600 }}>
                  {opacity}%
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={opacity}
                onChange={(e) => setOpacity(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.1)',
                  outline: 'none',
                  WebkitAppearance: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Subtle</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Visible</span>
              </div>
            </div>

            {/* Rotation */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  Rotation
                </label>
                <span style={{ fontSize: 13, color: '#D4AF37', fontWeight: 600 }}>
                  {rotation}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.1)',
                  outline: 'none',
                  WebkitAppearance: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>0°</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>360°</span>
              </div>
            </div>

            {/* Position */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
                Position
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { value: 'topLeft', label: 'Top Left' },
                  { value: 'topRight', label: 'Top Right' },
                  { value: 'center', label: 'Center' },
                  { value: 'bottomLeft', label: 'Bottom Left' },
                  { value: 'bottomRight', label: 'Bottom Right' },
                ].map((pos) => (
                  <button
                    key={pos.value}
                    onClick={() => setPosition(pos.value)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 8,
                      border: position === pos.value ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                      background: position === pos.value ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                      color: position === pos.value ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Preview</h3>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(212,175,55,0.3)',
                  background: 'rgba(212,175,55,0.1)',
                  color: '#D4AF37',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
                {previewMode ? 'Hide' : 'Show'} Preview
              </button>
            </div>

            {previewMode && (
              <div style={{
                position: 'relative',
                width: '100%',
                height: 300,
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                {/* Sample image placeholder */}
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.3)',
                }}>
                  <Image size={48} />
                </div>

                {/* Watermark preview */}
                <div style={{
                  position: 'absolute',
                  ...(position === 'center' && {
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  }),
                  ...(position === 'topLeft' && { top: 20, left: 20 }),
                  ...(position === 'topRight' && { top: 20, right: 20 }),
                  ...(position === 'bottomLeft' && { bottom: 20, left: 20 }),
                  ...(position === 'bottomRight' && { bottom: 20, right: 20 }),
                  opacity: opacity / 100,
                  color: 'white',
                  fontSize: position === 'center' ? 24 : 16,
                  fontWeight: 'bold',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                }}>
                  {watermarkText || 'Your Studio Name'}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Save Button */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 40 }}>
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: '12px 32px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'rgba(212,175,55,0.5)' : 'linear-gradient(135deg, #D4AF37, #F0D060)',
            color: '#080810',
            fontWeight: 700,
            fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Info */}
      <div style={{
        background: 'rgba(212,175,55,0.05)',
        border: '1px solid rgba(212,175,55,0.2)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 40,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#D4AF37', marginBottom: 12 }}>About Watermarks</h3>
        <ul style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Watermarks protect your photos from unauthorized use</li>
          <li>They are required by the Kenya Photography Association</li>
          <li>Clients can still view and download photos with watermarks</li>
          <li>Higher opacity = more visible but more protective</li>
          <li>Diagonal rotation is harder to crop out</li>
        </ul>
      </div>
    </div>
  );
}
