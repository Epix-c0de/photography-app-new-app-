export interface Story {
  id: string;
  image: string;
  title: string;
  isNew: boolean;
  type: string;
}

export interface Gallery {
  id: string;
  title: string;
  coverImage: string;
  photoCount: number;
  isLocked: boolean;
  date: string;
  type: string;
  price?: number;
}

export interface GalleryPhoto {
  id: string;
  uri: string;
  width: number;
  height: number;
  isWatermarked: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  image: string;
  cta: string;
  tag?: string;
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  avatar: string;
}

export interface Package {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  duration: string;
}

export interface Booking {
  id: string;
  packageName: string;
  date: string;
  time: string;
  location: string;
  status: 'booked' | 'confirmed' | 'completed' | 'editing' | 'ready';
  type: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'client' | 'photographer';
  timestamp: string;
  read: boolean;
}

export interface ChatConversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  isOnline: boolean;
}

export const stories: Story[] = [
  { id: '1', image: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=200&h=200&fit=crop', title: 'Wedding BTS', isNew: true, type: 'Wedding' },
  { id: '2', image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=200&h=200&fit=crop', title: 'Portrait Day', isNew: true, type: 'Portrait' },
  { id: '3', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200&h=200&fit=crop', title: 'Corporate', isNew: false, type: 'Corporate' },
  { id: '4', image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=200&h=200&fit=crop', title: 'Engagement', isNew: true, type: 'Wedding' },
  { id: '5', image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=200&h=200&fit=crop', title: 'Event Night', isNew: false, type: 'Event' },
];

export const galleries: Gallery[] = [
  { id: '1', title: 'Johnson Wedding', coverImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=400&fit=crop', photoCount: 342, isLocked: false, date: '2025-12-15', type: 'Wedding' },
  { id: '2', title: 'Sarah Portrait Session', coverImage: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=400&fit=crop', photoCount: 85, isLocked: false, date: '2026-01-08', type: 'Portrait' },
  { id: '3', title: 'Tech Summit 2026', coverImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop', photoCount: 210, isLocked: true, date: '2026-01-22', type: 'Corporate', price: 4500 },
  { id: '4', title: 'Mwangi Family Portraits', coverImage: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=600&h=400&fit=crop', photoCount: 120, isLocked: true, date: '2026-02-01', type: 'Family', price: 3000 },
  { id: '5', title: 'Amina & David Pre-Wedding', coverImage: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&h=400&fit=crop', photoCount: 156, isLocked: false, date: '2026-01-30', type: 'Wedding' },
];

export const galleryPhotos: GalleryPhoto[] = [
  { id: '1', uri: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=600&fit=crop', width: 400, height: 600, isWatermarked: false },
  { id: '2', uri: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=500&fit=crop', width: 400, height: 500, isWatermarked: false },
  { id: '3', uri: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=400&fit=crop', width: 400, height: 400, isWatermarked: true },
  { id: '4', uri: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=550&fit=crop', width: 400, height: 550, isWatermarked: false },
  { id: '5', uri: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=400&h=500&fit=crop', width: 400, height: 500, isWatermarked: true },
  { id: '6', uri: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=600&fit=crop', width: 400, height: 600, isWatermarked: false },
  { id: '7', uri: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=450&fit=crop', width: 400, height: 450, isWatermarked: false },
  { id: '8', uri: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=500&fit=crop', width: 400, height: 500, isWatermarked: true },
  { id: '9', uri: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=350&fit=crop', width: 400, height: 350, isWatermarked: false },
  { id: '10', uri: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=600&fit=crop', width: 400, height: 600, isWatermarked: false },
];

export const announcements: Announcement[] = [
  { id: '1', title: 'Valentine\'s Special', description: 'Book a couples shoot and get 20% off. Limited slots available.', image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&h=300&fit=crop', cta: 'Book Now', tag: 'Limited Offer' },
  { id: '2', title: 'Wedding Season 2026', description: 'Early bird packages now available. Secure your date today.', image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=300&fit=crop', cta: 'View Packages', tag: 'New' },
  { id: '3', title: 'Corporate Headshots', description: 'Professional team photos starting at KES 2,500 per person.', image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=300&fit=crop', cta: 'Learn More' },
];

export const reviews: Review[] = [
  { id: '1', name: 'Grace Muthoni', rating: 5, text: 'Absolutely stunning photos! The attention to detail was incredible. Our wedding album is a masterpiece.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
  { id: '2', name: 'David Kimani', rating: 5, text: 'Professional, creative, and so easy to work with. The corporate headshots exceeded our expectations.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
  { id: '3', name: 'Amina Hassan', rating: 5, text: 'The gallery experience was seamless. Downloaded all our photos in minutes. Truly premium service.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
  { id: '4', name: 'Peter Ochieng', rating: 5, text: 'Best photographer in Nairobi. Period. The pre-wedding shoot was magical.', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
];

export const packages: Package[] = [
  { id: '1', name: 'Essential', price: 15000, description: 'Perfect for portraits and personal shoots', features: ['1 hour session', '30 edited photos', 'Online gallery', 'Digital delivery'], duration: '1 hour' },
  { id: '2', name: 'Premium', price: 35000, description: 'Ideal for engagements and events', features: ['3 hour session', '100 edited photos', 'Online gallery', 'Digital + print delivery', '2 outfit changes', 'Location scouting'], duration: '3 hours', popular: true },
  { id: '3', name: 'Luxury', price: 75000, description: 'The complete wedding experience', features: ['Full day coverage', '500+ edited photos', 'Online gallery', 'Premium album', 'Second photographer', 'Drone coverage', 'Same-day edits'], duration: 'Full day' },
];

export const bookings: Booking[] = [
  { id: '1', packageName: 'Premium Package', date: '2026-02-14', time: '10:00 AM', location: 'Karura Forest', status: 'confirmed', type: 'Engagement' },
  { id: '2', packageName: 'Luxury Package', date: '2026-03-20', time: '8:00 AM', location: 'Windsor Hotel', status: 'booked', type: 'Wedding' },
  { id: '3', packageName: 'Essential Package', date: '2026-01-10', time: '2:00 PM', location: 'Studio', status: 'ready', type: 'Portrait' },
];

export const chatConversations: ChatConversation[] = [
  { id: '1', name: 'Epix Visuals Studios.co', avatar: 'https://images.unsplash.com/photo-1552642986-ccb41e7059e7?w=100&h=100&fit=crop', lastMessage: 'Your gallery is ready! Check it out 📸', timestamp: '2 min ago', unread: 2, isOnline: true },
];

export const chatMessages: ChatMessage[] = [
  { id: '1', text: 'Hi! I wanted to check on my wedding photos.', sender: 'client', timestamp: '10:00 AM', read: true },
  { id: '2', text: 'Hello! Great news — your gallery is almost ready. We\'re doing final edits now.', sender: 'photographer', timestamp: '10:05 AM', read: true },
  { id: '3', text: 'That\'s wonderful! Can\'t wait to see them.', sender: 'client', timestamp: '10:06 AM', read: true },
  { id: '4', text: 'Your gallery is ready! Check it out 📸', sender: 'photographer', timestamp: '10:30 AM', read: false },
  { id: '5', text: 'You can access it from the Gallery tab using your access code.', sender: 'photographer', timestamp: '10:30 AM', read: false },
];

export const quickReplies = [
  'What packages do you offer?',
  'When will my photos be ready?',
  'Can I upgrade my package?',
  'I need to reschedule',
];

export interface Notification {
  id: string;
  type: 'gallery' | 'payment' | 'booking' | 'promo' | 'system';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  galleryId?: string;
  actionLabel?: string;
}

export const notifications: Notification[] = [
  { id: '1', type: 'gallery', title: 'Gallery Ready!', body: 'Your "Johnson Wedding" gallery is now available for viewing and download.', timestamp: '2 min ago', read: false, galleryId: '1', actionLabel: 'View Gallery' },
  { id: '2', type: 'payment', title: 'Payment Received', body: 'KES 35,000 received for Premium Package. Thank you!', timestamp: '1 hour ago', read: false, actionLabel: 'View Receipt' },
  { id: '3', type: 'booking', title: 'Booking Confirmed', body: 'Your engagement shoot on Feb 14 at Karura Forest is confirmed.', timestamp: '3 hours ago', read: true, actionLabel: 'View Booking' },
  { id: '4', type: 'promo', title: "Valentine's Special 💕", body: 'Book a couples shoot and get 20% off. Limited slots available!', timestamp: '1 day ago', read: true, actionLabel: 'Book Now' },
  { id: '5', type: 'gallery', title: 'New Photos Added', body: '25 new edited photos have been added to your "Sarah Portrait Session" gallery.', timestamp: '2 days ago', read: true, galleryId: '2' },
  { id: '6', type: 'system', title: 'Welcome to Epix Visuals Studios.co', body: 'Thank you for joining! Explore our portfolio and book your first session.', timestamp: '1 week ago', read: true },
];

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  description: string;
  status: 'paid' | 'pending' | 'overdue';
  packageName: string;
}

export const invoices: Invoice[] = [
  { id: 'INV-001', date: '2026-01-30', amount: 35000, description: 'Premium Package - Engagement Shoot', status: 'paid', packageName: 'Premium' },
  { id: 'INV-002', date: '2026-01-15', amount: 15000, description: 'Essential Package - Portrait Session', status: 'paid', packageName: 'Essential' },
  { id: 'INV-003', date: '2026-02-05', amount: 75000, description: 'Luxury Package - Wedding Coverage', status: 'pending', packageName: 'Luxury' },
];
