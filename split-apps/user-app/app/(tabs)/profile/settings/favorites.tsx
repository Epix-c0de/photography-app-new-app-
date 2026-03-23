import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Heart } from 'lucide-react-native';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';

export default function Favorites() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Favorites" />
      
      <View style={styles.header}>
        <Text style={styles.count}>Your liked photos – 0</Text>
      </View>
      
      <View style={styles.emptyState}>
        <Heart size={48} color={Colors.textMuted} />
        <Text style={styles.emptyDesc}>Photos you like will appear here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  count: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyDesc: {
    color: Colors.textMuted,
    fontSize: 16,
  }
});