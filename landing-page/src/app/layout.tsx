'use client';

import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <title>Epix Shots — Professional Photography in Kenya</title>
        <meta name="description" content="Professional photography services in Kenya. Portrait sessions, event coverage, weddings, and corporate photography. Book your session today." />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
