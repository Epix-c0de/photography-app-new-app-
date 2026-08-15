import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import {
  LayoutDashboard,
  Images,
  Users,
  CalendarDays,
  MessageSquare,
  MoreHorizontal,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

export default function AdminLayout() {
  const insets = useSafeAreaInsets();

  const tabConfig = [
    { name: 'dashboard', title: 'Home', icon: LayoutDashboard },
    { name: 'upload', title: 'Galleries', icon: Images, href: '/(admin)/upload' },
    { name: 'clients', title: 'Clients', icon: Users },
    { name: 'calendar', title: 'Bookings', icon: CalendarDays },
    { name: 'inbox', title: 'Inbox', icon: MessageSquare },
    { name: 'more', title: 'More', icon: MoreHorizontal },
  ] as const;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarStyle: {
          backgroundColor: 'rgba(12,12,20,0.95)',
          borderTopColor: 'rgba(212,175,55,0.15)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 + insets.bottom : 72,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          paddingHorizontal: 8,
          ...Platform.select({
            web: {
              position: 'sticky',
              bottom: 0,
              width: '100%',
              backdropFilter: 'blur(20px)',
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 3,
        },
        tabBarIconStyle: {
          marginBottom: 1,
        },
      }}
    >
      {tabConfig.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <tab.icon
                size={focused ? 26 : 23}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />
      ))}

      {/* ── Hidden Screens (accessible from More, not in tab bar) ── */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="social" options={{ href: null }} />
      <Tabs.Screen name="reviews" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="portfolio" options={{ href: null }} />
      <Tabs.Screen name="sms-history" options={{ href: null }} />
      <Tabs.Screen name="admin-management" options={{ href: null }} />
      <Tabs.Screen name="bts-announcements" options={{ href: null }} />
      <Tabs.Screen name="admin-bookings" options={{ href: null }} />
      <Tabs.Screen name="post-details" options={{ href: null }} />
    </Tabs>
  );
}
