import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function PostDetailsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
