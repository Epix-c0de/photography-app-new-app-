import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function BookingsLayout() {
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
    </Stack>
  );
}
