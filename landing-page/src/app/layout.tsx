import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Epix Shots — Professional Photography in Kenya',
  description:
    'Professional photography services in Kenya. Portrait sessions, event coverage, weddings, and corporate photography. Book your session today.',
  openGraph: {
    title: 'Epix Shots — Professional Photography',
    description:
      'Private galleries, instant delivery, and professional photography services in Kenya.',
    type: 'website',
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
