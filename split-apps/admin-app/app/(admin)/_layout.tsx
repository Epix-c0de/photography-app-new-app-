import { Tabs } from 'expo-router';
import { LayoutDashboard, Users, Calendar, MessageSquare, Settings, Upload, Camera } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminTabLayout() {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id || user.role !== 'admin') return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`presence_admin_${user.id}`)
      .subscribe();

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

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, user?.role]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: 'rgba(212,175,55,0.15)',
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600' as const,
          letterSpacing: 0.3,
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <LayoutDashboard size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Users size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="admin-bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Calendar size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <MessageSquare size={20} color={color} />
            </View>
          ),
          tabBarBadge: 6,
          tabBarBadgeStyle: {
            backgroundColor: Colors.error,
            fontSize: 9,
            fontWeight: '700' as const,
            minWidth: 16,
            height: 16,
            lineHeight: 16,
          },
        }}
      />
      <Tabs.Screen
        name="bts-announcements"
        options={{
          title: 'BTS & Announcements',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Camera size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Upload size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="post-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Settings size={20} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIcon: {
    transform: [{ scale: 1.1 }],
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
});
