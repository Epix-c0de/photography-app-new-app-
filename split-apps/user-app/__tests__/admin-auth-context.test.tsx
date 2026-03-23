import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AdminAuthProvider, useAdminAuth } from '@/contexts/AdminAuthContext';

const mockAdmin = {
  id: 'admin-1',
  email: 'admin@yourapp.com',
  role: 'admin',
  name: 'Admin',
  password_hash: 'hashed',
  force_password_change: false,
  biometric_enabled: false,
  pin_hash: null,
  pin_enabled: false,
  failed_attempts: 0,
  account_locked_until: null,
  is_active: true,
  created_at: '',
  updated_at: '',
};

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(() => Promise.resolve('hashed')),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'token', user: { id: 'admin-1' } } },
        error: null,
      }),
      signOut: jest.fn(),
    },
    from: jest.fn((table: string) => {
      if (table === 'admin_users') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null }),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === 'admin_audit_logs') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    }),
  },
}));

function LoginProbe({ onDone }: { onDone: (value: string) => void }) {
  const { login } = useAdminAuth();

  useEffect(() => {
    login('admin@yourapp.com', 'Password123')
      .then(() => onDone('success'))
      .catch((error: Error) => onDone(error.message));
  }, [login, onDone]);

  return null;
}

describe('AdminAuthContext', () => {
  it('logs in when admin credentials are valid', async () => {
    const onDone = jest.fn();
    render(
      <AdminAuthProvider>
        <LoginProbe onDone={onDone} />
      </AdminAuthProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith('success');
    });
  });
});
