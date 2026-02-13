import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';
import { MessageCircle } from 'lucide-react-native';

export default function HelpSupport() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Help & Support" />
      
      <View style={styles.content}>
        <View style={styles.section}>
          <Pressable style={styles.row}>
            <Text style={styles.label}>FAQs</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row}>
            <Text style={styles.label}>Contact Us</Text>
          </Pressable>
        </View>
        
        <Pressable style={styles.chatButton}>
          <MessageCircle size={24} color={Colors.white} />
          <Text style={styles.chatButtonText}>Start Live Chat</Text>
        </Pressable>
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
    paddingHorizontal: 16,
  },
  row: {
    paddingVertical: 16,
  },
  label: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    padding: 16,
    borderRadius: 30,
    gap: 12,
    marginTop: 32,
  },
  chatButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  }
});