import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, MessageSquare, CreditCard, Image, Users, Save, Mail, Smartphone, CheckCheck, Clock, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/* ── Types ── */
interface NotificationPrefs {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  payment_alerts: boolean;
  booking_alerts: boolean;
  message_alerts: boolean;
  gallery_alerts: boolean;
  client_alerts: boolean;
  weekly_report: boolean;
}

interface NotificationItem {
  id: string;
  user_id: string | null;
  client_id: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  payment_alerts: true,
  booking_alerts: true,
  message_alerts: true,
  gallery_alerts: true,
  client_alerts: true,
  weekly_report: true,
};

type Tab = 'preferences' | 'history';

function getNotifIcon(type: string) {
  switch (type) {
    case 'payment_success':
    case 'payment_failed':
      return <CreditCard size={18} color={Colors.gold} />;
    case 'upload':
    case 'package_update':
      return <Image size={18} color={Colors.gold} />;
    case 'announcement':
    case 'system':
      return <Info size={18} color={Colors.gold} />;
    default:
      return <Bell size={18} color={Colors.gold} />;
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  /* ── State ── */
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<any>(null);

  /* ── Fetch preferences ── */
  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('photographer_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setPrefs({
          push_enabled: data.push_enabled ?? true,
          email_enabled: data.email_enabled ?? true,
          sms_enabled: data.sms_enabled ?? false,
          payment_alerts: data.payment_alerts ?? true,
          booking_alerts: data.booking_alerts ?? true,
          message_alerts: data.message_alerts ?? true,
          gallery_alerts: data.gallery_alerts ?? true,
          client_alerts: data.client_alerts ?? true,
          weekly_report: data.weekly_report ?? true,
        });
      }
    } catch {
      // silently use defaults
    } finally {
      setLoadingPrefs(false);
    }
  }, [user]);

  /* ── Fetch notifications ── */
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.read).length);
    } catch {
      // silently handle
    } finally {
      setLoadingNotifs(false);
      setRefreshing(false);
    }
  }, [user]);

  /* ── Initial load ── */
  useEffect(() => {
    fetchPrefs();
    fetchNotifications();
  }, [fetchPrefs, fetchNotifications]);

  /* ── Real-time subscription ── */
  useEffect(() => {
    if (!user) return;

    channelRef.current = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Info);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as NotificationItem;
          setNotifications(prev =>
            prev.map(n => (n.id === updated.id ? updated : n))
          );
          setUnreadCount(prev =>
            updated.read ? Math.max(0, prev - 1) : prev + 1
          );
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user]);

  /* ── Toggle preference ── */
  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── Save preferences ── */
  const save = async () => {
    setSaving(true);
    try {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          photographer_id: user.id,
          ...prefs,
        }, { onConflict: 'photographer_id' });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Notification preferences updated');
    } catch {
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  /* ── Mark as read ── */
  const markAsRead = async (notifId: string) => {
    setMarkingRead(notifId);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notifId);
      if (error) throw error;
      setNotifications(prev =>
        prev.map(n => (n.id === notifId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silently handle
    } finally {
      setMarkingRead(null);
    }
  };

  /* ── Mark all as read ── */
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  /* ── Pull to refresh ── */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
  }, [fetchNotifications]);

  /* ── Loading screen ── */
  if (loadingPrefs && loadingNotifs) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Notifications' }} />

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Bell size={16} color={activeTab === 'history' ? Colors.gold : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'preferences' && styles.tabActive]}
          onPress={() => setActiveTab('preferences')}
        >
          <Text style={[styles.tabText, activeTab === 'preferences' && styles.tabTextActive]}>
            Preferences
          </Text>
        </Pressable>
      </View>

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >
          {unreadCount > 0 && (
            <Pressable style={styles.markAllBtn} onPress={markAllAsRead}>
              <CheckCheck size={16} color={Colors.gold} />
              <Text style={styles.markAllBtnText}>Mark all as read</Text>
            </Pressable>
          )}

          {notifications.length === 0 && !loadingNotifs ? (
            <View style={styles.emptyState}>
              <Bell size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyDesc}>You'll see alerts here when something happens</Text>
            </View>
          ) : (
            notifications.map((notif) => (
              <Pressable
                key={notif.id}
                style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
                onPress={() => !notif.read && markAsRead(notif.id)}
              >
                <View style={styles.notifIconWrap}>
                  {getNotifIcon(notif.type)}
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifHeader}>
                    <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]} numberOfLines={1}>
                      {notif.title}
                    </Text>
                    <View style={styles.notifTimeRow}>
                      <Clock size={12} color={Colors.textMuted} />
                      <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
                    </View>
                  </View>
                  <Text style={styles.notifBody} numberOfLines={3}>{notif.body}</Text>
                </View>
                {markingRead === notif.id ? (
                  <ActivityIndicator size="small" color={Colors.gold} style={{ marginLeft: 8 }} />
                ) : notif.read ? (
                  <CheckCheck size={16} color={Colors.gold} style={{ marginLeft: 8 }} />
                ) : (
                  <View style={styles.unreadDot} />
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Preferences Tab ── */}
      {activeTab === 'preferences' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>

          {/* Channels */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Channels</Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Bell size={20} color={prefs.push_enabled ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>Push Notifications</Text>
                  <Text style={styles.toggleDesc}>Real-time alerts on your device</Text>
                </View>
              </View>
              <Switch value={prefs.push_enabled} onValueChange={() => toggle('push_enabled')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.push_enabled ? Colors.gold : Colors.textMuted} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Mail size={20} color={prefs.email_enabled ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>Email Notifications</Text>
                  <Text style={styles.toggleDesc}>Daily summary to your inbox</Text>
                </View>
              </View>
              <Switch value={prefs.email_enabled} onValueChange={() => toggle('email_enabled')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.email_enabled ? Colors.gold : Colors.textMuted} />
            </View>

            <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
              <View style={styles.toggleInfo}>
                <Smartphone size={20} color={prefs.sms_enabled ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>SMS Alerts</Text>
                  <Text style={styles.toggleDesc}>Critical alerts via text message</Text>
                </View>
              </View>
              <Switch value={prefs.sms_enabled} onValueChange={() => toggle('sms_enabled')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.sms_enabled ? Colors.gold : Colors.textMuted} />
            </View>
          </View>

          {/* Alert Types */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Alert Types</Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <CreditCard size={20} color={prefs.payment_alerts ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>Payments</Text>
                  <Text style={styles.toggleDesc}>When clients pay</Text>
                </View>
              </View>
              <Switch value={prefs.payment_alerts} onValueChange={() => toggle('payment_alerts')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.payment_alerts ? Colors.gold : Colors.textMuted} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Users size={20} color={prefs.booking_alerts ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>Bookings</Text>
                  <Text style={styles.toggleDesc}>New and updated bookings</Text>
                </View>
              </View>
              <Switch value={prefs.booking_alerts} onValueChange={() => toggle('booking_alerts')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.booking_alerts ? Colors.gold : Colors.textMuted} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <MessageSquare size={20} color={prefs.message_alerts ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>Messages</Text>
                  <Text style={styles.toggleDesc}>Client messages</Text>
                </View>
              </View>
              <Switch value={prefs.message_alerts} onValueChange={() => toggle('message_alerts')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.message_alerts ? Colors.gold : Colors.textMuted} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Image size={20} color={prefs.gallery_alerts ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>Galleries</Text>
                  <Text style={styles.toggleDesc}>Gallery activity</Text>
                </View>
              </View>
              <Switch value={prefs.gallery_alerts} onValueChange={() => toggle('gallery_alerts')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.gallery_alerts ? Colors.gold : Colors.textMuted} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Users size={20} color={prefs.client_alerts ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>Clients</Text>
                  <Text style={styles.toggleDesc}>New client signups</Text>
                </View>
              </View>
              <Switch value={prefs.client_alerts} onValueChange={() => toggle('client_alerts')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.client_alerts ? Colors.gold : Colors.textMuted} />
            </View>

            <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
              <View style={styles.toggleInfo}>
                <Mail size={20} color={prefs.weekly_report ? Colors.gold : Colors.textMuted} />
                <View>
                  <Text style={styles.toggleLabel}>Weekly Report</Text>
                  <Text style={styles.toggleDesc}>Performance summary</Text>
                </View>
              </View>
              <Switch value={prefs.weekly_report} onValueChange={() => toggle('weekly_report')} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={prefs.weekly_report ? Colors.gold : Colors.textMuted} />
            </View>
          </View>

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={Colors.background} /> : <Save size={16} color={Colors.background} />}
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Preferences'}</Text>
          </Pressable>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },

  /* ── Tab Bar ── */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.goldMuted,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.gold,
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },

  /* ── Mark All ── */
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.goldMuted,
  },
  markAllBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },

  /* ── Notification Card ── */
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  notifTitleUnread: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  notifTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notifTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  notifBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
    marginLeft: 8,
    marginTop: 6,
  },

  /* ── Empty State ── */
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
  },

  /* ── Section ── */
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  toggleDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.background,
  },
});
