import withPWA from 'next-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.platform\.elizaos\.com\/.*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for both SSG export and regular builds
  ...(process.env.BUILD_MODE === 'export'
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
        assetPrefix: '',
        // Disable features not compatible with static export
        skipTrailingSlashRedirect: true,
        distDir: 'out',
      }
    : {}),

  poweredByHeader: false,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  images: {
    domains: ['d2eu2jqkbj4sko.cloudfront.net'],
  },
  reactStrictMode: true,
  transpilePackages: ['@elizaos/client', '@elizaos/core'],
  experimental: {
    optimizePackageImports: [
      '@elizaos/core',
      '@elizaos/server',
      '@elizaos/client',
    ],
    webVitalsAttribution: ['CLS', 'LCP'],
  },
  // Skip API route optimization during build to prevent database initialization
  serverExternalPackages: [
    '@/lib/database',
    'postgres',
    '@electric-sql/pglite',
  ],

  env: {
    // Make dev mode configurable at runtime for testing
    NEXT_PUBLIC_DEV_MODE:
      process.env.NEXT_PUBLIC_DEV_MODE ||
      (process.env.NODE_ENV === 'development' ? 'true' : 'false'),
    API_BASE_URL:
      process.env.API_BASE_URL || 'https://api.platform.elizaos.com',
    BUILD_MODE: process.env.BUILD_MODE || 'default',
  },
  async rewrites() {
    // Skip rewrites for static export mode
    if (process.env.BUILD_MODE === 'export') {
      return [];
    }

    return [
      // Redirect client assets to client-static directory
      {
        source: '/assets/:path*',
        destination: '/client-static/assets/:path*',
      },
      // Handle client favicon and other root assets
      {
        source: '/favicon.ico',
        destination: '/client-static/favicon.ico',
      },
    ];
  },
  webpack: (config, { isServer, dev }) => {
    // Ignore require.extensions warnings from handlebars
    if (!config.ignoreWarnings) {
      config.ignoreWarnings = [];
    }
    config.ignoreWarnings.push({
      module: /handlebars/,
      message: /require\.extensions/,
    });

    // Handle @elizaos/core module resolution
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
        net: false,
        tls: false,
        os: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        constants: false,
        _stream_duplex: false,
        _stream_passthrough: false,
        _stream_readable: false,
        _stream_writable: false,
        _stream_transform: false,
        worker_threads: false,
      };
    }

    // Handle bun:pglite module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      'bun:pglite': false, // Disable bun:pglite imports
    };

    // Exclude database and server-only modules from client bundle
    if (!isServer) {
      config.externals = [
        ...(config.externals || []),
        'postgres',
        'better-sqlite3',
        '@libsql/client',
        'ioredis',
        'crypto',
        'net',
        'tls',
        'stream',
        'pino-pretty',
        'pino-abstract-transport',
      ];
    }

    // Optimize bundle for mobile
    if (!isServer && !dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 200000, // 200KB chunks
          },
        },
      };
    }

    return config;
  },
  // Configure ESLint for Next.js 15
  eslint: {
    // Workaround for Next.js 15 ESLint configuration issue
    ignoreDuringBuilds: true,
  },

  // TypeScript configuration
  typescript: {
    // ignoreBuildErrors: true,
  },
};

export default pwaConfig(nextConfig);
