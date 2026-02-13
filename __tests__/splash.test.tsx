import React from 'react';
import { render, act } from '@testing-library/react-native';
import SplashScreen from '@/app/index';

const replaceMock = jest.fn();
const useAuthMock = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'View',
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

describe('SplashScreen routing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    replaceMock.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('routes to onboarding when not seen', () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: false,
      hasSeenOnboarding: false,
      isLoading: false,
      profile: null,
    });

    render(<SplashScreen />);

    act(() => {
      jest.advanceTimersByTime(2200);
    });

    expect(replaceMock).toHaveBeenCalledWith('/onboarding');
  });

  it('routes to login when onboarding seen and not logged in', () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: false,
      hasSeenOnboarding: true,
      isLoading: false,
      profile: null,
    });

    render(<SplashScreen />);

    act(() => {
      jest.advanceTimersByTime(2200);
    });

    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('routes to admin dashboard for admin role', () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      hasSeenOnboarding: true,
      isLoading: false,
      profile: { role: 'admin' },
    });

    render(<SplashScreen />);

    act(() => {
      jest.advanceTimersByTime(2200);
    });

    expect(replaceMock).toHaveBeenCalledWith('/(admin)/dashboard');
  });

  it('routes to client home for client role', () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      hasSeenOnboarding: true,
      isLoading: false,
      profile: { role: 'client' },
    });

    render(<SplashScreen />);

    act(() => {
      jest.advanceTimersByTime(2200);
    });

    expect(replaceMock).toHaveBeenCalledWith('/(tabs)/home');
  });
});
