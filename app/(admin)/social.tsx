import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Instagram, Facebook, Unlink, ExternalLink, Loader2, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import SettingsHeader from '@/components/SettingsHeader';

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('social_connections')
      .select('*')
      .eq('photographer_id', user.id);

    setConnections(data || []);
    setLoading(false);
  };

  const isConnected = (platform: string) => {
    return connections.some(c => c.platform === platform && c.is_active);
  };

  const handleConnect = (platform: string) => {
    Alert.alert(
      `Connect ${platform === 'instagram' ? 'Instagram' : 'Facebook'}`,
      `To connect your ${platform} account, you'll be redirected to authorize the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Connect', onPress: () => {
          // In production, this would open OAuth flow
          Alert.alert('Coming Soon', 'Social media integration will be available soon. Configure your API keys in the web dashboard settings.');
        }}
      ]
    );
  };

  const handleDisconnect = (platform: string) => {
    Alert.alert(
      `Disconnect ${platform}?`,
      'You can reconnect later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          await supabase
            .from('social_connections')
            .update({ is_active: false })
            .eq('photographer_id', user.id)
            .eq('platform', platform);

          loadConnections();
          Alert.alert('Disconnected', `${platform} has been disconnected.`);
        }}
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loader2 size={24} color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SettingsHeader title="Social Media" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Instagram */}
        <View style={[styles.platformCard, isConnected('instagram') && styles.platformCardActive]}>
          <View style={styles.platformHeader}>
            <Instagram size={28} color={isConnected('instagram') ? '#E4405F' : 'rgba(255,255,255,0.3)'} />
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>Instagram</Text>
              <Text style={styles.platformStatus}>
                {isConnected('instagram') ? 'Connected' : 'Not connected'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.platformDescription}>
            Share photos directly to your Instagram feed
          </Text>

          {isConnected('instagram') ? (
            <Pressable
              style={styles.disconnectBtn}
              onPress={() => handleDisconnect('instagram')}
            >
              <Unlink size={16} color="#FF3B30" />
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.connectBtn}
              onPress={() => handleConnect('instagram')}
            >
              <ExternalLink size={16} color={Colors.background} />
              <Text style={styles.connectBtnText}>Connect Instagram</Text>
            </Pressable>
          )}
        </View>

        {/* Facebook */}
        <View style={[styles.platformCard, isConnected('facebook') && styles.platformCardActive]}>
          <View style={styles.platformHeader}>
            <Facebook size={28} color={isConnected('facebook') ? '#1877F2' : 'rgba(255,255,255,0.3)'} />
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>Facebook Page</Text>
              <Text style={styles.platformStatus}>
                {isConnected('facebook') ? 'Connected' : 'Not connected'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.platformDescription}>
            Share to your Facebook business page
          </Text>

          {isConnected('facebook') ? (
            <Pressable
              style={styles.disconnectBtn}
              onPress={() => handleDisconnect('facebook')}
            >
              <Unlink size={16} color="#FF3B30" />
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.connectBtn}
              onPress={() => handleConnect('facebook')}
            >
              <ExternalLink size={16} color={Colors.background} />
              <Text style={styles.connectBtnText}>Connect Facebook</Text>
            </Pressable>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Social Sharing</Text>
          <Text style={styles.infoText}>
            • Share BTS content directly to Instagram and Facebook{'\n'}
            • Photos are posted with your watermark{'\n'}
            • Configure API keys in web dashboard settings{'\n'}
            • Posts include your studio branding
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  platformCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  platformCardActive: {
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  platformInfo: {
    flex: 1,
  },
  platformName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  platformStatus: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  platformDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 14,
  },
  connectBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.background,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
    borderRadius: 12,
    padding: 14,
  },
  disconnectBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
  },
  infoCard: {
    backgroundColor: 'rgba(212,175,55,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
});
