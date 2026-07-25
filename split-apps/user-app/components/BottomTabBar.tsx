import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Home, Images, Calendar, MessageCircle, User } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const TABS = [
  { name: 'Home', icon: Home, route: '/(tabs)/home' },
  { name: 'Galleries', icon: Images, route: '/(tabs)/gallery' },
  { name: 'Bookings', icon: Calendar, route: '/(tabs)/bookings' },
  { name: 'Chat', icon: MessageCircle, route: '/(tabs)/chat' },
  { name: 'Profile', icon: User, route: '/(tabs)/profile' },
];

export default function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const TAB_BAR_HEIGHT = 72;
  const TAB_BAR_BOTTOM = Math.max(insets.bottom + 14, 20);

  const isActive = (route: string) => {
    if (route.includes('home')) return pathname.startsWith('/(tabs)/home') || pathname.startsWith('/announcements') || pathname.startsWith('/bts');
    if (route.includes('gallery')) return pathname.startsWith('/(tabs)/gallery') || pathname.startsWith('/gallery');
    if (route.includes('bookings')) return pathname.startsWith('/(tabs)/bookings') || pathname.startsWith('/bookings');
    if (route.includes('chat')) return pathname.startsWith('/(tabs)/chat') || pathname.startsWith('/chat');
    if (route.includes('profile')) return pathname.startsWith('/(tabs)/profile');
    return pathname === route;
  };

  return (
    <View style={[styles.container, { bottom: TAB_BAR_BOTTOM, height: TAB_BAR_HEIGHT }]}>
      <BlurView intensity={90} tint="dark" style={styles.blurContainer} />
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = isActive(tab.route);
          const color = active ? Colors.gold : 'rgba(255,255,255,0.45)';
          return (
            <Pressable
              key={tab.name}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace(tab.route as any);
              }}
            >
              <View style={[styles.iconWrapper, active && styles.iconWrapperActive]}>
                <tab.icon size={20} color={color} strokeWidth={active ? 2.5 : 2} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 22,
    overflow: 'hidden',
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(14, 14, 18, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
    paddingHorizontal: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  tabItemActive: {},
  iconWrapper: {
    width: 36,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
  },
});
