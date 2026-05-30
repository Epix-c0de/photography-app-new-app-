import { Tabs } from 'expo-router';
import { Home, Images, Calendar, MessageCircle, User } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const insets = useSafeAreaInsets();
  // Tab bar sits 12pt above the safe area bottom edge
  const TAB_BAR_BOTTOM = 12 + insets.bottom;
  // Tab bar height is 72; add bottom offset so content clears it
  const TAB_BAR_HEIGHT = 72;
  const SCENE_PADDING_BOTTOM = TAB_BAR_BOTTOM + TAB_BAR_HEIGHT + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.textMuted,
        sceneStyle: {
          backgroundColor: Colors.background,
          paddingBottom: SCENE_PADDING_BOTTOM,
        },
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.tabBarOverlay} />
          </View>
        ),
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: TAB_BAR_BOTTOM,
          height: TAB_BAR_HEIGHT,
          borderRadius: 24,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowColor: Colors.gold,
          shadowOpacity: 0.2,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          overflow: 'hidden',
          paddingTop: 10,
          paddingBottom: 6,
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700' as const,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
              <Home size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'My Galleries',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
              <Images size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
              <Calendar size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
              <MessageCircle size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
              <User size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
  },
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,12,0.82)',
  },
  iconContainer: {
    width: 34,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIcon: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.7)',
    transform: [{ scale: 1.05 }],
  },
});
