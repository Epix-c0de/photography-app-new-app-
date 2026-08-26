import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Providers from './providers';

export const metadata = {
  title: 'Epix Shots — Photo Gallery App',
  description: 'Access your professional photo galleries. View, download, and share high-resolution photos from your photographer. Download the app today.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
