import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

interface SettingsHeaderProps {
  title: string;
}

export default function SettingsHeader({ title }: SettingsHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable 
        style={styles.backButton} 
        onPress={() => router.back()}
        hitSlop={20}
      >
        <ChevronLeft size={24} color={Colors.gold} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  backText: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.white,
  },
  placeholder: {
    minWidth: 60,
  }
});