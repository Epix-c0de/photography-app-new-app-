import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

import { AuthProvider } from '@/contexts/AuthContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { UpdateProvider } from '@/components/UpdateProvider';
import Colors from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="security-setup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="auth-required" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="payment-success"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="bts/all"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="bts/[id]"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[Auth] Error getting session:', error);
        } else {
          setSession(session);
          console.log('[Auth] Session initialized:', session?.user?.email || 'No user');
        }
      } catch (error) {
        console.error('[Auth] Error initializing auth:', error);
      } finally {
        setIsLoading(false);
        SplashScreen.hideAsync();
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] State changed:', _event, session?.user?.email || 'No user');
      setSession(session);
      
      // Hide splash screen on auth state change
      if (isLoading) {
        setIsLoading(false);
        SplashScreen.hideAsync();
      }
    });

    // Handle initial URL (for OAuth callbacks when app is launched)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[Deep Link] Initial URL:', url);
        if (url.includes('auth/callback')) {
          console.log('[Deep Link] Initial OAuth callback detected');
        }
      }
    });
    
    // Handle deep linking for OAuth callbacks
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      console.log('[Deep Link] URL received:', event.url);
      
      // Handle OAuth callback
      if (event.url.includes('auth/callback')) {
        console.log('[Deep Link] OAuth callback detected');
        // The router will automatically handle the navigation to /auth/callback
      }
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription?.remove();
    };
  }, [isLoading]);
  
  if (isLoading) {
    // You could return a loading screen here if needed
    return null;
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
        <SafeAreaProvider>
          <AuthProvider>
            <BrandingProvider>
              <UpdateProvider>
                <RootLayoutNav />
              </UpdateProvider>
            </BrandingProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

export default RootLayout;
