import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Epix Visuals — Photographer Dashboard',
  description: 'Manage your galleries, clients, and bookings',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
