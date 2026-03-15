import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Calendar, Tag, ChevronRight, MessageCircle, Star } from 'lucide-react-native';
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

export default function Notifications() {
  const insets = useSafeAreaInsets();
  
  const [push, setPush] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [offers, setOffers] = useState(true);
  const [messages, setMessages] = useState(true);
  const [galleryUpdates, setGalleryUpdates] = useState(true);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Notifications" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={styles.headerSub}>Choose what updates you want to receive.</Text>
        
        <SettingsSection title="GENERAL">
          <SettingsToggle
            icon={<Bell size={18} color={Colors.gold} />}
            label="Push Notifications"
            description="Allow all app notifications"
            value={push}
            onToggle={setPush}
          />
        </SettingsSection>

        {push && (
          <SettingsSection title="CATEGORIES">
            <SettingsToggle
              icon={<Calendar size={18} color="#6C9AED" />}
              label="Booking Reminders"
              description="Alerts for upcoming shoots and sessions"
              value={reminders}
              onToggle={setReminders}
            />
            <SettingsToggle
              icon={<Star size={18} color={Colors.gold} />}
              label="Gallery Updates"
              description="When new photos are ready to view"
              value={galleryUpdates}
              onToggle={setGalleryUpdates}
            />
            <SettingsToggle
              icon={<MessageCircle size={18} color={Colors.textSecondary} />}
              label="Messages"
              description="When the studio sends you a message"
              value={messages}
              onToggle={setMessages}
            />
            <SettingsToggle
              icon={<Tag size={18} color="#10B981" />}
              label="Offers & Promotions"
              description="Exclusive discounts and packages"
              value={offers}
              onToggle={setOffers}
            />
          </SettingsSection>
        )}
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
  settingsRowContent: {
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
    marginBottom: 2,
  },
  settingsRowDescription: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});