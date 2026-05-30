import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Moon, Wifi, HardDrive, Trash2, ChevronLeft, Sun, Smartphone, DownloadCloud, Database, Shield } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ 
  icon, 
  label, 
  value, 
  description,
  onPress 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value?: string; 
  description?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable 
      style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.7 }]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.rowIconBox}>
        {icon}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description && <Text style={styles.rowDesc}>{description}</Text>}
      </View>
      {value && <Text style={styles.rowValue}>{value}</Text>}
    </Pressable>
  );
}

function SettingsToggle({ 
  icon, 
  label, 
  description,
  value, 
  onToggle 
}: { 
  icon: React.ReactNode; 
  label: string; 
  description?: string;
  value: boolean; 
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconBox}>
        {icon}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description && <Text style={styles.rowDesc}>{description}</Text>}
      </View>
      <Switch 
        value={value} 
        onValueChange={onToggle}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: Colors.gold }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

export default function AppSettings() {
  const insets = useSafeAreaInsets();
  const [wifiOnly, setWifiOnly] = useState(false);
  const [theme, setTheme] = useState<'system'|'dark'|'light'>('dark');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const val = await AsyncStorage.getItem('user_wifiOnly');
        if (val !== null) setWifiOnly(val === 'true');
      } catch (e) {}
    };
    loadSettings();
  }, []);

  const handleToggleWifi = async (val: boolean) => {
    setWifiOnly(val);
    try {
      await AsyncStorage.setItem('user_wifiOnly', String(val));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all cached images? This will free up storage but images may take longer to load next time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Cache', 
          style: 'destructive',
          onPress: async () => {
             try {
               await Image.clearDiskCache();
               await Image.clearMemoryCache();
               Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
               Alert.alert('Success', 'Image cache cleared successfully.');
             } catch (e) {
               console.error('Failed to clear cache:', e);
               Alert.alert('Error', 'Failed to clear cache.');
             }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="App Settings" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={styles.headerSub}>Manage your app experience, storage, and data usage preferences.</Text>
        
        <SettingsSection title="APPEARANCE">
          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <View style={styles.themeSelectorRow}>
              <Pressable style={[styles.themeBox, styles.themeBoxActive]}>
                <Moon size={24} color={Colors.gold} />
                <Text style={[styles.themeBoxText, styles.themeBoxTextActive]}>Dark (Locked)</Text>
              </Pressable>
              <Pressable style={[styles.themeBox, { opacity: 0.5 }]} disabled>
                <Sun size={24} color={Colors.textMuted} />
                <Text style={styles.themeBoxText}>Light</Text>
              </Pressable>
              <Pressable style={[styles.themeBox, { opacity: 0.5 }]} disabled>
                <Smartphone size={24} color={Colors.textMuted} />
                <Text style={styles.themeBoxText}>System</Text>
              </Pressable>
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              Epix Visuals is optimized for Dark Mode to highlight your beautiful photos.
            </Text>
          </BlurView>
        </SettingsSection>

        <SettingsSection title="DATA & DOWNLOADS">
          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <SettingsToggle
              icon={<Wifi size={20} color="#6C9AED" />}
              label="Stream over Wi-Fi only"
              description="Reduce cellular data usage for high-res images"
              value={wifiOnly}
              onToggle={handleToggleWifi}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={<DownloadCloud size={20} color="#4CAF50" />}
              label="Download Quality"
              description="Original resolution"
              value="Highest"
            />
          </BlurView>
        </SettingsSection>
        
        <SettingsSection title="STORAGE MANAGEMENT">
          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <SettingsRow
              icon={<Database size={20} color={Colors.gold} />}
              label="App Storage"
              description="Space used by Epix Visuals"
              value="~ 150 MB"
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={<Trash2 size={20} color={Colors.error} />}
              label="Clear Image Cache"
              description="Free up space on your device"
              onPress={handleClearCache}
            />
          </BlurView>
        </SettingsSection>

        <SettingsSection title="ABOUT">
          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <SettingsRow
              icon={<Shield size={20} color={Colors.textSecondary} />}
              label="Version"
              value="2.0.1 (Build 42)"
            />
          </BlurView>
        </SettingsSection>

        <View style={styles.footerLogo}>
          <Text style={styles.footerText}>Powered by Lexnart</Text>
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
    paddingTop: 20,
  },
  headerSub: {
    fontSize: 14,
    color: Colors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 24,
    lineHeight: 22,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 12,
    letterSpacing: 1,
    marginLeft: 4,
  },
  sectionContent: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  glassCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 4,
    backgroundColor: 'rgba(20,20,20,0.4)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rowIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  rowValue: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 64,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  themeBox: {
    flex: 1,
    height: 90,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  themeBoxActive: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderColor: Colors.gold,
  },
  themeBoxText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  themeBoxTextActive: {
    color: Colors.gold,
  },
  footerLogo: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
  },
});