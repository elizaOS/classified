/**
 * Client Static Files Handler
 * Serves the built client application files
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { wrapHandlers } from '@/lib/api/route-wrapper';

const CLIENT_DIST_PATH = join(process.cwd(), 'public', 'client-static');

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    html: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    json: 'application/json',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

async function handleGET(
  request: NextRequest,
  props: { params: Promise<{ path?: string[] }> },
) {
  try {
    const params = await props.params;
    const pathSegments = params.path || [];
    let filePath = pathSegments.join('/');

    // Default to index.html for root or directory requests
    if (!filePath || filePath.endsWith('/')) {
      filePath = 'index.html';
    }

    const fullPath = join(CLIENT_DIST_PATH, filePath);

    // Security check - ensure we're serving from the client dist directory
    if (!fullPath.startsWith(CLIENT_DIST_PATH)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Check if file exists
    if (!existsSync(fullPath)) {
      // For SPA routing, serve index.html for non-asset requests
      // Only serve index.html for paths that look like routes (no file extension)
      if (!filePath.includes('.')) {
        const indexPath = join(CLIENT_DIST_PATH, 'index.html');
        if (existsSync(indexPath)) {
          const content = readFileSync(indexPath);
          return new NextResponse(content, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      }
      // Return 404 for missing asset files
      console.error('File not found:', fullPath);
      return new NextResponse('Not Found', { status: 404 });
    }

    // Serve the file
    const content = readFileSync(fullPath);
    const mimeType = getMimeType(fullPath);

    // Set appropriate caching headers
    const cacheHeaders = filePath.startsWith('assets/')
      ? { 'Cache-Control': 'public, max-age=31536000, immutable' } // 1 year for assets
      : { 'Cache-Control': 'no-cache, no-store, must-revalidate' }; // No cache for HTML

    return new NextResponse(content, {
      headers: {
        'Content-Type': mimeType,
        ...cacheHeaders,
      },
    });
  } catch (error) {
    console.error('Error serving client static file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export const { GET } = wrapHandlers({ handleGET });
