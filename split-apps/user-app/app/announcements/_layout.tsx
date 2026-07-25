import { Stack } from 'expo-router';

export default function AnnouncementsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen 
        name="index"
        options={{
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen 
        name="[id]"
        options={{
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen 
        name="all"
        options={{
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
