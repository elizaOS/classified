#!/usr/bin/env tsx
/**
 * Route Security Migration Script
 *
 * Identifies API routes that need security header updates and helps migrate them
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

interface RouteInfo {
  file: string;
  methods: string[];
  hasSecurityHeaders: boolean;
  hasHandlePattern: boolean;
  needsMigration: boolean;
  isPublic: boolean;
}

// Routes that should be public (no auth required)
const PUBLIC_ROUTES = new Set([
  '/api/health',
  '/api/ping',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/callback',
  '/api/auth/social',
  '/api/auth/device',
  '/api/auth/verify',
  '/api/auth/refresh',
  '/api/anonymous',
  '/api/openapi.yaml',
  '/api/swagger',
]);

// Routes that require admin access
const ADMIN_ROUTES = new Set([
  '/api/security',
  '/api/performance',
  '/api/metrics',
  '/api/autocoder/ws',
]);

async function analyzeRoute(filePath: string): Promise<RouteInfo | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');

    // Skip if not a route file
    if (!content.includes('NextRequest') && !content.includes('NextResponse')) {
      return null;
    }

    // Extract route path from file path
    const routePath = filePath
      .replace(/.*\/app\/api/, '/api')
      .replace(/\/route\.ts$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1'); // Convert [id] to :id

    // Check for exported HTTP methods
    const methods: string[] = [];
    const httpMethods = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
    ];
    for (const method of httpMethods) {
      if (
        new RegExp(
          `export\\s+(const\\s+|async\\s+function\\s+)?${method}\\b`,
        ).test(content)
      ) {
        methods.push(method);
      }
    }

    // Check for handle pattern
    const hasHandlePattern =
      /export\s+(async\s+)?function\s+handle(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)/.test(
        content,
      );

    // Check if using security headers
    const hasSecurityHeaders =
      content.includes('withSecurityHeaders') ||
      content.includes('wrapHandlers');

    // Check if public route
    const isPublic =
      PUBLIC_ROUTES.has(routePath) ||
      Array.from(PUBLIC_ROUTES).some((route) => routePath.startsWith(route));

    const needsMigration = methods.length > 0 && !hasSecurityHeaders;

    return {
      file: filePath,
      methods,
      hasSecurityHeaders,
      hasHandlePattern,
      needsMigration,
      isPublic,
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
    return null;
  }
}

async function generateMigrationReport() {
  console.log('🔍 Analyzing API routes for security header compliance...\n');

  // Find all route files
  const routeFiles = await glob('app/api/**/route.ts', {
    cwd: process.cwd(),
    absolute: false,
  });

  console.log(`Found ${routeFiles.length} route files\n`);

  const results: RouteInfo[] = [];
  for (const file of routeFiles) {
    const info = await analyzeRoute(file);
    if (info) {
      results.push(info);
    }
  }

  // Generate report
  const needsMigration = results.filter((r) => r.needsMigration);
  const alreadySecured = results.filter((r) => r.hasSecurityHeaders);
  const withHandlePattern = results.filter(
    (r) => r.hasHandlePattern && !r.hasSecurityHeaders,
  );

  console.log('📊 Security Header Analysis Report');
  console.log('==================================\n');

  console.log(`Total API routes: ${results.length}`);
  console.log(`Routes with security headers: ${alreadySecured.length} ✅`);
  console.log(`Routes needing migration: ${needsMigration.length} ⚠️`);
  console.log(`Routes using handle pattern: ${withHandlePattern.length}\n`);

  if (needsMigration.length > 0) {
    console.log('🔴 Routes needing security headers:');
    console.log('===================================');

    // Group by priority
    const criticalRoutes = needsMigration.filter(
      (r) =>
        r.file.includes('/billing') ||
        r.file.includes('/api-keys') ||
        r.file.includes('/agents') ||
        r.file.includes('/organizations'),
    );

    const adminRoutes = needsMigration.filter(
      (r) =>
        r.file.includes('/security') ||
        r.file.includes('/performance') ||
        r.file.includes('/metrics'),
    );

    const publicRoutes = needsMigration.filter((r) => r.isPublic);
    const otherRoutes = needsMigration.filter(
      (r) =>
        !criticalRoutes.includes(r) &&
        !adminRoutes.includes(r) &&
        !publicRoutes.includes(r),
    );

    if (criticalRoutes.length > 0) {
      console.log('\n🚨 CRITICAL - Sensitive routes without security headers:');
      criticalRoutes.forEach((r) => {
        console.log(`  - ${r.file}`);
        console.log(`    Methods: ${r.methods.join(', ')}`);
        console.log(
          `    Pattern: ${r.hasHandlePattern ? 'handle functions' : 'direct export'}`,
        );
      });
    }

    if (adminRoutes.length > 0) {
      console.log('\n👮 Admin routes without security headers:');
      adminRoutes.forEach((r) => {
        console.log(`  - ${r.file}`);
        console.log(`    Methods: ${r.methods.join(', ')}`);
      });
    }

    if (publicRoutes.length > 0) {
      console.log('\n🌐 Public routes without security headers:');
      publicRoutes.forEach((r) => {
        console.log(`  - ${r.file}`);
        console.log(`    Methods: ${r.methods.join(', ')}`);
      });
    }

    if (otherRoutes.length > 0) {
      console.log('\n📁 Other routes without security headers:');
      otherRoutes.forEach((r) => {
        console.log(`  - ${r.file}`);
        console.log(`    Methods: ${r.methods.join(', ')}`);
      });
    }
  }

  // Migration instructions
  console.log('\n📝 Migration Instructions:');
  console.log('========================');
  console.log('1. For routes with handle functions:');
  console.log(
    "   - Import: import { wrapHandlers } from '@/lib/api/route-wrapper';",
  );
  console.log(
    '   - Export: export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });',
  );
  console.log('\n2. For routes with direct exports:');
  console.log('   - Convert exports to regular functions');
  console.log('   - Add wrapHandlers as shown above');
  console.log('\n3. For routes needing custom config:');
  console.log(
    '   - Pass config: wrapHandlers({ handleGET }, { requireAdmin: true });',
  );

  // Generate migration commands
  if (withHandlePattern.length > 0) {
    console.log('\n🛠️  Quick migration commands for handle pattern routes:');
    console.log('=====================================================');
    withHandlePattern.slice(0, 5).forEach((r) => {
      const fileName = path.basename(path.dirname(r.file));
      console.log(`\n# ${fileName}`);
      console.log(`code "${r.file}"`);
    });

    if (withHandlePattern.length > 5) {
      console.log(`\n... and ${withHandlePattern.length - 5} more routes`);
    }
  }
}

// Run the analysis
generateMigrationReport().catch(console.error);
