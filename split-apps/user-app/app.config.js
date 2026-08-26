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
    name: 'Epix Visuals Studios.co',
    slug: 'epix-visuals-studios-co',
    owner: process.env.EAS_OWNER || undefined,
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/adaptive-icon.png',
    scheme: 'epix-visuals',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/adaptive-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#141313ff',
    },
    updates: {
      url: 'https://u.expo.dev/59117d8c-75a3-4ea8-bfd0-54e1ed691fe1',
      runtimeVersion: {
        policy: 'appVersion'
      }
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'app.rork.epix-visuals-studios-co',
      associatedDomains: ['applinks:studio.epix.co', 'applinks:epix-visuals.vercel.app'],
      infoPlist: {
        NSBonjourServices: ['_http._tcp', '_https._tcp'],
        NSLocalNetworkUsageDescription:
          'Allow local network access for authentication',
        NSBonjourServiceTypes: ['_http._tcp', '_https._tcp'],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      softwareKeyboardLayoutMode: 'pan',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: [
        'INTERNET',
        'ACCESS_NETWORK_STATE',
      ],
      package: 'app.rork.epix_visuals_studios_co',
      enableProguardInReleaseBuilds: false,
      intentFilters: [
        {
          action: 'android.intent.action.VIEW',
          data: [
            {
              scheme: 'epix-visuals',
              host: 'auth',
              pathPrefix: '/callback',
            },
          ],
          category: [
            'android.intent.category.BROWSABLE',
            'android.intent.category.DEFAULT',
          ],
        },
        // Universal Links — studio.epix.co
        {
          action: 'android.intent.action.VIEW',
          data: [
            {
              scheme: 'https',
              host: 'studio.epix.co',
              pathPrefix: '/unlock',
            },
          ],
          category: [
            'android.intent.category.BROWSABLE',
            'android.intent.category.DEFAULT',
          ],
        },
        {
          action: 'android.intent.action.VIEW',
          data: [
            {
              scheme: 'https',
              host: 'studio.epix.co',
              pathPrefix: '/share',
            },
          ],
          category: [
            'android.intent.category.BROWSABLE',
            'android.intent.category.DEFAULT',
          ],
        },
        // Universal Links — epix-visuals.vercel.app (fallback domain)
        {
          action: 'android.intent.action.VIEW',
          data: [
            {
              scheme: 'https',
              host: 'epix-visuals.vercel.app',
              pathPrefix: '/unlock',
            },
          ],
          category: [
            'android.intent.category.BROWSABLE',
            'android.intent.category.DEFAULT',
          ],
        },
      ],
    },
    androidNavigationBar: {
      visible: "immersive",
      backgroundColor: "#00000000",
    },
    web: {
      favicon: './assets/images/adaptive-icon.png',
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 24,
            targetSdkVersion: 34,
            compileSdkVersion: 36,
            buildToolsVersion: '34.0.0',
            kotlinVersion: '2.1.20',
            ndkVersion: '26.1.10909125',
          },
          ios: {
            newArchEnabled: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '59117d8c-75a3-4ea8-bfd0-54e1ed691fe1',
      },
      // These are EXPO_PUBLIC_ vars — accessible via process.env in the app bundle
      EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    },
  },
};
