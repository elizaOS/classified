#!/usr/bin/env node

/**
 * Web Deployment Script
 * Handles deployment of the platform to web hosting services
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TARGET = process.env.DEPLOY_TARGET || 'vercel';
const ENVIRONMENT = process.env.NODE_ENV || 'production';

console.log(`🚀 Starting web deployment to ${TARGET} (${ENVIRONMENT})`);

// Validate environment variables
function validateEnvironment() {
  const required = [
    'WORKOS_API_KEY',
    'WORKOS_CLIENT_ID',
    'JWT_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_WORKOS_CLIENT_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`  - ${key}`));
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

// Build the application
function buildApplication() {
  console.log('📦 Building application...');

  try {
    execSync('npm run build:platform', {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        BUILD_MODE: 'default',
      },
    });
    console.log('✅ Application built successfully');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Deploy to specific target
function deployToTarget() {
  switch (TARGET) {
    case 'vercel':
      deployToVercel();
      break;
    case 'netlify':
      deployToNetlify();
      break;
    case 'static':
      deployStatic();
      break;
    default:
      console.error(`❌ Unknown deployment target: ${TARGET}`);
      process.exit(1);
  }
}

function deployToVercel() {
  console.log('🚀 Deploying to Vercel...');

  try {
    // Check if vercel CLI is installed
    execSync('which vercel', { stdio: 'ignore' });
  } catch {
    console.log('📦 Installing Vercel CLI...');
    execSync('npm install -g vercel', { stdio: 'inherit' });
  }

  try {
    const deployCmd = ENVIRONMENT === 'production' ? 'vercel --prod' : 'vercel';
    execSync(deployCmd, { stdio: 'inherit' });
    console.log('✅ Deployed to Vercel successfully');
  } catch (error) {
    console.error('❌ Vercel deployment failed:', error.message);
    process.exit(1);
  }
}

function deployToNetlify() {
  console.log('🚀 Deploying to Netlify...');

  try {
    // Check if netlify CLI is installed
    execSync('which netlify', { stdio: 'ignore' });
  } catch {
    console.log('📦 Installing Netlify CLI...');
    execSync('npm install -g netlify-cli', { stdio: 'inherit' });
  }

  try {
    const deployCmd =
      ENVIRONMENT === 'production'
        ? 'netlify deploy --prod --dir=.next'
        : 'netlify deploy --dir=.next';
    execSync(deployCmd, { stdio: 'inherit' });
    console.log('✅ Deployed to Netlify successfully');
  } catch (error) {
    console.error('❌ Netlify deployment failed:', error.message);
    process.exit(1);
  }
}

function deployStatic() {
  console.log('📦 Creating static deployment...');

  // Create static export
  try {
    execSync('npm run build', {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        BUILD_MODE: 'export',
      },
    });

    const outDir = path.join(process.cwd(), 'out');
    if (fs.existsSync(outDir)) {
      console.log(`✅ Static files ready in: ${outDir}`);
      console.log(
        '📄 Upload the contents of the "out" directory to your web server',
      );
    } else {
      throw new Error('Static export directory not found');
    }
  } catch (error) {
    console.error('❌ Static deployment preparation failed:', error.message);
    process.exit(1);
  }
}

// Health check after deployment
function healthCheck() {
  if (TARGET === 'static') {
    console.log('⏭️  Skipping health check for static deployment');
    return;
  }

  const healthUrl =
    process.env.HEALTH_CHECK_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/health`;

  console.log(`🔍 Running health check on ${healthUrl}...`);

  // Simple health check with curl
  try {
    execSync(`curl -f ${healthUrl}`, { stdio: 'ignore' });
    console.log('✅ Health check passed');
  } catch (error) {
    console.warn('⚠️  Health check failed - deployment may still be starting');
  }
}

// Main deployment flow
async function main() {
  try {
    validateEnvironment();
    buildApplication();
    deployToTarget();

    // Wait a moment before health check
    setTimeout(() => {
      healthCheck();
      console.log('🎉 Web deployment completed successfully!');
    }, 5000);
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, validateEnvironment, buildApplication };
