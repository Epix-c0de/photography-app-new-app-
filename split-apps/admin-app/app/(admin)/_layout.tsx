import { Tabs } from 'expo-router';
import { LayoutDashboard, Users, Calendar, MessageSquare, Settings, Upload, Camera, Crown } from 'lucide-react-native';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const galleryTabPressRef = { current: 0 };

export default function AdminTabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Tab bar pill — same approach as user app
  const TAB_BAR_HEIGHT = 68;
  const TAB_BAR_BOTTOM = Math.max(insets.bottom + 10, 16);
  const SCENE_PADDING_BOTTOM = TAB_BAR_BOTTOM + TAB_BAR_HEIGHT + 8;

  useEffect(() => {
    if (!user?.id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`presence_admin_${user.id}`).subscribe();
    channelRef.current = channel;

    const sendPing = () => {
      channel.send({
        type: 'broadcast',
        event: 'status',
        payload: { role: 'admin', userId: user.id, ts: Date.now() },
      } as any);
    };
    sendPing();
    intervalRef.current = setInterval(sendPing, 15000);

    const fetchUnreadCount = async () => {
      try {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_role', 'client')
          .eq('is_read', false);
        setUnreadCount(count || 0);
      } catch {}
    };
    fetchUnreadCount();

    const messageSubscription = supabase
      .channel('admin_messages_unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'sender_role=eq.client' },
        () => setUnreadCount(prev => prev + 1)
      )
      .subscribe();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      supabase.removeChannel(messageSubscription);
    };
  }, [user?.id]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: Colors.background,
          paddingBottom: SCENE_PADDING_BOTTOM,
        },
        tabBarBackground: () => (
          <BlurView intensity={100} tint="dark" style={styles.blurContainer} />
        ),
        tabBarStyle: {
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: TAB_BAR_BOTTOM,
          height: TAB_BAR_HEIGHT,
          borderRadius: 22,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowColor: Colors.gold,
          shadowOpacity: 0.15,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          overflow: 'hidden',
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600' as const,
          letterSpacing: 0.2,
          marginBottom: 4,
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={LayoutDashboard} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Users} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin-bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Calendar} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <TabIcon Icon={MessageSquare} color={color} focused={focused} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="bts-announcements"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Camera} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Upload} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin-management"
        options={{
          title: 'Admins',
          href: user?.email === 'epixshots002@gmail.com' ? '/(admin)/admin-management' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Crown} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Settings} color={color} focused={focused} />
          ),
        }}
      />
      {/* post-details hidden from nav — accessible via navigation from Create tab */}
      <Tabs.Screen name="post-details" options={{ href: null }} />
    </Tabs>
  );
}

const TabIcon = ({ Icon, color, focused }: { Icon: any; color: string; focused: boolean }) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
    <Icon size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
  </View>
);

const styles = StyleSheet.create({
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 14, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  iconWrap: {
    position: 'relative',
  },
  iconContainer: {
    width: 36,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
