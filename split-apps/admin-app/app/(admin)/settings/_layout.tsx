import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function AdminSettingsLayout() {
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
      <Stack.Screen name="payments" options={{ title: 'Payment Settings' }} />
      <Stack.Screen name="messaging" options={{ title: 'SMS Messaging' }} />
      <Stack.Screen name="branding" options={{ title: 'Branding' }} />
      <Stack.Screen name="delivery" options={{ title: 'Delivery Gateways' }} />
      <Stack.Screen name="package-editor" options={{ title: 'Service Packages' }} />
      <Stack.Screen name="watermark" options={{ title: 'Watermark' }} />
      <Stack.Screen name="receipt-settings" options={{ title: 'Receipt Settings' }} />
      <Stack.Screen name="ussd-settings/page" options={{ title: 'USSD Settings' }} />
      <Stack.Screen name="mpesa-transactions" options={{ title: 'Transactions' }} />
      <Stack.Screen name="../portfolio" options={{ title: 'Portfolio' }} />
      <Stack.Screen name="../reviews" options={{ title: 'Reviews' }} />
      <Stack.Screen name="../referrals" options={{ title: 'Referrals' }} />
      <Stack.Screen name="../support" options={{ title: 'Support' }} />
    </Stack>
  );
}
