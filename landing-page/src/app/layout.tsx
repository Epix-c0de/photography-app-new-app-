import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Providers from './providers';

export const metadata = {
  title: 'Epix Shots — Professional Photography in Kenya',
  description: 'Professional photography services in Kenya. Portrait sessions, event coverage, weddings, and corporate photography. Book your session today.',
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
