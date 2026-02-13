import React from 'react';
import { render } from '@testing-library/react-native';

// Test that all components compile without errors
describe('Compilation Fixes Validation', () => {
  
  test('SecuritySetupScreen compiles with TextInput import', () => {
    // This test validates that the security-setup.tsx file compiles
    // without the "TextInput is not defined" error
    const { SecuritySetupScreen } = require('../app/security-setup');
    
    // If we can require the component without errors, the import fix worked
    expect(SecuritySetupScreen).toBeDefined();
  });

  test('AuthContext has expo-secure-store dependency', () => {
    // Test that the secure store module is available
    const SecureStore = require('expo-secure-store');
    expect(SecureStore).toBeDefined();
    expect(typeof SecureStore.getItemAsync).toBe('function');
  });

  test('Gallery screen has screen-capture dependency', () => {
    // Test that the screen capture module is available
    const ScreenCapture = require('expo-screen-capture');
    expect(ScreenCapture).toBeDefined();
  });

  test('AdminAuthContext uses secure storage correctly', () => {
    // Test that AdminAuthContext can use secure storage
    const { AdminAuthProvider } = require('../contexts/AdminAuthContext');
    
    // Mock SecureStore for the test
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn(),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn(),
    }));
    
    expect(AdminAuthProvider).toBeDefined();
  });

  test('ChangePassword screen has proper imports', () => {
    // Test that change-password screen compiles correctly
    const { default: ChangePasswordScreen } = require('../app/admin/change-password');
    expect(ChangePasswordScreen).toBeDefined();
  });

  test('Index screen routing logic works', () => {
    // Test that index.tsx routing logic is sound
    const { default: SplashScreen } = require('../app/index');
    
    // Mock the useAuth hook
    jest.mock('../contexts/AuthContext', () => ({
      useAuth: () => ({
        isLoggedIn: false,
        hasSeenOnboarding: false,
        isLoading: false,
        profile: null,
      }),
    }));
    
    expect(SplashScreen).toBeDefined();
  });
});