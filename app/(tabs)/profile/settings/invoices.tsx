import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { FileText } from 'lucide-react-native';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';

export default function Invoices() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Invoices" />
      
      <View style={styles.emptyState}>
        <FileText size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>0 invoices</Text>
        <Text style={styles.emptyDesc}>When you complete a paid booking your invoices will appear here</Text>
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
    lineHeight: 24,
  }
});