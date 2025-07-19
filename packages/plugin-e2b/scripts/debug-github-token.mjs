#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '../../../.env');
dotenv.config({ path: envPath });

console.log('🔍 Debugging GitHub Token Usage...');

const token = process.env.GITHUB_TOKEN;
console.log('Token info:', {
  exists: !!token,
  length: token?.length,
  prefix: token?.substring(0, 20) + '...',
  format: token?.startsWith('github_pat_')
    ? 'PAT'
    : token?.startsWith('ghp_')
      ? 'Classic'
      : 'Unknown',
});

async function testTokenWithDifferentMethods() {
  try {
    // Method 1: Direct fetch
    console.log('\n🧪 Method 1: Direct fetch with Authorization header');
    const response1 = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'ElizaOS-E2B-Plugin',
      },
    });
    console.log(`   Status: ${response1.status}`);
    if (response1.ok) {
      const user = await response1.json();
      console.log(`   ✅ Success: ${user.login}`);
    } else {
      const error = await response1.text();
      console.log(`   ❌ Error: ${error}`);
    }

    // Method 2: Octokit with explicit token
    console.log('\n🧪 Method 2: Octokit with explicit token');
    try {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({
        auth: token,
        userAgent: 'ElizaOS-E2B-Plugin',
      });

      const { data: user } = await octokit.rest.users.getAuthenticated();
      console.log(`   ✅ Success: ${user.login} (${user.type})`);

      // Test repository access
      console.log('\n🧪 Testing repository access...');
      const { data: repos } = await octokit.rest.repos.listForUser({
        username: user.login,
        per_page: 3,
        sort: 'updated',
      });
      console.log(`   ✅ Can access ${repos.length} repositories`);

      // Test elizaos/eliza access specifically
      console.log('\n🧪 Testing elizaos/eliza repository access...');
      try {
        const { data: elizaRepo } = await octokit.rest.repos.get({
          owner: 'elizaos',
          repo: 'eliza',
        });
        console.log(`   ✅ Can access elizaos/eliza repository`);
        console.log(`   📊 Stars: ${elizaRepo.stargazers_count}, Language: ${elizaRepo.language}`);

        // Test issues access
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner: 'elizaos',
          repo: 'eliza',
          state: 'open',
          per_page: 3,
        });
        console.log(`   ✅ Can access issues: ${issues.length} found`);

        if (issues.length > 0) {
          console.log(`   📋 Sample issue: #${issues[0].number} - ${issues[0].title}`);
        }
      } catch (repoError) {
        console.log(`   ❌ Cannot access elizaos/eliza: ${repoError.message}`);
      }
    } catch (octokitError) {
      console.log(`   ❌ Octokit error: ${octokitError.message}`);
    }

    // Method 3: Check token scopes
    console.log('\n🧪 Method 3: Checking token scopes');
    const scopeResponse = await fetch('https://api.github.com/user', {
      method: 'HEAD',
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'ElizaOS-E2B-Plugin',
      },
    });

    const scopes = scopeResponse.headers.get('x-oauth-scopes');
    const acceptedScopes = scopeResponse.headers.get('x-accepted-oauth-scopes');

    console.log(`   Token scopes: ${scopes || 'none'}`);
    console.log(`   Accepted scopes: ${acceptedScopes || 'none'}`);
    console.log(`   Rate limit remaining: ${scopeResponse.headers.get('x-ratelimit-remaining')}`);
  } catch (error) {
    console.error('❌ Token test failed:', error.message);
  }
}

// Run the tests
await testTokenWithDifferentMethods();

// Also test if the issue is environment loading
console.log('\n🧪 Environment debugging:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Working directory:', process.cwd());
console.log('Env file path:', envPath);

// Read token directly from file to compare
import { readFileSync } from 'fs';
try {
  const envContent = readFileSync(envPath, 'utf8');
  const tokenLine = envContent.split('\n').find((line) => line.startsWith('GITHUB_TOKEN='));
  const fileToken = tokenLine?.split('=')[1]?.trim();

  console.log('Token comparison:', {
    fromProcess: token?.substring(0, 20) + '...',
    fromFile: fileToken?.substring(0, 20) + '...',
    matches: token === fileToken,
  });
} catch (err) {
  console.log('Could not read env file directly:', err.message);
}
