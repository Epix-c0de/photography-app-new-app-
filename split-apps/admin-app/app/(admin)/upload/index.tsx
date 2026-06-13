import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Camera, Image, Film, BarChart3, Upload } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';

const { width } = Dimensions.get('window');

export default function ContentHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const contentSections = [
    {
      icon: Image,
      title: 'My Galleries',
      subtitle: 'Manage uploaded galleries',
      color: Colors.gold,
      route: '/(admin)/clients/gallery',
    },
    {
      icon: Film,
      title: 'Behind The Scenes',
      subtitle: 'Share your creative process',
      color: '#8B5CF6',
      route: '/(admin)/bts-announcements',
    },
    {
      icon: BarChart3,
      title: 'Analytics',
      subtitle: 'View performance metrics',
      color: '#10B981',
      route: '/(admin)/dashboard', // TODO: Create analytics page
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Content Management</Text>
        <Text style={styles.subtitle}>Upload and manage your creative work</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        
        {/* Primary Action - Upload */}
        <TouchableOpacity
          style={styles.primaryCard}
          onPress={() => router.push('/(admin)/upload/new')}
          activeOpacity={0.8}>
          <View style={styles.primaryIconContainer}>
            <Upload size={32} color="#080810" strokeWidth={2.5} />
          </View>
          <View style={styles.primaryContent}>
            <Text style={styles.primaryTitle}>Upload New Gallery</Text>
            <Text style={styles.primarySubtitle}>
              Add photos and share with your clients
            </Text>
          </View>
          <Text style={styles.primaryChevron}>→</Text>
        </TouchableOpacity>

        {/* Content Sections Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Content Library</Text>
        </View>

        <View style={styles.grid}>
          {contentSections.map((section, index) => (
            <TouchableOpacity
              key={index}
              style={styles.card}
              onPress={() => router.push(section.route as any)}
              activeOpacity={0.7}>
              <View style={[styles.cardIconContainer, { backgroundColor: `${section.color}15` }]}>
                <section.icon size={28} color={section.color} strokeWidth={2} />
              </View>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.cardSubtitle}>{section.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Total Galleries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Total Photos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>0 GB</Text>
            <Text style={styles.statLabel}>Storage Used</Text>
          </View>
        </View>

        {/* Help Card */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Quick Tip</Text>
          <Text style={styles.helpText}>
            Upload galleries regularly to keep your clients engaged. Behind-the-scenes content helps build trust and excitement!
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  primaryContent: {
    flex: 1,
  },
  primaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#080810',
    marginBottom: 4,
  },
  primarySubtitle: {
    fontSize: 13,
    color: 'rgba(8,8,16,0.7)',
    fontWeight: '500',
  },
  primaryChevron: {
    fontSize: 28,
    color: '#080810',
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  card: {
    width: (width - 60) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 20,
    margin: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.gold,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },
  helpCard: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
});
