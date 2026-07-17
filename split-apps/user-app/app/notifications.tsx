import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, SectionList, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Images, CreditCard, Calendar, Megaphone, Bell, Check, Trash2, ChevronRight, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { demoNotifications } from '@/lib/demo';

type NotificationType = 'gallery' | 'gallery_ready' | 'payment' | 'booking' | 'promo' | 'system' | 'package';
type NotificationFilter = 'all' | 'unread' | 'payments' | 'galleries' | 'bookings';

const iconMap: Record<NotificationType, ReactNode> = {
  gallery: <Images size={20} color="#3B82F6" />,
  gallery_ready: <Images size={20} color="#3B82F6" />,
  payment: <CreditCard size={20} color={Colors.success} />,
  booking: <Calendar size={20} color={Colors.gold} />,
  package: <Calendar size={20} color={Colors.gold} />,
  promo: <Megaphone size={20} color="#E879F9" />,
  system: <Bell size={20} color={Colors.textSecondary} />,
};

const accentMap: Record<NotificationType, string> = {
  gallery: '#3B82F6',
  gallery_ready: '#60A5FA',
  payment: Colors.success,
  booking: Colors.gold,
  package: Colors.goldLight,
  promo: '#E879F9',
  system: Colors.textMuted,
};

const bgMap: Record<NotificationType, string> = {
  gallery: 'rgba(59,130,246,0.12)',
  gallery_ready: 'rgba(59,130,246,0.12)',
  payment: 'rgba(46,204,113,0.12)',
  booking: 'rgba(212,175,55,0.12)',
  package: 'rgba(212,175,55,0.12)',
  promo: 'rgba(232,121,249,0.12)',
  system: 'rgba(160,160,160,0.12)',
};

const filterOptions: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'payments', label: 'Payments' },
  { key: 'galleries', label: 'Galleries' },
  { key: 'bookings', label: 'Bookings' },
];

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getSectionTitle(iso: string) {
  const created = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (created >= startOfToday) return 'Today';
  if (created >= startOfWeek) return 'Earlier this week';
  return 'Older';
}

function getActionLabel(type: NotificationType) {
  switch (type) {
    case 'gallery':
    case 'gallery_ready':
      return 'Open gallery';
    case 'payment':
      return 'Pay now';
    case 'booking':
      return 'View booking';
    case 'package':
      return 'View packages';
    case 'promo':
      return 'See offer';
    default:
      return undefined;
  }
}

function getTypeLabel(type: NotificationType) {
  switch (type) {
    case 'gallery_ready':
      return 'Gallery Ready';
    case 'gallery':
      return 'Gallery';
    case 'payment':
      return 'Payment';
    case 'booking':
      return 'Booking';
    case 'package':
      return 'Package';
    case 'promo':
      return 'Promo';
    default:
      return 'Update';
  }
}

function matchesFilter(item: Notification, activeFilter: NotificationFilter) {
  if (activeFilter === 'all') return true;
  if (activeFilter === 'unread') return !item.read;
  if (activeFilter === 'payments') return item.type === 'payment';
  if (activeFilter === 'galleries') return item.type === 'gallery' || item.type === 'gallery_ready';
  if (activeFilter === 'bookings') return item.type === 'booking' || item.type === 'package';
  return true;
}

