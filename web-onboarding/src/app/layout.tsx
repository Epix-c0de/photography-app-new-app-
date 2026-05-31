import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Epix Visuals Studios — For Photographers',
  description: 'Deliver stunning photo galleries to your clients. KES 500/month.',
  openGraph: {
    title: 'Epix Visuals Studios',
    description: 'The professional photography delivery platform for Kenyan photographers.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
