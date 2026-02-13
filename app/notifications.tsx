import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Images, CreditCard, Calendar, Megaphone, Bell, Check, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const iconMap: Record<string, React.ReactNode> = {
  gallery: <Images size={20} color="#3B82F6" />,
  payment: <CreditCard size={20} color={Colors.success} />,
  booking: <Calendar size={20} color={Colors.gold} />,
  promo: <Megaphone size={20} color="#E879F9" />,
  system: <Bell size={20} color={Colors.textSecondary} />,
};

const bgMap: Record<string, string> = {
  gallery: 'rgba(59,130,246,0.12)',
  payment: 'rgba(46,204,113,0.12)',
  booking: 'rgba(212,175,55,0.12)',
  promo: 'rgba(232,121,249,0.12)',
  system: 'rgba(160,160,160,0.12)',
};

function NotificationItem({ item, onMarkRead }: { item: Notification; onMarkRead: (id: string) => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!item.read) {
      onMarkRead(item.id);
    }
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [item, onMarkRead, scaleAnim]);

  return (
    <Pressable onPress={handlePress}>
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
  type: 'gallery' | 'payment' | 'booking' | 'promo' | 'system';
  read: boolean;
  timestamp: string;
  actionLabel?: string;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);

  const unreadCount = notifs.filter(n => !n.read).length;

  const markRead = useCallback((id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotifs([]);
  }, []);

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
          renderItem={({ item }) => <NotificationItem item={item} onMarkRead={markRead} />}
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
