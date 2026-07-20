import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Epix Visuals — Photography Platform for Kenya',
  description: 'Private galleries, M-Pesa payments, and client management for professional photographers.',
  openGraph: {
    title: 'Epix Visuals',
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
