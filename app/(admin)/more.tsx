import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Calendar, 
  Camera, 
  Megaphone, 
  Settings, 
  Bell, 
  Image as ImageIcon,
  ChevronRight,
  LogOut,
  HelpCircle,
  MessageSquare,
  CreditCard,
  Smartphone,
  Droplets,
  Star,
  Wifi,
  Phone,
  Gift,
  Share2
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface MenuItem {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: string;
  color?: string;
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const menuItems: MenuItem[] = [
    {
      title: 'Bookings',
      subtitle: 'Manage your schedule',
      icon: <Calendar size={22} color={Colors.gold} />,
      route: '/(admin)/admin-bookings',
    },
    {
      title: 'BTS & Announcements',
      subtitle: 'Behind-the-scenes content',
      icon: <Camera size={22} color="#FF9500" />,
      route: '/(admin)/bts-announcements',
    },
    {
      title: 'Gallery',
      subtitle: 'View all galleries',
      icon: <ImageIcon size={22} color="#34C759" />,
      route: '/(admin)/galleries',
    },
    {
      title: 'Reviews',
      subtitle: 'Client feedback & ratings',
      icon: <Star size={22} color="#FFD700" />,
      route: '/(admin)/reviews',
    },
    {
      title: 'Referrals',
      subtitle: 'Earn credits by referring',
      icon: <Gift size={22} color="#E91E63" />,
      route: '/(admin)/referrals',
    },
    {
      title: 'Social Media',
      subtitle: 'Share to Instagram/Facebook',
      icon: <Share2 size={22} color="#9C27B0" />,
      route: '/(admin)/social',
    },
    {
      title: 'Settings',
      subtitle: 'Account & preferences',
      icon: <Settings size={22} color="#8E8E93" />,
      route: '/(admin)/settings',
    },
    {
      title: 'M-Pesa Settings',
      subtitle: 'Payment configuration',
      icon: <CreditCard size={22} color="#34C759" />,
      route: '/(admin)/settings/simple-mpesa',
    },
    {
      title: 'SMS & WhatsApp',
      subtitle: 'Messaging configuration',
      icon: <Smartphone size={22} color="#007AFF" />,
      route: '/(admin)/settings/sms-management',
    },
    {
      title: 'Watermark',
      subtitle: 'Photo watermark settings',
      icon: <Droplets size={22} color="#6C9AED" />,
      route: '/(admin)/settings/watermark',
    },
    {
      title: 'USSD Settings',
      subtitle: 'USSD access configuration',
      icon: <Phone size={22} color="#FF9500" />,
      route: '/(admin)/settings/ussd-settings',
    },
    {
      title: 'Receipt Settings',
      subtitle: 'Customize payment receipts',
      icon: <CreditCard size={22} color="#FFD700" />,
      route: '/(admin)/settings/receipt-settings',
    },
    {
      title: 'Support',
      subtitle: 'Get help',
      icon: <HelpCircle size={22} color="#5AC8FA" />,
      route: '/(admin)/support',
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Additional features</Text>
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.title}
            style={({ pressed }) => [
              styles.menuItem,
              index === 0 && styles.menuItemFirst,
              index === menuItems.length - 1 && styles.menuItemLast,
              pressed && styles.menuItemPressed,
            ]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.menuIconContainer}>
              {item.icon}
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </Pressable>
        ))}
      </View>

      {/* Sign Out */}
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutButtonPressed,
        ]}
        onPress={handleSignOut}
      >
        <LogOut size={20} color="#FF3B30" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      {/* App Version */}
      <Text style={styles.version}>Epix Visuals v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  menuContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuItemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  menuItemLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.2)',
    gap: 8,
    marginBottom: 24,
  },
  signOutButtonPressed: {
    backgroundColor: 'rgba(255,59,48,0.15)',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 20,
  },
});
