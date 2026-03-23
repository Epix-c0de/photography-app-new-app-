/**
 * FeedVideoPlayer — Inline video player component for feed cards.
 *
 * Behaviours:
 *  - Accepts `isVisible` prop (driven by Intersection Observer / viewability in parent)
 *  - Auto-plays MUTED when 60%+ visible; pauses when scrolled away
 *  - Single tap to unmute / mute
 *  - Shows poster thumbnail until playback starts
 *  - Native controls become visible on tap
 */
import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Play, Volume2, VolumeX } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface FeedVideoPlayerProps {
  uri: string;
  posterUri?: string | null;
  /** True when the card is >= 60% visible in the scroll view */
  isVisible: boolean;
  /** Optional static aspect ratio (e.g. 1.778 for 16:9). Defaults to 16/9 */
  aspectRatio?: number;
}

export default function FeedVideoPlayer({
  uri,
  posterUri,
  isVisible,
  aspectRatio = 16 / 9,
}: FeedVideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Auto-play / pause based on viewport visibility
  useEffect(() => {
    if (!videoRef.current || !isLoaded) return;

    if (isVisible) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
      // Re-mute when scrolled away for clean next play
      setIsMuted(true);
    }
  }, [isVisible, isLoaded]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoaded(true);
      setIsPlaying(status.isPlaying);
    }
  };

  const handleTap = () => {
    if (!videoRef.current) return;
    // Toggle mute on tap
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.setIsMutedAsync(newMuted).catch(() => {});

    // Show controls briefly
    setShowControls(true);
    setTimeout(() => setShowControls(false), 3000);
  };

  return (
    <Pressable onPress={handleTap} style={[styles.container, { aspectRatio }]}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        isMuted={isMuted}
        isLooping
        useNativeControls={showControls}
        posterSource={posterUri ? { uri: posterUri } : undefined}
        usePoster={!!posterUri}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />

      {/* Mute indicator badge */}
      {isLoaded && (
        <View style={styles.muteIndicator}>
          {isMuted ? (
            <VolumeX size={14} color={Colors.white} />
          ) : (
            <Volume2 size={14} color={Colors.white} />
          )}
        </View>
      )}

      {/* Large play button overlay when paused */}
      {!isPlaying && isLoaded && (
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Play size={28} color={Colors.white} fill={Colors.white} />
          </View>
        </View>
      )}

      {/* Processing skeleton — shown when video is not yet loaded */}
      {!isLoaded && (
        <View style={styles.skeleton}>
          <Text style={styles.skeletonText}>⏳ Processing video…</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  muteIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 5,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.cardDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
});
