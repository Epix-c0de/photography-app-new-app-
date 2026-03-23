import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { Clipboard, Ticket } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';

export default function MemberBenefits() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Member Benefits" />
      
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Member</Text>
          <Text style={styles.subtitle}>Enjoy 10% off your next booking</Text>
          
          <View style={styles.codeContainer}>
            <Ticket size={24} color={Colors.gold} />
            <Text style={styles.code}>MEMBER10</Text>
            <Pressable onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
              <Clipboard size={20} color={Colors.textMuted} />
            </Pressable>
          </View>
          
          <Text style={styles.terms}>* Valid for one-time use. Expires in 30 days.</Text>
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
  card: {
    backgroundColor: Colors.card,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.gold,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gold,
    width: '100%',
    justifyContent: 'center',
  },
  code: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  terms: {
    fontSize: 12,
    color: Colors.textMuted,
  }
});