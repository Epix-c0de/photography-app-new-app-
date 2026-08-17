'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { Star, Quote, Plus } from 'lucide-react';
import GlassCard from './GlassCard';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { toast } from 'sonner';

const defaultTestimonials = [
  {
    id: '1',
    name: 'Sarah Johnson',
    role: 'Wedding Client',
    content: 'The photos captured every emotion perfectly. We couldn\'t be happier with the results!',
    rating: 5,
    avatar: 'SJ'
  },
  {
    id: '2',
    name: 'Michael Chen',
    role: 'Corporate Client',
    content: 'Professional, creative, and incredibly easy to work with. Highly recommended!',
    rating: 5,
    avatar: 'MC'
  },
  {
    id: '3',
    name: 'Emily Davis',
    role: 'Portrait Client',
    content: 'An amazing experience from start to finish. The gallery access system is so convenient!',
    rating: 5,
    avatar: 'ED'
  }
];

const TestimonialsSection = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const queryClient = useQueryClient();

  // Fetch approved reviews from database
  const { data: dbReviews } = useQuery({
    queryKey: ['homepage-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, clients(name)')
        .eq('status', 'approved')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data;
    },
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reviews')
        .insert({
          rating: reviewRating,
          comment: reviewComment,
          status: 'pending', // Needs admin approval
          featured: false,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      setIsReviewModalOpen(false);
      setReviewName('');
      setReviewComment('');
      setReviewRating(5);
      toast.success('Thank you! Your review has been submitted and is pending approval.');
    },
    onError: () => {
      toast.error('Failed to submit review. Please try again.');
    },
  });

  // Use database reviews if available, otherwise fallback to defaults
  const testimonials = dbReviews && dbReviews.length > 0 
    ? dbReviews.map(review => ({
        id: review.id,
        name: (review.clients as any)?.name || 'Happy Client',
        role: 'Verified Client',
        content: review.comment || 'Great experience!',
        rating: review.rating,
        avatar: ((review.clients as any)?.name || 'HC').split(' ').map((n: string) => n[0]).join('').slice(0, 2)
      }))
    : defaultTestimonials;

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background accent */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 80%, hsl(43 70% 55% / 0.05), transparent 60%)'
        }}
      />

      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm font-medium tracking-widest uppercase mb-4 block">
            Testimonials
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            What Our <span className="text-gradient">Clients</span> Say
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Real stories from our valued clients
          </p>
          
          {/* Add Review Button */}
          <Button 
            onClick={() => setIsReviewModalOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Share Your Experience
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.15 }}
            >
              <GlassCard className="h-full relative">
                {/* Quote icon */}
                <Quote className="absolute top-6 right-6 w-8 h-8 text-primary/20" />

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>

                {/* Content */}
                <p className="text-foreground/80 leading-relaxed mb-6 italic">
                  &ldquo;{testimonial.content}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full golden-gradient flex items-center justify-center font-semibold text-primary-foreground">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Your Experience</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your Name (optional)</Label>
              <Input 
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <Label>Rating</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="focus:outline-none"
                  >
                    <Star 
                      className={`w-8 h-8 transition-colors ${
                        star <= reviewRating 
                          ? 'fill-primary text-primary' 
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Your Review *</Label>
              <Textarea 
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Tell us about your experience..."
                rows={4}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsReviewModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => submitReviewMutation.mutate()}
                disabled={!reviewComment.trim() || submitReviewMutation.isPending}
              >
                {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default TestimonialsSection;
