'use client';

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { X, Bell, Images, CreditCard, Calendar, Package, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type NotificationToastData = {
  id: string;
  title: string;
  body: string;
  type?: string;
  image?: string;
  onPress?: () => void;
};

type NotificationToastContextType = {
  showNotification: (data: NotificationToastData) => void;
};

const NotificationToastContext = createContext<NotificationToastContextType>({
  showNotification: () => {},
});

export function useNotificationToast() {
  return useContext(NotificationToastContext);
}

const TYPE_ICONS: Record<string, any> = {
  gallery: Images,
  gallery_ready: Images,
  payment: CreditCard,
  booking: Calendar,
  package: Package,
  message: MessageCircle,
  system: Bell,
  promo: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  gallery: '#3B82F6',
  gallery_ready: '#34C759',
  payment: '#FF9F0A',
  booking: '#AF52DE',
  package: '#D4AF37',
  message: '#007AFF',
  system: '#8E8E93',
  promo: '#FF2D55',
};

export function NotificationToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<NotificationToastData | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;
  const insets = useSafeAreaInsets();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showNotification = useCallback((data: NotificationToastData) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    opacity.setValue(0);
    translateY.setValue(-100);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 15, stiffness: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    timeoutRef.current = setTimeout(hideToast, 4000);
  }, [hideToast, opacity, translateY]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const Icon = toast?.type ? (TYPE_ICONS[toast.type] || Bell) : Bell;
  const iconColor = toast?.type ? (TYPE_COLORS[toast.type] || '#8E8E93') : '#8E8E93';

  return (
    <NotificationToastContext.Provider value={{ showNotification }}>
      {children}
      {toast && (
        <Animated.View style={[styles.container, { top: insets.top + 8, opacity, transform: [{ translateY }] }]}>
          <Pressable
            style={styles.card}
            onPress={() => {
              hideToast();
              toast.onPress?.();
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${iconColor}20` }]}>
              <Icon size={18} color={iconColor} />
            </View>
            <View style={styles.content}>
              <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
              <Text style={styles.body} numberOfLines={2}>{toast.body}</Text>
            </View>
            <Pressable hitSlop={8} onPress={hideToast} style={styles.closeBtn}>
              <X size={14} color={Colors.textMuted} />
            </Pressable>
          </Pressable>
        </Animated.View>
      )}
    </NotificationToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28,28,35,0.97)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  body: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
