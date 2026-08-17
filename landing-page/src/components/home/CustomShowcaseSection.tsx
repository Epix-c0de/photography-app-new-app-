'use client';

import { CircularGallery, GalleryItem } from "../ui/circular-gallery";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';

const CustomShowcaseSection = () => {
  // Fetch portfolio photos from database
  const { data: portfolioPhotos } = useQuery({
    queryKey: ['homepage-portfolio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_photos')
        .select('title, description, image_url')
        .eq('is_active', true)
        .eq('show_on_homepage', true)
        .order('display_order', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  // Convert portfolio photos to GalleryItem format
  const galleryItems: GalleryItem[] = portfolioPhotos && portfolioPhotos.length > 0 
    ? portfolioPhotos.map((photo, index) => ({
        common: photo.title,
        binomial: photo.description || 'Photography',
        photo: {
          url: photo.image_url,
          text: photo.title,
          by: 'Epix Shots',
        },
      }))
    : [
      {
        common: 'Wedding Photography',
        binomial: 'Capturing special moments',
        photo: {
          url: 'https://images.unsplash.com/photo-1519741497674-611481863555?q=80&w=2000&auto=format&fit=crop',
          text: 'Wedding Photography',
          by: 'Epix Shots',
        }
      },
      {
        common: 'Portrait Sessions',
        binomial: 'Professional portraits',
        photo: {
          url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2000&auto=format&fit=crop',
          text: 'Portrait Sessions',
          by: 'Epix Shots',
        }
      },
      {
        common: 'Corporate Events',
        binomial: 'Business event coverage',
        photo: {
          url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=2000&auto=format&fit=crop',
          text: 'Corporate Events',
          by: 'Epix Shots',
        }
      },
      {
        common: 'Fashion Shoots',
        binomial: 'Creative fashion photography',
        photo: {
          url: 'https://images.unsplash.com/photo-1469334031218-e382a71b717b?q=80&w=2000&auto=format&fit=crop',
          text: 'Fashion Shoots',
          by: 'Epix Shots',
        }
      },
      {
        common: 'Landscape Photography',
        binomial: 'Natural landscapes',
        photo: {
          url: 'https://images.unsplash.com/photo-1506260408121-e353d10b87c7?q=80&w=2000&auto=format&fit=crop',
          text: 'Landscape Photography',
          by: 'Epix Shots',
        }
      },
    ];

  return (
    <div className="w-full bg-background text-foreground" style={{ height: '100vh' }}>
      <div className="w-full h-screen sticky top-0 flex flex-col items-center justify-center overflow-hidden">
        {/* Showcase Section Header */}
        <div className="text-center mb-8 absolute top-16 z-10">
          <div className="inline-flex items-center glass-card px-4 py-2 rounded-full mb-4">
            <span className="text-sm font-medium text-primary">Featured Showcase</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4">
            Our <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Creative Works</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore our latest photography projects and discover the artistry behind every frame
          </p>
        </div>
        
        <div className="w-full h-full max-w-6xl mx-auto mt-32">
          <CircularGallery items={galleryItems} />
        </div>
      </div>
    </div>
  )
}

export default CustomShowcaseSection;
