import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';

export default function PrivacySecurity() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Privacy & Security" />
      
      <View style={styles.content}>
        <View style={styles.section}>
          <Pressable style={styles.row}>
            <Text style={styles.label}>Change Password</Text>
            <ChevronRight size={20} color={Colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row}>
            <Text style={styles.label}>Two-Factor Authentication</Text>
            <Text style={styles.value}>Off</Text>
          </Pressable>
        </View>
        
        <Text style={styles.sectionHeader}>Data Controls</Text>
        <View style={styles.section}>
          <Pressable style={styles.row}>
            <Text style={styles.label}>Download My Data</Text>
            <ChevronRight size={20} color={Colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row}>
            <Text style={[styles.label, { color: Colors.error }]}>Delete My Account</Text>
          </Pressable>
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
  sectionHeader: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  label: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  value: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  }
});