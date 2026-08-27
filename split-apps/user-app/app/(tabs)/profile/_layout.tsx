import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' as const },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings/notifications" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/privacy-security" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/downloads" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/shared-links" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/help-support" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/app-settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
