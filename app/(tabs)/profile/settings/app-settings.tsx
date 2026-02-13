import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';
import { useState } from 'react';

export default function AppSettings() {
  const [wifiOnly, setWifiOnly] = useState(false);
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="App Settings" />
      
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>Data Usage</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Stream over Wi-Fi only</Text>
            <Switch
              value={wifiOnly}
              onValueChange={setWifiOnly}
              trackColor={{ false: Colors.border, true: Colors.gold }}
            />
          </View>
        </View>
        
        <Text style={styles.sectionHeader}>Storage</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Clear Image Cache</Text>
            <Text style={styles.value}>12 MB</Text>
          </View>
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
  content: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  label: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  value: {
    fontSize: 16,
    color: Colors.textMuted,
  }
});