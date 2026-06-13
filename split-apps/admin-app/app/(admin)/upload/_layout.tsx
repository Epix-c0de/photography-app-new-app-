import { Stack } from 'expo-router';

export default function UploadLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#080810' },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
    </Stack>
  );
}
