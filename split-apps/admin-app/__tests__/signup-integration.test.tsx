import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignupScreen from '@/app/signup';
import { supabase } from '@/lib/supabase';
import { createUserProfileWithRetry, isProfileComplete } from '@/lib/signup';

// Mock all dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      refreshSession: jest.fn()
    },
    from: jest.fn(() => ({
      upsert: jest.fn(),
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn()
    }))
  }
}));

jest.mock('@/lib/signup', () => ({
  ...(jest.requireActual('@/lib/signup') as Record<string, unknown>),
  createUserProfileWithRetry: jest.fn(),
  isProfileComplete: jest.fn(),
  checkSupabaseConnectivity: (jest.fn() as any).mockResolvedValue({ reachable: true, error: null }),
  hashPin: (jest.fn() as any).mockResolvedValue('hashed_pin_123')
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn()
  })
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn()
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: (jest.fn() as any).mockResolvedValue(true),
  isEnrolledAsync: (jest.fn() as any).mockResolvedValue(true)
}));

describe('Signup Integration Tests', () => {
  const mockAuthData = {
    user: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'john@example.com'
    },
    session: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (supabase.auth.signUp as any).mockResolvedValue({
      data: mockAuthData,
      error: null
    });
    
    (createUserProfileWithRetry as any).mockResolvedValue({
      success: true
    });
    
    (isProfileComplete as any).mockResolvedValue(true);
  });

  it('should complete successful signup with profile creation', async () => {
    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    // Fill out the form
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'John Doe');
    fireEvent.changeText(getByPlaceholderText('Mobile Number'), '+254712345678');
    fireEvent.changeText(getByPlaceholderText('Email Address'), 'john@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('4-6 digit PIN'), '1234');

    // Submit the form
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'Password123',
        options: {
          data: {
            display_name: 'John Doe',
            phone: '+254712345678'
          }
        }
      });
    });

    await waitFor(() => {
      expect(createUserProfileWithRetry).toHaveBeenCalledWith(
        mockAuthData.user.id,
        expect.objectContaining({
          name: 'John Doe',
          phone: '+254712345678',
          email: 'john@example.com'
        })
      );
    });
  });

  it('should handle profile creation failure with retry mechanism', async () => {
    // Mock profile creation to fail first, then succeed
    (createUserProfileWithRetry as any)
      .mockResolvedValueOnce({
        success: false,
        error: new Error('Network error'),
        attempt: 1
      })
      .mockResolvedValueOnce({
        success: true
      });

    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    // Fill out the form
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'John Doe');
    fireEvent.changeText(getByPlaceholderText('Mobile Number'), '+254712345678');
    fireEvent.changeText(getByPlaceholderText('Email Address'), 'john@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('4-6 digit PIN'), '1234');

    // Submit the form
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(createUserProfileWithRetry).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle complete profile creation failure gracefully', async () => {
    // Mock profile creation to fail completely
    (createUserProfileWithRetry as any).mockResolvedValue({
      success: false,
      error: new Error('Database constraint violation'),
      attempt: 3
    });
    
    (isProfileComplete as any).mockResolvedValue(false);

    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    // Fill out the form
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'John Doe');
    fireEvent.changeText(getByPlaceholderText('Mobile Number'), '+254712345678');
    fireEvent.changeText(getByPlaceholderText('Email Address'), 'john@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('4-6 digit PIN'), '1234');

    // Submit the form
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(createUserProfileWithRetry).toHaveBeenCalled();
      expect(isProfileComplete).toHaveBeenCalled();
    });
  });

  it('should handle incomplete profile that exists but needs completion', async () => {
    // Mock profile creation to fail but profile exists
    (createUserProfileWithRetry as any).mockResolvedValue({
      success: false,
      error: new Error('Partial success'),
      attempt: 1
    });
    
    (isProfileComplete as any).mockResolvedValue(true);

    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    // Fill out the form
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'John Doe');
    fireEvent.changeText(getByPlaceholderText('Mobile Number'), '+254712345678');
    fireEvent.changeText(getByPlaceholderText('Email Address'), 'john@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('4-6 digit PIN'), '1234');

    // Submit the form
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(createUserProfileWithRetry).toHaveBeenCalled();
      expect(isProfileComplete).toHaveBeenCalled();
    });
  });

  it('should validate form inputs before submission', async () => {
    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    // Fill out form with invalid data
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'J'); // Too short
    fireEvent.changeText(getByPlaceholderText('Mobile Number'), '123'); // Too short
    fireEvent.changeText(getByPlaceholderText('Email Address'), 'invalid-email');
    fireEvent.changeText(getByPlaceholderText('Password'), 'weak'); // Too weak
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'mismatch'); // Doesn't match
    fireEvent.changeText(getByPlaceholderText('4-6 digit PIN'), '12'); // Too short

    // Submit the form
    fireEvent.press(getByText('Create Account'));

    // Should not attempt signup due to validation errors
    await waitFor(() => {
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });
  });
});
