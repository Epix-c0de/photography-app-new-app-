import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AdminChangePasswordScreen from '@/app/admin/change-password';

const replaceMock = jest.fn();
const logoutMock = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'View',
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }));

jest.mock('@/contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    changePassword: jest.fn(),
    logout: logoutMock,
  }),
}));

describe('AdminChangePasswordScreen', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    logoutMock.mockClear();
  });

  it('routes to admin login on logout', async () => {
    const { getByText } = render(<AdminChangePasswordScreen />);
    fireEvent.press(getByText('Logout Instead'));
    expect(logoutMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/admin-login');
  });
});
