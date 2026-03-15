import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Smartphone, Wifi, Trash2, HardDrive, Moon, Sun, Monitor } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';

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

function SettingsRow({ icon, label, description, value, onPress, showArrow, danger }: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress} disabled={!onPress}>
      <View style={[styles.settingsRowIcon, danger && styles.settingsRowIconDanger]}>
        {icon}
      </View>
      <View style={styles.settingsRowContent}>
        <Text style={[styles.settingsRowLabel, danger && styles.settingsRowLabelDanger]}>{label}</Text>
        {description && <Text style={styles.settingsRowDescription}>{description}</Text>}
        {value && <Text style={styles.settingsRowValue}>{value}</Text>}
      </View>
      {showArrow && <ChevronRight size={16} color={Colors.textMuted} />}
    </Pressable>
  );
}

function SettingsToggle({ icon, label, description, value, onToggle }: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowIcon}>
        {icon}
      </View>
      <View style={styles.settingsRowContent}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        {description && <Text style={styles.settingsRowDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(val) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(val);
        }}
        trackColor={{ false: Colors.border, true: Colors.goldMuted }}
        thumbColor={value ? Colors.gold : Colors.textMuted}
      />
    </View>
  );
}

export default function AppSettings() {
  const insets = useSafeAreaInsets();
  const [wifiOnly, setWifiOnly] = useState(false);
  const [theme, setTheme] = useState<'system'|'dark'|'light'>('dark');

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear 12 MB of cached images?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
             Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
             Alert.alert('Success', 'Cache cleared.');
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
        <Text style={styles.headerSub}>Manage display, storage, and data usage.</Text>
        
        <SettingsSection title="APPEARANCE">
          <View style={styles.themeSelectorRow}>
            <Pressable 
              style={[styles.themeBox, theme === 'system' && styles.themeBoxActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTheme('system');
              }}
            >
              <Monitor size={24} color={theme === 'system' ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.themeBoxText, theme === 'system' && styles.themeBoxTextActive]}>Auto</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.themeBox, theme === 'dark' && styles.themeBoxActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTheme('dark');
              }}
            >
              <Moon size={24} color={theme === 'dark' ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.themeBoxText, theme === 'dark' && styles.themeBoxTextActive]}>Dark</Text>
            </Pressable>

            <Pressable 
              style={[styles.themeBox, theme === 'light' && styles.themeBoxActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTheme('light');
              }}
            >
              <Sun size={24} color={theme === 'light' ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.themeBoxText, theme === 'light' && styles.themeBoxTextActive]}>Light</Text>
            </Pressable>
          </View>
        </SettingsSection>

        <SettingsSection title="DATA USAGE">
          <SettingsToggle
            icon={<Wifi size={18} color="#6C9AED" />}
            label="Stream over Wi-Fi only"
            description="Reduce cellular data usage for high-res images"
            value={wifiOnly}
            onToggle={setWifiOnly}
          />
        </SettingsSection>
        
        <SettingsSection title="STORAGE">
          <SettingsRow
            icon={<HardDrive size={18} color={Colors.textSecondary} />}
            label="App Storage"
            value="1.2 GB"
          />
          <SettingsRow
            icon={<Trash2 size={18} color={Colors.error} />}
            label="Clear Image Cache"
            description="Free up space on your device"
            value="12 MB"
            onPress={handleClearCache}
            showArrow
          />
        </SettingsSection>
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
  headerSub: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingsRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsRowIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  settingsRowContent: {
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
    marginBottom: 2,
  },
  settingsRowLabelDanger: {
    color: Colors.error,
  },
  settingsRowDescription: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  settingsRowValue: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 12,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    justifyContent: 'space-between',
  },
  themeBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  themeBoxActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  themeBoxText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  themeBoxTextActive: {
    color: Colors.gold,
  },
});