import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Images, CreditCard, Calendar, Megaphone, Bell, Check, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const iconMap: Record<string, React.ReactNode> = {
  gallery: <Images size={20} color="#3B82F6" />,
  gallery_ready: <Images size={20} color="#3B82F6" />,
  payment: <CreditCard size={20} color={Colors.success} />,
  booking: <Calendar size={20} color={Colors.gold} />,
  package: <Calendar size={20} color={Colors.gold} />,
  promo: <Megaphone size={20} color="#E879F9" />,
  system: <Bell size={20} color={Colors.textSecondary} />,
};

const bgMap: Record<string, string> = {
  gallery: 'rgba(59,130,246,0.12)',
  gallery_ready: 'rgba(59,130,246,0.12)',
  payment: 'rgba(46,204,113,0.12)',
  booking: 'rgba(212,175,55,0.12)',
  package: 'rgba(212,175,55,0.12)',
  promo: 'rgba(232,121,249,0.12)',
  system: 'rgba(160,160,160,0.12)',
};

function NotificationItem({ item, onPress, onDelete }: { item: Notification; onPress: (notification: Notification) => void; onDelete: (notification: Notification) => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [item, onPress, scaleAnim]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDelete(item);
      }}
      delayLongPress={220}
    >
      <Animated.View style={[styles.notifItem, !item.read && styles.notifItemUnread, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.notifIcon, { backgroundColor: bgMap[item.type] || bgMap.system }]}>
          {iconMap[item.type] || iconMap.system}
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>{item.title}</Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <View style={styles.notifFooter}>
            <Text style={styles.notifTime}>{item.timestamp}</Text>
            {item.actionLabel && (
              <Pressable style={styles.actionChip} onPress={handlePress}>
                <Text style={styles.actionChipText}>{item.actionLabel}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'gallery' | 'gallery_ready' | 'payment' | 'booking' | 'promo' | 'system' | 'package';
  read: boolean;
  timestamp: string;
  actionLabel?: string;
  // Deep linking fields
  access_code?: string;
  gallery_id?: string;
  client_id?: string;
  bts_id?: string;
  announcement_id?: string;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);

  const unreadCount = notifs.filter(n => !n.read).length;

  const markRead = useCallback(async (id: string) => {
    try {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      // Permanently mark as read in database
      const payload: Record<string, any> = { read: true, is_read: true, read_at: new Date().toISOString() };
      const { error } = await supabase
        .from('notifications')
        .update(payload)
        .eq('id', id);
      if (error) {
        const fallback: Record<string, any> = { read: true, is_read: true };
        const retry = await supabase.from('notifications').update(fallback).eq('id', id);
        if (retry.error) throw retry.error;
      }
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  }, []);

  const handleNotificationPress = useCallback((notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markRead(notification.id);
    }

    // Handle deep linking based on type
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const lowerTitle = notification.title.toLowerCase();
    const isPackageNotification = notification.type === 'package' || lowerTitle.includes('package');

    if (notification.access_code || notification.gallery_id || notification.type === 'gallery' || notification.type === 'gallery_ready') {
      router.push({
        pathname: '/(tabs)/gallery',
        params: notification.access_code ? { accessCode: notification.access_code, autoUnlock: 'true' } : undefined
      });
      return;
    }

    if (notification.bts_id) {
      router.push(`/bts/${notification.bts_id}` as any);
      return;
    }

    if (notification.announcement_id) {
      router.push(`/announcements/${notification.announcement_id}` as any);
      return;
    }

    if (isPackageNotification) {
      router.push({ pathname: '/(tabs)/bookings', params: { section: 'packages' } });
      return;
    }

    switch (notification.type) {
      case 'booking':
        router.push({ pathname: '/(tabs)/bookings', params: { section: 'bookings' } });
        break;

      case 'payment':
        // If it's a package update notification, redirect to packages
        if (notification.title.toLowerCase().includes('package')) {
          router.push({ pathname: '/(tabs)/bookings', params: { section: 'packages' } });
        } else {
          router.push('/(tabs)/profile');
        }
        break;

      case 'promo':
        router.push('/(tabs)/home');
        break;

      default:
        router.push('/(tabs)/home');
    }
  }, [markRead, router]);

  const markAllRead = useCallback(async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      
      if (!user) return;
      const payload: Record<string, any> = { read: true, is_read: true, read_at: new Date().toISOString() };
      const { error } = await supabase
        .from('notifications')
        .update(payload)
        .eq('user_id', user.id)
        .or('read.eq.false,is_read.eq.false');
      if (error) {
        const retry = await supabase
          .from('notifications')
          .update({ read: true, is_read: true })
          .eq('user_id', user.id);
        if (retry.error) throw retry.error;
      }
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  }, [user]);

  const deleteNotification = useCallback(async (notification: Notification) => {
    Alert.alert(
      'Delete Notification',
      'Do you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setNotifs((prev) => prev.filter((n) => n.id !== notification.id));
              const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notification.id);
              if (error) throw error;
            } catch (e) {
              console.error('Failed to delete notification:', e);
            }
          },
        },
      ]
    );
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert(
      'Clear Notifications',
      'Do you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setNotifs([]);
              if (!user) return;
              const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id);
              if (error) throw error;
            } catch (e) {
              console.error('Failed to clear notifications:', e);
            }
          },
        },
      ]
    );
  }, [user]);

  // Load notifications and set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const loadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const formattedNotifs: Notification[] = (data || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          body: n.body ?? n.message ?? '',
          type: n.type as any,
          read: (n.read ?? n.is_read) === true,
          timestamp: new Date(n.created_at).toLocaleDateString(),
          actionLabel: n.type === 'gallery' || n.type === 'gallery_ready'
            ? 'View Gallery'
            : n.type === 'promo'
              ? 'Check it out'
              : n.type === 'package'
                ? 'View Packages'
                : undefined,
          access_code: (n.data as any)?.accessCode ?? n.access_code,
          gallery_id: (n.data as any)?.galleryId ?? n.gallery_id,
          client_id: (n.data as any)?.clientId ?? n.client_id,
          bts_id: (n.data as any)?.btsId,
          announcement_id: (n.data as any)?.announcementId,
        }));

        setNotifs(formattedNotifs);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    };

    loadNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel('user_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newNotif = payload.new;
        const formattedNotif: Notification = {
          id: (newNotif as any).id,
          title: (newNotif as any).title,
          body: (newNotif as any).body ?? (newNotif as any).message ?? '',
          type: (newNotif as any).type,
          read: ((newNotif as any).read ?? (newNotif as any).is_read) === true,
          timestamp: new Date(newNotif.created_at).toLocaleDateString(),
          actionLabel: newNotif.type === 'gallery' || newNotif.type === 'gallery_ready'
            ? 'View Gallery'
            : newNotif.type === 'promo'
              ? 'Check it out'
              : newNotif.type === 'package'
                ? 'View Packages'
                : undefined,
          access_code: (newNotif as any).data?.accessCode ?? (newNotif as any).access_code,
          gallery_id: (newNotif as any).data?.galleryId ?? (newNotif as any).gallery_id,
          client_id: (newNotif as any).data?.clientId ?? (newNotif as any).client_id,
          bts_id: newNotif.data?.btsId,
          announcement_id: newNotif.data?.announcementId,
        };

        setNotifs(prev => [formattedNotif, ...prev]);

        // Haptic feedback for new notification
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8} style={styles.headerAction}>
              <Check size={18} color={Colors.gold} />
            </Pressable>
          )}
          {notifs.length > 0 && (
            <Pressable onPress={clearAll} hitSlop={8} style={styles.headerAction}>
              <Trash2 size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {notifs.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Bell size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyDesc}>No notifications right now. We&apos;ll let you know when something happens.</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationItem item={item} onPress={handleNotificationPress} onDelete={deleteNotification} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  headerBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  headerActions: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardLight,
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 8,
  },
  notifItem: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifItemUnread: {
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(26,26,26,0.95)',
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: '700' as const,
    color: Colors.white,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  notifBody: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    marginBottom: 8,
  },
  notifFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  actionChip: {
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
