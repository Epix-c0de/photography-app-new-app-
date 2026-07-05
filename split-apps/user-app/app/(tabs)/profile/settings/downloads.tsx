import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Download, Calendar, Image, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';
import { supabase } from '@/lib/supabase';

interface DownloadItem {
  id: string;
  gallery_id: string;
  gallery_name: string;
  photo_count: number;
  downloaded_at: string;
  format: string;
}

export default function Downloads() {
  const router = useRouter();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDownloads = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('download_history')
        .select('*')
        .eq('user_id', user.id)
        .order('downloaded_at', { ascending: false });

      if (error) throw error;
      setDownloads(data || []);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDownloads();
  }, [loadDownloads]);

  const reDownload = async (item: DownloadItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(`/(tabs)/gallery?galleryId=${item.gallery_id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderItem = ({ item }: { item: DownloadItem }) => (
    <Pressable style={styles.item} onPress={() => reDownload(item)}>
      <View style={styles.iconContainer}>
        <Download size={24} color={Colors.gold} />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.galleryName} numberOfLines={1}>
          {item.gallery_name || 'Gallery'}
        </Text>
        <View style={styles.meta}>
          <Calendar size={12} color={Colors.textMuted} />
          <Text style={styles.date}>{formatDate(item.downloaded_at)}</Text>
          <Text style={styles.separator}>•</Text>
          <Image size={12} color={Colors.textMuted} />
          <Text style={styles.photoCount}>{item.photo_count} photos</Text>
        </View>
      </View>
      <View style={styles.formatBadge}>
        <Text style={styles.formatText}>{item.format?.toUpperCase() || 'JPG'}</Text>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsHeader title="Downloads" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Downloads" />
      
      {downloads.length > 0 && (
        <View style={styles.header}>
          <Text style={styles.count}>{downloads.length} downloads</Text>
          <Pressable onPress={onRefresh}>
            <RefreshCw size={20} color={Colors.gold} />
          </Pressable>
        </View>
      )}
      
      {downloads.length === 0 ? (
        <View style={styles.emptyState}>
          <Download size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptyDesc}>
            Your downloaded galleries will appear here for easy re-access
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  count: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  list: {
    padding: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  galleryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  separator: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  photoCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  formatBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formatText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
});