import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

import { AuthProvider } from '@/contexts/AuthContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { UpdateProvider } from '@/components/UpdateProvider';
import SecurityGuard from '@/components/SecurityGuard';
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

    // Handle initial URL (for OAuth callbacks and invite links when app is launched)
    Linking.getInitialURL().then(async (url) => {
      if (url) {
        console.log('[Deep Link] Initial URL:', url);
        if (url.includes('auth/callback')) {
          console.log('[Deep Link] Initial OAuth callback detected');
        }
        // Handle invite links: epixvisuals://join?ref=ADMIN_ID&invite=TOKEN
        if (url.includes('join') && url.includes('invite=')) {
          const parsed = new URL(url.replace('epixvisuals://', 'https://epixvisuals.app/'));
          const inviteToken = parsed.searchParams.get('invite');
          if (inviteToken) {
            console.log('[Deep Link] Invite token detected:', inviteToken);
            // Store the token — will be claimed after user logs in
            try {
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              await AsyncStorage.setItem('pending_invite_token', inviteToken);
            } catch (e) {
              console.warn('[Deep Link] Failed to store invite token:', e);
            }
          }
        }
      }
    });
    
    // Handle deep linking for OAuth callbacks and invites (when app is already running)
    const linkingSubscription = Linking.addEventListener('url', async (event) => {
      console.log('[Deep Link] URL received:', event.url);
      
      if (event.url.includes('auth/callback')) {
        console.log('[Deep Link] OAuth callback detected');
      }
      // Handle invite links while app is running
      if (event.url.includes('join') && event.url.includes('invite=')) {
        const parsed = new URL(event.url.replace('epixvisuals://', 'https://epixvisuals.app/'));
        const inviteToken = parsed.searchParams.get('invite');
        if (inviteToken) {
          console.log('[Deep Link] Invite token (live):', inviteToken);
          try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.setItem('pending_invite_token', inviteToken);
            // If user is already signed in, claim it immediately
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data, error } = await supabase.rpc('claim_invite_token', { p_token: inviteToken });
              if (!error && data?.success) {
                await AsyncStorage.removeItem('pending_invite_token');
                console.log('[Invite] Token claimed successfully:', data);
              }
            }
          } catch (e) {
            console.warn('[Deep Link] Failed to process invite token:', e);
          }
        }
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
                <SecurityGuard userId={session?.user?.id || null}>
                  <RootLayoutNav />
                </SecurityGuard>
              </UpdateProvider>
            </BrandingProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

export default RootLayout;
