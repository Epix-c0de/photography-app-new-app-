import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, Send, Check, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function ClientReviewScreen() {
  const { gallery, client } = useLocalSearchParams<{ gallery: string; client: string }>();
  const router = useRouter();
  
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [galleryName, setGalleryName] = useState('');
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    if (gallery) {
      const { data } = await supabase
        .from('galleries')
        .select('name')
        .eq('id', gallery)
        .single();
      if (data) setGalleryName(data.name);
    }
    
    if (client) {
      const { data } = await supabase
        .from('clients')
        .select('name')
        .eq('id', client)
        .single();
      if (data) setClientName(data.name);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }

    setSubmitting(true);
    try {
      // Get gallery details for photographer_id
      const { data: galleryData } = await supabase
        .from('galleries')
        .select('owner_admin_id')
        .eq('id', gallery)
        .single();

      if (!galleryData) {
        Alert.alert('Error', 'Gallery not found');
        return;
      }

      const { error } = await supabase.from('reviews').insert({
        photographer_id: galleryData.owner_admin_id,
        client_id: client,
        gallery_id: gallery,
        rating,
        review_text: reviewText.trim() || null,
        review_source: 'web',
        is_public: true,
        is_verified: true,
      });

      if (error) throw error;

      setSubmitted(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Check size={48} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successMessage}>
            Your review has been submitted successfully.
          </Text>
          <Text style={styles.successSubtext}>
            We appreciate your feedback, {clientName}!
          </Text>
          <Pressable
            style={styles.doneButton}
            onPress={() => router.back()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Leave a Review</Text>
          <Text style={styles.subtitle}>
            How was your experience with {galleryName}?
          </Text>
        </View>

        {/* Star Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionLabel}>Your Rating</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                style={styles.starButton}
              >
                <Star
                  size={40}
                  color={star <= rating ? Colors.gold : 'rgba(255,255,255,0.2)'}
                  fill={star <= rating ? Colors.gold : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingText}>
            {rating === 0 && 'Tap to rate'}
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </Text>
        </View>

        {/* Review Text */}
        <View style={styles.reviewSection}>
          <Text style={styles.sectionLabel}>Your Review (Optional)</Text>
          <TextInput
            style={styles.reviewInput}
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Tell us about your experience..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <Pressable
          style={[styles.submitButton, (rating === 0 || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <>
              <Send size={18} color={Colors.background} />
              <Text style={styles.submitButtonText}>Submit Review</Text>
            </>
          )}
        </Pressable>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Your review will be displayed publicly to help other clients find the best photographers.
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  ratingSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold,
    textAlign: 'center',
  },
  reviewSection: {
    marginBottom: 32,
  },
  reviewInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: Colors.white,
    fontSize: 16,
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(52,199,89,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
});
