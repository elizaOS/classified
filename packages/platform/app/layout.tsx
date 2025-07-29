import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Toaster } from 'sonner';
import PlausibleProvider from 'next-plausible';
import { CSPostHogProvider } from './providers';
import { ThemeProvider } from '@/components/theme/theme-provider';

// Initialize environment validation on app start
import '@/lib/config/env-validation';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'ElizaOS Platform - AI Agent Development Platform',
  description:
    'Complete AI agent development platform with inference, hosting, storage, and rapid deployment',
  keywords: ['AI', 'agents', 'ElizaOS', 'platform', 'development', 'hosting'],
  authors: [{ name: 'ElizaOS Team' }],
  creator: 'ElizaOS',
  publisher: 'ElizaOS',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://platform.elizaos.com',
  ),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'ElizaOS Platform',
    description:
      'Complete AI agent development platform with inference, hosting, storage, and rapid deployment',
    url: '/',
    siteName: 'ElizaOS Platform',
    type: 'website',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ElizaOS Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ElizaOS Platform',
    description:
      'Complete AI agent development platform with inference, hosting, storage, and rapid deployment',
    images: ['/images/twitter-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ElizaOS Platform',
  },
  applicationName: 'ElizaOS Platform',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ElizaOS Platform" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="ElizaOS Platform" />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/icons/icon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/icons/icon-16x16.png"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-typography-strong antialiased`}
      >
        <Toaster duration={3000} position="bottom-right" />
        <div className="min-h-screen w-full font-sans antialiased">
          <PlausibleProvider
            domain={process.env.NEXT_PUBLIC_APP_URL || ''}
            trackOutboundLinks={true}
            taggedEvents={true}
            trackLocalhost={false}
          >
            <CSPostHogProvider>
              <ThemeProvider>{children}</ThemeProvider>
            </CSPostHogProvider>
          </PlausibleProvider>
        </div>
      </body>
    </html>
  );
}
