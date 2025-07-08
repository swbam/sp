import { Sidebar } from '@/components/Sidebar';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { Figtree } from 'next/font/google';
import { SupabaseProvider } from '@/providers/SupabaseProvider';
import { UserProvider } from '@/providers/UserProvider';
import { ModalProvider } from '@/providers/ModalProvider';
import { ToasterProvider } from '@/providers/ToasterProvider';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Metadata, Viewport } from 'next';

// Optimized font loading with display swap
const font = Figtree({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-figtree',
});

// Enhanced metadata for SEO and performance
export const metadata: Metadata = {
  title: {
    default: 'MySetlist - Concert Setlist Voting Platform',
    template: '%s | MySetlist'
  },
  description: 'Vote on concert setlists, discover upcoming shows, and predict what your favorite artists will play next. Join the ultimate music community for live show predictions.',
  keywords: ['concert', 'setlist', 'music', 'voting', 'live shows', 'artists', 'venues'],
  authors: [{ name: 'MySetlist Team' }],
  creator: 'MySetlist',
  publisher: 'MySetlist',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://mysetlist.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'MySetlist - Concert Setlist Voting Platform',
    description: 'Vote on concert setlists and discover upcoming shows!',
    siteName: 'MySetlist',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MySetlist - Concert Setlist Voting Platform',
    description: 'Vote on concert setlists and discover upcoming shows!',
    creator: '@mysetlist',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
  colorScheme: 'dark',
};

// Disable revalidation for better performance
export const revalidate = false;

export default async function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="en" className={font.variable}>
      <body className="font-sans antialiased">
        <ToasterProvider />
        <SupabaseProvider>
          <UserProvider>
            <RealtimeProvider>
              <ErrorBoundary>
                <ModalProvider />
                <Sidebar>{children}</Sidebar>
              </ErrorBoundary>
            </RealtimeProvider>
          </UserProvider>
        </SupabaseProvider>
        <Analytics />
      </body>
    </html>
  );
}
