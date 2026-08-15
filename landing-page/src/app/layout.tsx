import type { Metadata } from 'next';
import './globals.css';
import './fonts.css';

export const metadata: Metadata = {
  title: 'Epix Visuals — Photography Galleries & Bookings',
  description:
    'Download the Epix Visuals app to access your photo galleries, book sessions, and stay connected with your photographer. Available on iOS and Android.',
  openGraph: {
    title: 'Epix Visuals',
    description:
      'Private photo galleries, instant delivery, and secure access for professional photography in Kenya.',
    type: 'website',
    images: ['/og-image.jpg'],
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        {children}
      </body>
    </html>
  );
}