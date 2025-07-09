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
import WebVitalsMonitor from '@/components/WebVitalsMonitor';
import ProductionPerformanceMonitor from '@/components/ProductionPerformanceMonitor';
import { AccessibilityProvider } from '@/components/AccessibilityProvider';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import type { Metadata, Viewport } from 'next';

// Optimized font loading with display swap
const font = Figtree({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-figtree',
});

// Enhanced metadata for SEO, performance, and PWA
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
  applicationName: 'MySetlist',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://mysetlist.app'),
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MySetlist',
    startupImage: [
      {
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
        url: '/images/apple-splash-640-1136.png'
      },
      {
        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
        url: '/images/apple-splash-750-1334.png'
      },
      {
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
        url: '/images/apple-splash-828-1792.png'
      }
    ]
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'MySetlist - Concert Setlist Voting Platform',
    description: 'Vote on concert setlists and discover upcoming shows!',
    siteName: 'MySetlist',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MySetlist - Concert Setlist Voting Platform'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MySetlist - Concert Setlist Voting Platform',
    description: 'Vote on concert setlists and discover upcoming shows!',
    creator: '@mysetlist',
    images: ['/images/twitter-image.png']
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
  other: {
    // PWA specific meta tags
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'msapplication-TileColor': '#10b981',
    'msapplication-tap-highlight': 'no',
    // Performance hints
    'dns-prefetch': '//fonts.googleapis.com',
    'preconnect': '//fonts.gstatic.com',
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
      <head>
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <AccessibilityProvider>
          <ToasterProvider />
          <SupabaseProvider>
            <UserProvider>
              <RealtimeProvider>
                <ErrorBoundary>
                  <ModalProvider />
                  <main id="main-content" className="min-h-screen">
                    <Sidebar>{children}</Sidebar>
                  </main>
                </ErrorBoundary>
              </RealtimeProvider>
            </UserProvider>
          </SupabaseProvider>
          <PWAInstallPrompt />
          <WebVitalsMonitor />
          <ProductionPerformanceMonitor />
        </AccessibilityProvider>
        <Analytics />
      </body>
    </html>
  );
}