function NotificationItem({
  item,
  onPress,
  onDelete,
}: {
  item: Notification;
  onPress: (notification: Notification) => void;
  onDelete: (notification: Notification) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const accentColor = accentMap[item.type] || accentMap.system;
  const isActionable = ['gallery', 'gallery_ready', 'payment', 'booking', 'package'].includes(item.type);

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
      <Animated.View
        style={[
          styles.notifItem,
          { borderLeftColor: accentColor },
          !item.read && styles.notifItemUnread,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={[styles.notifIcon, { backgroundColor: bgMap[item.type] || bgMap.system }]}>
          {iconMap[item.type] || iconMap.system}
        </View>
        <View style={styles.notifContent}>
          <View style={styles.typeRow}>
            <View style={[styles.typeBadge, { backgroundColor: `${accentColor}22` }]}>
              <Text style={[styles.typeBadgeText, { color: accentColor }]}>{getTypeLabel(item.type)}</Text>
            </View>
            <Text style={styles.notifTime}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>{item.title}</Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <View style={styles.notifFooter}>
            <Text style={styles.notifTimestamp}>{item.timestamp}</Text>
            {item.actionLabel && (
              <Pressable
                style={[styles.actionChip, isActionable && styles.actionChipPrimary]}
                onPress={handlePress}
              >
                <Text style={[styles.actionChipText, isActionable && styles.actionChipTextPrimary]}>{item.actionLabel}</Text>
                <ChevronRight size={14} color={isActionable ? Colors.background : Colors.gold} />
              </Pressable>
            )}
            {!item.actionLabel && !item.read && (
              <Pressable style={styles.actionChip} onPress={handlePress}>
                <Text style={styles.actionChipText}>Mark read</Text>
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
  type: NotificationType;
  read: boolean;
  timestamp: string;
  createdAt: string;
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
  const { user, isDemoMode } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  const unreadCount = notifs.filter(n => !n.read).length;
  const actionableCount = notifs.filter((n) => ['gallery_ready', 'payment', 'booking', 'package'].includes(n.type) && !n.read).length;

  const markRead = useCallback(async (id: string) => {
    try {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      if (isDemoMode) return;
      // Permanently mark as read in database
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) {
        console.error('Failed to mark as read:', error);
        throw error;
      }
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  }, [isDemoMode]);

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
      
      if (!user || isDemoMode) return;
      // Mark all unread notifications as read
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      if (error) {
        console.error('Failed to mark all as read:', error);
        throw error;
      }
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  }, [isDemoMode, user]);

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
              if (isDemoMode) return;
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
  }, [isDemoMode]);

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
              if (!user || isDemoMode) return;
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
  }, [isDemoMode, user]);

  // Load notifications and set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const loadNotifications = async () => {
      try {
        if (isDemoMode) {
          const formattedDemoNotifs: Notification[] = demoNotifications.map((n: any) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            type: n.type as NotificationType,
            read: n.read === true,
            timestamp: new Date(n.created_at).toLocaleDateString(),
            createdAt: n.created_at,
            actionLabel: getActionLabel(n.type as NotificationType),
            access_code: (n.data as any)?.accessCode,
            gallery_id: (n.data as any)?.galleryId,
            client_id: null,
            bts_id: (n.data as any)?.btsId,
            announcement_id: (n.data as any)?.announcementId,
          }));
          setNotifs(formattedDemoNotifs);
          return;
        }

        const { data: userNotifs, error: userErr } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (userErr) throw userErr;

        let extraNotifs: any[] = [];

        const seenIds = new Set((userNotifs || []).map((n: any) => n.id));
        const merged = [...(userNotifs || [])];
        for (const n of extraNotifs) {
          if (!seenIds.has(n.id)) {
            merged.push(n);
            seenIds.add(n.id);
          }
        }
        merged.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const data = merged;

        const formattedNotifs: Notification[] = (data || []).map((n: any) => ({
          id: n.id,
          title: n.title || 'Notification',
          body: n.body ?? n.message ?? '',
          type: n.type as NotificationType || 'system',
          read: n.read === true,
          timestamp: new Date(n.created_at).toLocaleDateString(),
          createdAt: n.created_at,
          actionLabel: getActionLabel(n.type as NotificationType),
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

    if (isDemoMode) {
      return;
    }

    // Set up real-time subscription for user_id-based notifications
    const channel = supabase
      .channel(`user_notifications_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (!payload.new) return;
        
        const newNotif = payload.new as any;
        const formattedNotif: Notification = {
          id: newNotif.id,
          title: newNotif.title || 'Notification',
          body: newNotif.body ?? newNotif.message ?? '',
          type: newNotif.type as NotificationType || 'system',
          read: newNotif.read === true,
          timestamp: new Date(newNotif.created_at).toLocaleDateString(),
          createdAt: newNotif.created_at,
          actionLabel: getActionLabel(newNotif.type as NotificationType),
          access_code: newNotif.data?.accessCode ?? newNotif.access_code,
          gallery_id: newNotif.data?.galleryId ?? newNotif.gallery_id,
          client_id: newNotif.data?.clientId ?? newNotif.client_id,
          bts_id: newNotif.data?.btsId,
          announcement_id: newNotif.data?.announcementId,
        };

        setNotifs(prev => {
          if (prev.some(n => n.id === formattedNotif.id)) return prev;
          return [formattedNotif, ...prev];
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .subscribe();

    let clientChannel: any = null;
    supabase.from('clients').select('id').eq('user_id', user.id).maybeSingle().then(({ data: clientRow }) => {
      if (!clientRow) return;
      clientChannel = supabase
        .channel(`client_notifications_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `client_id=eq.${clientRow.id}`
        }, (payload) => {
          if (!payload.new) return;
          const newNotif = payload.new as any;
          if (newNotif.user_id && newNotif.user_id === user.id) return;
          const formattedNotif: Notification = {
            id: newNotif.id,
            title: newNotif.title || 'Notification',
            body: newNotif.body ?? newNotif.message ?? '',
            type: newNotif.type as NotificationType || 'system',
            read: newNotif.read === true,
            timestamp: new Date(newNotif.created_at).toLocaleDateString(),
            createdAt: newNotif.created_at,
            actionLabel: getActionLabel(newNotif.type as NotificationType),
            access_code: newNotif.data?.accessCode ?? newNotif.access_code,
            gallery_id: newNotif.data?.galleryId ?? newNotif.gallery_id,
            client_id: newNotif.data?.clientId ?? newNotif.client_id,
            bts_id: newNotif.data?.btsId,
            announcement_id: newNotif.data?.announcementId,
          };
          setNotifs(prev => {
            if (prev.some(n => n.id === formattedNotif.id)) return prev;
            return [formattedNotif, ...prev];
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        })
        .subscribe();
    });

    return () => {
      supabase.removeChannel(channel);
      if (clientChannel) supabase.removeChannel(clientChannel);
    };
  }, [isDemoMode, user]);

  const filteredNotifs = useMemo(
    () => notifs.filter((item) => matchesFilter(item, activeFilter)),
    [notifs, activeFilter]
  );

  const sections = useMemo(() => {
    const grouped: Record<string, Notification[]> = {};
    filteredNotifs.forEach((item) => {
      const sectionTitle = getSectionTitle(item.createdAt);
      if (!grouped[sectionTitle]) grouped[sectionTitle] = [];
      grouped[sectionTitle].push(item);
    });

    const orderedTitles = ['Today', 'Earlier this week', 'Older'];
    return orderedTitles
      .filter((title) => grouped[title]?.length)
      .map((title) => ({ title, data: grouped[title] }));
  }, [filteredNotifs]);

  return (
    <View style={styles.container}>
      <View style={{ zIndex: 10, backgroundColor: Colors.background, paddingBottom: 8 }}>
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

        <View style={styles.summaryCard}>
          <View style={styles.summaryCopy}>
            <View style={styles.summaryEyebrow}>
              <Sparkles size={14} color={Colors.gold} />
              <Text style={styles.summaryEyebrowText}>Inbox</Text>
            </View>
            <Text style={styles.summaryTitle}>Stay on top of what needs attention</Text>
            <Text style={styles.summaryDesc}>
              {actionableCount > 0
                ? `${actionableCount} update${actionableCount === 1 ? '' : 's'} can be acted on right now.`
                : 'Everything important is neatly organized here.'}
            </Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{unreadCount}</Text>
              <Text style={styles.summaryStatLabel}>Unread</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{actionableCount}</Text>
              <Text style={styles.summaryStatLabel}>Actionable</Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
          style={styles.filtersWrap}
        >
          {filterOptions.map((option) => {
            const isActive = option.key === activeFilter;
            return (
              <Pressable
                key={option.key}
                onPress={() => setActiveFilter(option.key)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {filteredNotifs.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Bell size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>{activeFilter === 'all' ? 'All caught up!' : `No ${activeFilter} updates`}</Text>
          <Text style={styles.emptyDesc}>
            {activeFilter === 'all'
              ? 'No notifications right now. We&apos;ll let you know when something important happens.'
              : 'Try another filter or check back later for new updates.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem item={item} onPress={handleNotificationPress} onDelete={deleteNotification} />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom + 120, 160) }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          stickySectionHeadersEnabled={false}
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
    paddingTop: 10,
    paddingBottom: 36,
  },
  separator: {
    height: 8,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 16,
    padding: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    gap: 12,
  },
  summaryCopy: {
    gap: 4,
  },
  summaryEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryEyebrowText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  summaryDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  summaryStats: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
  },
  summaryStat: {
    flex: 1,
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
  filtersWrap: {
    maxHeight: 48,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.goldMuted,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  filterChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  filterChipTextActive: {
    color: Colors.gold,
  },
  sectionHeader: {
    paddingHorizontal: 2,
    paddingTop: 10,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  notifItem: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  notifItemUnread: {
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(26,26,26,0.98)',
    shadowColor: Colors.gold,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
  typeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
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
  notifTimestamp: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  actionChip: {
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 2,
  },
  actionChipPrimary: {
    backgroundColor: Colors.gold,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  actionChipTextPrimary: {
    color: Colors.background,
    fontWeight: '800' as const,
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
