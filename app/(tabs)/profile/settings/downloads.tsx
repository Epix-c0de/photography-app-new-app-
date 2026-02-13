import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Download } from 'lucide-react-native';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';

export default function Downloads() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Downloads" />
      
      <View style={styles.emptyState}>
        <Download size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No downloads yet</Text>
        <Text style={styles.emptyDesc}>Re-download your past galleries here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  }
});