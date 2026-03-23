import { Link, Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Force redirect on web when getting trapped in literal /(tabs)/ routes
    if (pathname === '/(tabs)/home' || pathname === '/%28tabs%29/home' || pathname === '/(tabs)') {
      router.replace('/home' as any);
    } else if (pathname.includes('/(tabs)/') || pathname.includes('/%28tabs%29/')) {
      const cleanPath = pathname.replace(/\/\(tabs\)\/|\/%28tabs%29\//, '/');
      router.replace(cleanPath as any);
    }
  }, [pathname, router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerStyle: { backgroundColor: Colors.background }, headerTintColor: Colors.white }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
        <Link href="/home" style={styles.link}>
          <Text style={styles.linkText}>Go back home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  link: {
    marginTop: 20,
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: Colors.gold,
  },
});
