import AsyncStorage from '@react-native-async-storage/async-storage';

const NETWORK_COMPRESSION_KEY = 'network_compression_enabled';

/**
 * Get network compression setting
 */
export async function isNetworkCompressionEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NETWORK_COMPRESSION_KEY);
    return value !== 'false'; // Default to true
  } catch {
    return true;
  }
}

/**
 * Set network compression setting
 */
export async function setNetworkCompression(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NETWORK_COMPRESSION_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to save compression setting:', error);
  }
}
