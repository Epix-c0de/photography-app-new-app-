import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Heart, Download, Trash2, ExternalLink } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import SettingsHeader from '@/components/SettingsHeader';
import { supabase } from '@/lib/supabase';

interface FavoritePhoto {
  id: string;
  photo_id: string;
  gallery_id: string;
  gallery_name: string;
  thumbnail_url?: string;
  created_at: string;
}

export default function Favorites() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoritePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('photo_favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const removeFavorite = async (id: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { error } = await supabase
        .from('photo_favorites')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFavorites(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      Alert.alert('Error', 'Failed to remove favorite');
    }
  };

  const downloadPhoto = async (item: FavoritePhoto) => {
    setDownloading(item.id);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Navigate to gallery with photo selected
      router.push(`/gallery?photo=${item.photo_id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to download photo');
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    if (favorites.length === 0) return;
    
    Alert.alert(
      'Download All',
      `Download ${favorites.length} favorite photos?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Download', 
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Started', 'Your download will begin shortly');
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: FavoritePhoto }) => (
    <View style={styles.item}>
      <Pressable 
        style={styles.itemContent}
        onPress={() => downloadPhoto(item)}
      >
        <View style={styles.imageContainer}>
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Heart size={24} color={Colors.gold} />
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.galleryName} numberOfLines={1}>
            {item.gallery_name || 'Gallery'}
          </Text>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <ExternalLink size={16} color={Colors.textMuted} />
      </Pressable>
      <Pressable 
        style={styles.removeButton}
        onPress={() => removeFavorite(item.id)}
      >
        <Trash2 size={16} color={Colors.error || '#ff4444'} />
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsHeader title="Favorites" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Favorites" />
      
      <View style={styles.header}>
        <Text style={styles.count}>{favorites.length} liked photos</Text>
        {favorites.length > 0 && (
          <Pressable style={styles.downloadAllButton} onPress={downloadAll}>
            <Download size={16} color={Colors.white} />
            <Text style={styles.downloadAllText}>Download All</Text>
          </Pressable>
        )}
      </View>
      
      {favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Heart size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptyDesc}>
            Tap the heart icon on photos you love to save them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
  downloadAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  downloadAllText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  galleryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  removeButton: {
    padding: 12,
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