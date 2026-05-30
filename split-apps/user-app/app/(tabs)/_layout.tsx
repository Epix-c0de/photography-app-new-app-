import { Tabs } from 'expo-router';
import { Home, Images, Calendar, MessageCircle, User } from 'lucide-react-native';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

// Shared ref so the gallery screen can subscribe to tab press resets
export const galleryTabPressRef = { current: 0 };

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
  }, []);

  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Tab bar sits above the safe area (gesture bar / home indicator)
  const TAB_BAR_HEIGHT = 72;
  const TAB_BAR_BOTTOM = Math.max(insets.bottom + 14, 20);
  const SCENE_PADDING_BOTTOM = TAB_BAR_BOTTOM + TAB_BAR_HEIGHT + 4;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: Colors.background,
          paddingBottom: SCENE_PADDING_BOTTOM,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: TAB_BAR_BOTTOM,
          height: TAB_BAR_HEIGHT,
          borderRadius: 22,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowColor: Colors.gold,
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        },
        tabBarBackground: () => (
          <BlurView intensity={90} tint="dark" style={styles.blurContainer} />
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 4,
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Home} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        listeners={{
          tabPress: () => {
            handleTabPress();
            galleryTabPressRef.current += 1;
          },
        }}
        options={{
          title: 'Galleries',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Images} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Calendar} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={MessageCircle} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={{ tabPress: handleTabPress }}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={User} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const TabIcon = ({ Icon, color, focused }: { Icon: any; color: string; focused: boolean }) => (
  <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
    <Icon size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
  </View>
);

const styles = StyleSheet.create({
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(14, 14, 18, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  iconWrapper: {
    width: 36,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
  },
});
