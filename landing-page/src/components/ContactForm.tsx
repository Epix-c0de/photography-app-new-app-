'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

const sanitizeUserInput = (input: string, maxLen: number) => input.slice(0, maxLen);
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const useSecurityLogger = () => ({
  logSecurityEvent: async () => {},
  logSuspiciousActivity: async () => {}
});

interface ContactFormProps {
  onSubmit?: (data: {
    name: string;
    email: string;
    eventType: string;
    message: string;
  }) => void;
}

export function ContactForm({ onSubmit }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    eventType: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { logSecurityEvent, logSuspiciousActivity } = useSecurityLogger();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (!isValidEmail(formData.email)) {
      toast.error("Please enter a valid email address.");
      
      await logSuspiciousActivity('invalid_email_format', {
        email: formData.email,
        userAgent: navigator.userAgent
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Sanitize inputs
      const sanitizedData = {
        name: sanitizeUserInput(formData.name, 100),
        email: sanitizeUserInput(formData.email, 255),
        eventType: sanitizeUserInput(formData.eventType, 100),
        message: sanitizeUserInput(formData.message, 1000)
      };

      // Log contact form submission
      await logSecurityEvent({
        eventType: 'contact_form_submission',
        eventData: {
          hasName: !!sanitizedData.name,
          hasEmail: !!sanitizedData.email,
          hasEventType: !!sanitizedData.eventType,
          messageLength: sanitizedData.message.length
        }
      });

      // Call parent handler if provided
      if (onSubmit) {
        onSubmit(sanitizedData);
      }

      toast.success("Thank you for your inquiry. We'll get back to you soon.");

      // Reset form
      setFormData({
        name: '',
        email: '',
        eventType: '',
        message: ''
      });

    } catch (error) {
      console.error('Contact form error:', error);
      toast.error("There was an error sending your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    // Basic input length limits
    const limits = {
      name: 100,
      email: 255,
      eventType: 100,
      message: 1000
    };

    if (value.length <= limits[field as keyof typeof limits]) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            type="text"
            placeholder="Your Name *"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="glass-card border-border focus:border-primary bg-background/50"
            required
          />
        </div>
        <div>
          <Input
            type="email"
            placeholder="Your Email *"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="glass-card border-border focus:border-primary bg-background/50"
            required
          />
        </div>
      </div>
      
      <Input
        type="text"
        placeholder="Event Type & Date"
        value={formData.eventType}
        onChange={(e) => handleInputChange('eventType', e.target.value)}
        className="glass-card border-border focus:border-primary bg-background/50"
      />
      
      <div className="relative">
        <Textarea
          placeholder="Tell us about your photography needs... *"
          value={formData.message}
          onChange={(e) => handleInputChange('message', e.target.value)}
          rows={4}
          className="glass-card border-border focus:border-primary bg-background/50 resize-none"
          required
        />
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {formData.message.length}/1000
        </div>
      </div>
      
      <Button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full golden-gradient hover-scale"
      >
        {isSubmitting ? 'Sending...' : 'Send Quick Inquiry'}
      </Button>
    </form>
  );
}
