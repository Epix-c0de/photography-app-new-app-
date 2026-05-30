import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Download, RefreshCw, WifiOff, X, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { UpdateStatus } from '@/hooks/useAppUpdates';

interface UpdateBannerProps {
  status: UpdateStatus;
  isOnline: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}

export function UpdateBanner({
  status,
  isOnline,
  onApply,
  onDismiss,
  onRetry,
}: UpdateBannerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const isVisible = status === 'checking' || status === 'available' || status === 'downloading' || status === 'ready' || status === 'error';

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: -100,
          useNativeDriver: true,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const getBannerContent = () => {
    switch (status) {
      case 'checking':
        return {
          icon: <ActivityIndicator size="small" color={Colors.gold} />,
          title: 'Checking for updates...',
          message: null,
          buttons: null,
          bgColor: Colors.card,
        };

      case 'available':
        return {
          icon: <Sparkles size={20} color={Colors.gold} />,
          title: 'New Update Available',
          message: 'Downloading in the background...',
          buttons: null,
          bgColor: Colors.card,
        };

      case 'downloading':
        return {
          icon: <Download size={20} color={Colors.gold} />,
          title: 'Downloading Update...',
          message: 'Please keep the app open',
          buttons: null,
          bgColor: Colors.card,
        };

      case 'ready':
        return {
          icon: <RefreshCw size={20} color={Colors.gold} />,
          title: 'Update Ready!',
          message: 'Restart to apply the latest features',
          buttons: (
            <>
              <Pressable onPress={onDismiss} style={styles.buttonSecondary}>
                <Text style={styles.buttonSecondaryText}>Later</Text>
              </Pressable>
              <Pressable onPress={onApply} style={styles.buttonPrimary}>
                <Text style={styles.buttonPrimaryText}>Restart Now</Text>
              </Pressable>
            </>
          ),
          bgColor: Colors.gold,
        };

      case 'error':
        return {
          icon: !isOnline ? <WifiOff size={20} color={Colors.textMuted} /> : <X size={20} color={Colors.error} />,
          title: !isOnline ? 'No Internet Connection' : 'Update Failed',
          message: !isOnline ? 'Connect to WiFi to check for updates' : 'Unable to download update',
          buttons: (
            <Pressable onPress={onRetry} style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryText}>Try Again</Text>
            </Pressable>
          ),
          bgColor: isOnline ? Colors.error + '20' : Colors.card,
        };

      default:
        return null;
    }
  };

  const content = getBannerContent();
  if (!content) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.banner, { backgroundColor: content.bgColor }]}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>{content.icon}</View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{content.title}</Text>
            {content.message && (
              <Text style={styles.message}>{content.message}</Text>
            )}
          </View>
        </View>
        
        {content.buttons && (
          <View style={styles.buttons}>
            {content.buttons}
          </View>
        )}

        {status !== 'ready' && status !== 'error' && (
          <Pressable onPress={onDismiss} style={styles.closeButton}>
            <X size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  banner: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  message: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  buttonPrimary: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonPrimaryText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonSecondaryText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
