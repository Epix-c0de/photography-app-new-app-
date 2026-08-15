import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Epix Visuals — Photography Galleries & Bookings',
  description: 'Download the Epix Visuals app to access your photo galleries, book sessions, and stay connected with your photographer.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  )
}