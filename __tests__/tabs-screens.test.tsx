import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-image', () => {
  const { Image } = jest.requireActual('react-native');
  return { Image };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success' },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => null),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    getGreeting: () => 'Hello',
    logout: jest.fn(),
  }),
}));

jest.mock('@/services/client', () => ({
  ClientService: {
    gallery: {
      getPhotos: jest.fn(async () => []),
    },
  },
}));

jest.mock('@/lib/supabase', () => {
  const queryResult = { data: [], error: null };

  function createThenableQueryResult(result: any) {
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      gt: jest.fn(() => builder),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      update: jest.fn(() => builder),
      insert: jest.fn(async () => ({ data: null, error: null })),
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      single: jest.fn(async () => ({ data: null, error: null })),
    };

    builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
    builder.catch = (reject: any) => Promise.resolve(result).catch(reject);
    return builder;
  }

  return {
    supabase: {
      auth: {
        getUser: jest.fn(async () => ({ data: { user: { id: 'test-user' } }, error: null })),
      },
      from: jest.fn(() => createThenableQueryResult(queryResult)),
      channel: jest.fn(() => {
        const channel: any = {
          on: jest.fn(() => channel),
          subscribe: jest.fn(() => channel),
          unsubscribe: jest.fn(),
        };
        return channel;
      }),
      removeChannel: jest.fn(),
      storage: {
        from: jest.fn(() => ({
          createSignedUrl: jest.fn(async () => ({ data: { signedUrl: 'https://example.com' }, error: null })),
        })),
      },
      functions: {
        invoke: jest.fn(async () => ({ data: {}, error: null })),
      },
    },
  };
});

import ChatScreen from '@/app/(tabs)/chat/index';
import BookingsScreen from '@/app/(tabs)/bookings/index';
import GalleryScreen from '@/app/(tabs)/gallery/index';
import HomeScreen from '@/app/(tabs)/home/index';

function renderWithProviders(ui: React.ReactElement) {
  return render(ui);
}

describe('Tabs screens', () => {
  const originalConsoleError = console.error;

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const first = args[0];
      const message = typeof first === 'string' ? first : '';
      if (message.includes('not wrapped in act')) return;
      originalConsoleError(...(args as Parameters<typeof console.error>));
    });
  });

  afterAll(() => {
    (console.error as unknown as jest.Mock).mockRestore?.();
  });

  it('renders Home screen', async () => {
    const { findByText } = renderWithProviders(<HomeScreen />);
    expect(await findByText('Welcome to your studio')).toBeTruthy();
  });

  it('renders Gallery screen', async () => {
    const { findByText } = renderWithProviders(<GalleryScreen />);
    expect(await findByText('Gallery')).toBeTruthy();
  });

  it('renders Bookings screen', async () => {
    const { findByText } = renderWithProviders(<BookingsScreen />);
    expect(await findByText('Bookings')).toBeTruthy();
  });

  it('renders Chat screen', async () => {
    const { findByText } = renderWithProviders(<ChatScreen />);
    expect(await findByText('LenzArt Studio')).toBeTruthy();
  });
});
