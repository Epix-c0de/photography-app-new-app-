import React from 'react';
import { render } from '@testing-library/react-native';

// Mocks
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('expo-image', () => {
  const { Image } = jest.requireActual('react-native');
  return { Image };
});

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', name: 'Test User', email: 'test@example.com' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({ data: null, error: null })),
          order: jest.fn(async () => ({ data: [], error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(async () => ({ error: null })),
      })),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(async () => ({ error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://test.com/avatar.jpg' } })),
      })),
    },
  },
}));

// Import components to test
import ProfileScreen from '@/app/(tabs)/profile/index';
import MemberBenefits from '@/app/(tabs)/profile/settings/member-benefits';
import Invoices from '@/app/(tabs)/profile/settings/invoices';
import Downloads from '@/app/(tabs)/profile/settings/downloads';
import Favorites from '@/app/(tabs)/profile/settings/favorites';
import Notifications from '@/app/(tabs)/profile/settings/notifications';
import PrivacySecurity from '@/app/(tabs)/profile/settings/privacy-security';
import AppSettings from '@/app/(tabs)/profile/settings/app-settings';
import HelpSupport from '@/app/(tabs)/profile/settings/help-support';
import ProfileEditModal from '@/components/ProfileEditModal';

describe('Profile Settings Screens', () => {
  it('renders ProfileScreen without crashing', () => {
    render(<ProfileScreen />);
  });

  it('renders MemberBenefits without crashing', () => {
    render(<MemberBenefits />);
  });

  it('renders Invoices without crashing', () => {
    render(<Invoices />);
  });

  it('renders Downloads without crashing', () => {
    render(<Downloads />);
  });

  it('renders Favorites without crashing', () => {
    render(<Favorites />);
  });

  it('renders Notifications without crashing', () => {
    render(<Notifications />);
  });

  it('renders PrivacySecurity without crashing', () => {
    render(<PrivacySecurity />);
  });

  it('renders AppSettings without crashing', () => {
    render(<AppSettings />);
  });

  it('renders HelpSupport without crashing', () => {
    render(<HelpSupport />);
  });

  it('renders ProfileEditModal when visible', () => {
    render(
      <ProfileEditModal 
        visible={true} 
        onClose={() => {}} 
        onOptionSelect={() => {}} 
        hasCurrentPhoto={true} 
      />
    );
  });
});
