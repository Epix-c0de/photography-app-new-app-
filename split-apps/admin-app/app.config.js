// app.config.js — used by Expo CLI and EAS Build.
// Environment variables in .env are available locally via process.env.
// For EAS Cloud builds, we fall back to the hardcoded values below so the
// built APK always has the correct Supabase configuration.

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ujunohfpcmjywsblsoel.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdW5vaGZwY21qeXdzYmxzb2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk5NzYsImV4cCI6MjA4NjIyNTk3Nn0.w4bhLUjaAXhB8B1sujLJWIG5-TokDPuEIInFeLm5EMg';

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'Epix Visuals Admin',
    slug: 'epix-visuals-admin',
    owner: process.env.EAS_OWNER || undefined,
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/adaptive-icon.png',
    scheme: 'epix-visuals-admin',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/adaptive-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#141313ff',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'app.rork.epix-visuals-admin',
      infoPlist: {
        NSBonjourServices: ['_http._tcp', '_https._tcp'],
        NSLocalNetworkUsageDescription:
          'Allow local network access for authentication',
        NSBonjourServiceTypes: ['_http._tcp', '_https._tcp'],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: [
        'SEND_SMS',
        'READ_SMS',
        'RECEIVE_SMS',
        'READ_PHONE_STATE',
        'INTERNET',
        'ACCESS_NETWORK_STATE',
      ],
      package: 'app.rork.epix_visuals_admin',
      intentFilters: [
        {
          action: 'android.intent.action.VIEW',
          data: [
            {
              scheme: 'epix-visuals-admin',
              host: 'auth',
              pathPrefix: '/callback',
            },
          ],
          category: [
            'android.intent.category.BROWSABLE',
            'android.intent.category.DEFAULT',
          ],
        },
      ],
    },
    web: {
      favicon: './assets/images/adaptive-icon.png',
    },
    plugins: ['expo-router', 'expo-font', 'expo-web-browser'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '3ebabefa-64dc-4b36-b71c-94c1753e94d7',
      },
      // These are EXPO_PUBLIC_ vars — accessible via process.env in the app bundle
      EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    },
  },
};
