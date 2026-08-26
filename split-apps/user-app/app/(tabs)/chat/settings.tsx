import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, CheckCheck, Trash2, Wifi, Image as ImageIcon } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function ChatSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoDownloadMedia, setAutoDownloadMedia] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const notifVal = await AsyncStorage.getItem('chat_notifications_enabled');
        if (notifVal !== null) setNotificationsEnabled(notifVal === 'true');
        const mediaVal = await AsyncStorage.getItem('chat_auto_download_media');
        if (mediaVal !== null) setAutoDownloadMedia(mediaVal === 'true');
      } catch {}
    })();
  }, []);

  const toggleNotifications = useCallback(async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem('chat_notifications_enabled', String(val));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleAutoDownload = useCallback(async (val: boolean) => {
    setAutoDownloadMedia(val);
    await AsyncStorage.setItem('chat_auto_download_media', String(val));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await supabase
      .from('chat_messages')
      .update({ read: true })
      .eq('read', false)
      .eq('client_id', user.id);
    if (error) {
      Alert.alert('Error', 'Could not mark messages as read.');
    } else {
      Alert.alert('Done', 'All messages marked as read.');
    }
  }, [user]);

  const clearChatHistory = useCallback(() => {
    Alert.alert(
      'Clear Chat History',
      'This will permanently delete all your messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setClearing(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            const { error } = await supabase
              .from('chat_messages')
              .delete()
              .eq('client_id', user.id);
            setClearing(false);
            if (error) {
              Alert.alert('Error', 'Could not clear chat history.');
            } else {
              Alert.alert('Done', 'Chat history cleared.');
            }
          },
        },
      ]
    );
  }, [user]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <ArrowLeft size={22} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Chat Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Notifications */}
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
                <Bell size={18} color={Colors.gold} />
              </View>
              <View>
                <Text style={styles.rowLabel}>Notifications</Text>
                <Text style={styles.rowDesc}>Receive push notifications for new messages</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#333', true: 'rgba(212,175,55,0.4)' }}
              thumbColor={notificationsEnabled ? Colors.gold : '#666'}
            />
          </View>
        </View>

        {/* Mark All as Read */}
        <View style={styles.sectionCard}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={markAllAsRead}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(46,204,113,0.12)' }]}>
                <CheckCheck size={18} color={Colors.success} />
              </View>
              <View>
                <Text style={styles.rowLabel}>Mark All as Read</Text>
                <Text style={styles.rowDesc}>Mark every unread message as read</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Clear Chat History */}
        <View style={styles.sectionCard}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={clearChatHistory}
            disabled={clearing}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(231,76,60,0.12)' }]}>
                <Trash2 size={18} color={Colors.error} />
              </View>
              <View>
                <Text style={[styles.rowLabel, { color: Colors.error }]}>Clear Chat History</Text>
                <Text style={styles.rowDesc}>Permanently delete all your messages</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Media Auto-Download */}
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(52,152,219,0.12)' }]}>
                <Wifi size={18} color="#3498DB" />
              </View>
              <View>
                <Text style={styles.rowLabel}>Media Auto-Download</Text>
                <Text style={styles.rowDesc}>Automatically download photos and videos</Text>
              </View>
            </View>
            <Switch
              value={autoDownloadMedia}
              onValueChange={toggleAutoDownload}
              trackColor={{ false: '#333', true: 'rgba(52,152,219,0.4)' }}
              thumbColor={autoDownloadMedia ? '#3498DB' : '#666'}
            />
          </View>
        </View>

        {/* Chat Wallpaper */}
        <View style={styles.sectionCard}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Coming Soon', 'Chat wallpaper customization will be available in a future update.');
            }}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(155,89,182,0.12)' }]}>
                <ImageIcon size={18} color="#9B59B6" />
              </View>
              <View>
                <Text style={styles.rowLabel}>Chat Wallpaper</Text>
                <Text style={styles.rowDesc}>Customize your chat background</Text>
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '400',
  },
});
