import { Stack } from 'expo-router';

export default function AnnouncementsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
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
    </Stack>
  );
}
