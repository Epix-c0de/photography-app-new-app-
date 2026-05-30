import React from 'react';
import { View, StyleSheet } from 'react-native';

interface UpdateProviderProps {
  children: React.ReactNode;
}

export function UpdateProvider({ children }: UpdateProviderProps) {
  // Update banner disabled - updates still work silently in background
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
