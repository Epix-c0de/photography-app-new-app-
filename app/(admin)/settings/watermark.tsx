import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Droplets, Eye, EyeOff, Save, Loader2, CheckCircle } from 'lucide-react';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useBranding } from '@/contexts/BrandingContext';
import SettingsHeader from '@/components/SettingsHeader';

const WATERMARK_PRESETS = [
  { key: 'center', label: 'Center', description: 'Diagonal in center' },
  { key: 'bottomRight', label: 'Bottom Right', description: 'Small corner' },
  { key: 'bottomLeft', label: 'Bottom Left', description: 'Left corner' },
  { key: 'topRight', label: 'Top Right', description: 'Upper corner' },
  { key: 'tiled', label: 'Tiled', description: 'Maximum protection' },
];

export default function WatermarkSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, update } = useBranding();
  const [loading, setLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [watermarkText, setWatermarkText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('center');
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] = useState('center');

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.watermark_text !== null && settings.watermark_text !== '');
      setWatermarkText(settings.watermark_text || '');
      setOpacity(settings.watermark_opacity || 30);
      setRotation(settings.watermark_rotation || 45);
      setPosition(settings.watermark_position || 'center');
    }
  }, [settings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await update({
        watermark_text: isEnabled ? watermarkText : null,
        watermark_opacity: opacity,
        watermark_rotation: rotation,
        watermark_position: position as any,
      });
      Alert.alert('Success', 'Watermark settings saved!');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    setSelectedPreset(presetKey);
    switch (presetKey) {
      case 'center':
        setOpacity(30);
        setRotation(45);
        setPosition('center');
        break;
      case 'bottomRight':
        setOpacity(40);
        setRotation(0);
        setPosition('bottomRight');
        break;
      case 'bottomLeft':
        setOpacity(40);
        setRotation(0);
        setPosition('bottomLeft');
        break;
      case 'topRight':
        setOpacity(35);
        setRotation(0);
        setPosition('topRight');
        break;
      case 'tiled':
        setOpacity(15);
        setRotation(45);
        setPosition('center');
        break;
    }
  };

  return (
    <View style={styles.container}>
      <SettingsHeader title="Watermark Settings" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Enable Toggle */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Droplets size={20} color={isEnabled ? Colors.gold : Colors.textMuted} />
              <View>
                <Text style={styles.toggleLabel}>Enable Watermark</Text>
                <Text style={styles.toggleDescription}>Apply watermark to photos</Text>
              </View>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              trackColor={{ false: Colors.border, true: Colors.goldMuted }}
              thumbColor={isEnabled ? Colors.gold : Colors.textMuted}
            />
          </View>
        </View>

        {isEnabled && (
          <>
            {/* Watermark Text */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Watermark Text</Text>
              <TextInput
                style={styles.input}
                value={watermarkText}
                onChangeText={setWatermarkText}
                placeholder="Enter your studio name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Presets */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Presets</Text>
              <View style={styles.presetGrid}>
                {WATERMARK_PRESETS.map((preset) => (
                  <Pressable
                    key={preset.key}
                    style={[
                      styles.presetBtn,
                      selectedPreset === preset.key && styles.presetBtnActive,
                    ]}
                    onPress={() => handlePresetSelect(preset.key)}
                  >
                    <Text style={[
                      styles.presetLabel,
                      selectedPreset === preset.key && styles.presetLabelActive,
                    ]}>
                      {preset.label}
                    </Text>
                    <Text style={styles.presetDescription}>{preset.description}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Opacity */}
            <View style={styles.card}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Opacity</Text>
                <Text style={styles.sliderValue}>{opacity}%</Text>
              </View>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${opacity}%` }]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabelSmall}>Subtle</Text>
                <Text style={styles.sliderLabelSmall}>Visible</Text>
              </View>
            </View>

            {/* Rotation */}
            <View style={styles.card}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Rotation</Text>
                <Text style={styles.sliderValue}>{rotation}°</Text>
              </View>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${(rotation / 360) * 100}%` }]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabelSmall}>0°</Text>
                <Text style={styles.sliderLabelSmall}>360°</Text>
              </View>
            </View>

            {/* Position */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Position</Text>
              <View style={styles.positionGrid}>
                {[
                  { value: 'topLeft', label: 'TL' },
                  { value: 'topRight', label: 'TR' },
                  { value: 'center', label: 'C' },
                  { value: 'bottomLeft', label: 'BL' },
                  { value: 'bottomRight', label: 'BR' },
                ].map((pos) => (
                  <Pressable
                    key={pos.value}
                    style={[
                      styles.positionBtn,
                      position === pos.value && styles.positionBtnActive,
                    ]}
                    onPress={() => setPosition(pos.value)}
                  >
                    <Text style={[
                      styles.positionLabel,
                      position === pos.value && styles.positionLabelActive,
                    ]}>
                      {pos.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Preview */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Preview</Text>
              <View style={styles.previewBox}>
                <Text style={[
                  styles.previewText,
                  { opacity: opacity / 100, transform: [{ rotate: `${rotation}deg` }] }
                ]}>
                  {watermarkText || 'Your Studio Name'}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Save Button */}
        <Pressable
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={18} color={Colors.background} style={{ transform: [{ rotate: '0deg' }] }} />
          ) : (
            <Save size={18} color={Colors.background} />
          )}
          <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Settings'}</Text>
        </Pressable>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Watermarks</Text>
          <Text style={styles.infoText}>
            • Protects photos from unauthorized use{'\n'}
            • Required by Kenya Photography Association{'\n'}
            • Higher opacity = more visible{'\n'}
            • Diagonal rotation is harder to crop
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    color: Colors.white,
    fontSize: 16,
  },
  presetGrid: {
    gap: 8,
  },
  presetBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
  },
  presetBtnActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: Colors.gold,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  presetLabelActive: {
    color: Colors.gold,
  },
  presetDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabelSmall: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  positionBtn: {
    width: 60,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionBtnActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: Colors.gold,
  },
  positionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  positionLabelActive: {
    color: Colors.gold,
  },
  previewBox: {
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  infoCard: {
    backgroundColor: 'rgba(212,175,55,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
});
