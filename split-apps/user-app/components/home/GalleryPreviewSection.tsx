import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import type { Database } from '@/types/supabase';

type GalleryRow = Database['public']['Tables']['galleries']['Row'];

interface GalleryPreviewCardProps {
  item: GalleryRow & { photo_count?: number | null };
}

function GalleryPreviewCard({ item }: GalleryPreviewCardProps) {
  const photoCount = (item as any).photo_count || 0;

  return (
    <Pressable style={styles.galleryThumbContainer}>
      <View style={styles.galleryThumbWrapper}>
        {item.cover_photo_url ? (
          <Image
            source={{ uri: item.cover_photo_url }}
            style={styles.galleryThumbImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.galleryThumbImage, styles.galleryThumbPlaceholder]}>
            <Text style={styles.galleryThumbPlaceholderText}>
              {(item.title || 'G')[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.galleryThumbOverlay} />
        <View style={styles.galleryThumbInfo}>
          <Text style={styles.galleryThumbTitle} numberOfLines={1}>
            {item.title || 'Untitled Gallery'}
          </Text>
          <Text style={styles.galleryThumbCount}>
            {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          </Text>
        </View>
        {item.is_locked && (
          <View style={styles.galleryLockBadge}>
            <Text style={styles.galleryLockText}>🔒</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface GalleryPreviewSectionProps {
  galleries: GalleryRow[];
  loading: boolean;
  error: string | null;
  hasPendingPayments: boolean;
  onRetry: () => void;
}

export function GalleryPreviewSection({
  galleries,
  loading,
  error,
  hasPendingPayments,
  onRetry,
}: GalleryPreviewSectionProps) {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Galleries</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(hasPendingPayments ? '/(tabs)/gallery?tab=unlock' : '/(tabs)/gallery');
          }}
        >
          <Text style={styles.seeAll}>View all</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.recentGalleriesList}>
          {[1, 2].map((i) => (
            <View key={i} style={[styles.galleryThumbContainer, { marginRight: 16 }]}>
              <View style={[styles.galleryThumbWrapper, { backgroundColor: '#1C1C1E', overflow: 'hidden' }]}>
                <View style={[styles.galleryThumbInfo, { zIndex: 10 }]}>
                  <View style={{ width: '70%', height: 16, backgroundColor: 'rgba(212,175,55,0.12)', borderRadius: 8 }} />
                  <View style={{ height: 6 }} />
                  <View style={{ width: '40%', height: 12, backgroundColor: 'rgba(212,175,55,0.12)', borderRadius: 8 }} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.emptyAnnouncements}>
          <Text style={styles.emptyAnnouncementsText}>{error}</Text>
          <Pressable onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : galleries.length === 0 ? (
        <View style={styles.emptyAnnouncements}>
          <Text style={styles.emptyAnnouncementsText}>Your memories will appear here soon.</Text>
        </View>
      ) : (
        <FlatList
          data={galleries.slice(0, 4)}
          renderItem={({ item }) => <GalleryPreviewCard item={item as any} />}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleriesContainer}
          snapToInterval={176}
          snapToAlignment="start"
          decelerationRate="fast"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  recentGalleriesList: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  galleriesContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  galleryThumbContainer: {
    width: 160,
  },
  galleryThumbWrapper: {
    width: 160,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
  },
  galleryThumbPlaceholder: {
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryThumbPlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.gold,
  },
  galleryThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  galleryThumbInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  },
  galleryThumbTitle: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  galleryThumbCount: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  galleryLockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryLockText: {
    fontSize: 12,
  },
  emptyAnnouncements: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyAnnouncementsText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  retryText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
});
