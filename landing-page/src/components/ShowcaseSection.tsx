'use client';

const galleryItems = [
  {
    common: 'Wedding Photography',
    binomial: 'Capturing special moments',
    photo: 'https://images.unsplash.com/photo-1519741497674-611481863555?q=80&w=2000&auto=format&fit=crop',
  },
  {
    common: 'Portrait Sessions',
    binomial: 'Professional portraits',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2000&auto=format&fit=crop',
  },
  {
    common: 'Corporate Events',
    binomial: 'Business event coverage',
    photo: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=2000&auto=format&fit=crop',
  },
  {
    common: 'Fashion Shoots',
    binomial: 'Creative fashion photography',
    photo: 'https://images.unsplash.com/photo-1469334031218-e382a71b717b?q=80&w=2000&auto=format&fit=crop',
  },
  {
    common: 'Landscape Photography',
    binomial: 'Natural landscapes',
    photo: 'https://images.unsplash.com/photo-1506260408121-e353d10b87c7?q=80&w=2000&auto=format&fit=crop',
  },
];

export default function ShowcaseSection() {
  return (
    <section id="showcase" className="relative py-24 overflow-hidden bg-background text-foreground">
      {/* Showcase Section Header */}
      <div className="text-center mb-16 relative z-10">
        <div className="inline-flex items-center glass-card px-4 py-2 rounded-full mb-4">
          <span className="text-sm font-medium text-primary">Featured Showcase</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4">
          Our <span className="text-gold-text">Creative Works</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto px-4">
          Explore our latest photography projects and discover the artistry behind every frame
        </p>
      </div>

      {/* Gallery Grid */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {galleryItems.map((item, index) => (
            <div
              key={item.common}
              className="group relative overflow-hidden rounded-2xl aspect-[3/4] cursor-pointer"
              style={{ animation: `fadeUp 0.6s ease-out ${index * 0.1}s forwards`, opacity: 0 }}
            >
              <img
                src={item.photo}
                alt={item.common}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                <h3 className="font-serif font-bold text-white text-sm">{item.common}</h3>
                <p className="text-white/70 text-xs">{item.binomial}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
