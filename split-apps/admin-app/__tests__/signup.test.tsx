import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignupScreen from '@/app/signup';
import { supabase } from '@/lib/supabase';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'View',
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(() => Promise.resolve('hashed-pin')),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      refreshSession: jest.fn(),
    },
    from: jest.fn(() => ({
      upsert: jest.fn(),
    })),
  },
}));

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'mock-key';
  });

  it('renders correctly', () => {
    const { getAllByText, getByPlaceholderText } = render(<SignupScreen />);
    expect(getAllByText('Create Account').length).toBeGreaterThan(0);
    expect(getByPlaceholderText('Full Name')).toBeTruthy();
  });

  it('validates form inputs', async () => {
    const { getByText, getByPlaceholderText, getAllByText } = render(<SignupScreen />);
    const buttons = getAllByText('Create Account');

    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      // Check for validation error messages (implementation specific, but generic check here)
      // Since validation sets errors state, we can't easily check internal state, 
      // but we can check if signup was NOT called.
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });
  });

  it('handles successful signup', async () => {
    // Setup mocks for success
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: { id: 'test-user-id' }, session: { access_token: 'token' } },
      error: null,
    });
    
    // Mock profile upsert
    const upsertMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ upsert: upsertMock });

    const { getByText, getByPlaceholderText, getAllByText } = render(<SignupScreen />);

    // Fill form
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Mobile Number'), '0712345678');
    fireEvent.changeText(getByPlaceholderText('Email Address'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Create App PIN (4-6 digits)'), '1234');

    // Submit
    const buttons = getAllByText('Create Account');
    fireEvent.press(buttons[buttons.length - 1]); // The button is likely the last one

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
        options: {
          data: {
            display_name: 'Test User',
            phone: '0712345678',
          },
        },
      });
      
      // Check profile creation
      expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      }));
    });
  });

  it('handles signup failure', async () => {
    // Mock failure
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    const { getByText, getByPlaceholderText, getAllByText } = render(<SignupScreen />);

    // Fill minimal valid form
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Mobile Number'), '0712345678');
    fireEvent.changeText(getByPlaceholderText('Email Address'), 'existing@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Create App PIN (4-6 digits)'), '1234');

    const buttons = getAllByText('Create Account');
    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalled();
      // Alert would be shown here, but we can verify logic flow
    });
  });
});
