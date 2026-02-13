import { View, Text, StyleSheet, Switch } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';
import { useState } from 'react';

function ToggleRow({ label, value, onValueChange }: { label: string, value: boolean, onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.gold }}
      />
    </View>
  );
}

export default function Notifications() {
  const [push, setPush] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [offers, setOffers] = useState(true);
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Notifications" />
      
      <View style={styles.content}>
        <View style={styles.section}>
          <ToggleRow label="Push Notifications" value={push} onValueChange={setPush} />
          <View style={styles.divider} />
          <ToggleRow label="Booking Reminders" value={reminders} onValueChange={setReminders} />
          <View style={styles.divider} />
          <ToggleRow label="Offers & Promotions" value={offers} onValueChange={setOffers} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  }
});