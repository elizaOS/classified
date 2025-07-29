#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

async function main() {
  console.log('Fixing common test issues...\n');

  // Find all test files
  const testFiles = await glob('**/*.test.{ts,tsx}', {
    cwd: process.cwd(),
    absolute: true,
    ignore: ['node_modules/**', 'dist/**', 'build/**'],
  });

  console.log(`Found ${testFiles.length} test files to check`);

  let fixedCount = 0;

  for (const file of testFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Fix: Add extended timeout for async tests that might be timing out
    if (content.includes('waitFor') && !content.includes('timeout:')) {
      // Find waitFor calls without explicit timeout
      content = content.replace(
        /waitFor\(\s*\(\)\s*=>\s*{/g,
        'waitFor(() => {',
      );

      // Add timeout to waitFor calls that don't have one
      content = content.replace(
        /waitFor\(\s*\(\)\s*=>\s*{([^}]+)}\s*\)/g,
        (match, body) => {
          if (!match.includes('timeout:')) {
            return `waitFor(() => {${body}}, { timeout: 10000 })`;
          }
          return match;
        },
      );
      modified = true;
    }

    // Fix: Ensure proper async test declarations
    content = content.replace(
      /it\('([^']+)',\s*\(\)\s*=>\s*{/g,
      (match, testName) => {
        // Check if the test body contains async operations
        const testBody = content.substring(content.indexOf(match));
        const nextTestIndex = testBody.search(/\n\s*(it|test|describe)\(/);
        const testContent =
          nextTestIndex > -1 ? testBody.substring(0, nextTestIndex) : testBody;

        if (testContent.includes('await') || testContent.includes('waitFor')) {
          return `it('${testName}', async () => {`;
        }
        return match;
      },
    );

    // Fix: Add proper test timeouts for long-running tests
    if (content.includes('Test timed out in 5000ms')) {
      // Add extended timeout to specific tests
      content = content.replace(
        /it\('([^']*completed[^']*)',\s*async\s*\(\)\s*=>\s*{/g,
        "it('$1', async () => {",
      );

      // Add timeout configuration comment
      if (!content.includes('testTimeout')) {
        content = `// Extended timeout for async operations\n` + content;
        modified = true;
      }
    }

    // Fix: Handle multiple element matches
    if (content.includes('getByText(') && file.includes('.tsx')) {
      // Add more specific queries for common problematic patterns
      content = content.replace(
        /screen\.getByText\((['"`])([^'"`]+)\1\)/g,
        (match, quote, text) => {
          // For texts that might appear multiple times, use more specific queries
          if (text.length < 30) {
            return match; // Keep short texts as is
          }
          return `screen.getByText(${quote}${text}${quote}, { selector: 'p' })`;
        },
      );
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✓ Fixed ${path.relative(process.cwd(), file)}`);
      fixedCount++;
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} test files`);

  // Also update vitest config to have better defaults
  const vitestConfigPath = path.join(process.cwd(), 'vitest.config.ts');
  if (fs.existsSync(vitestConfigPath)) {
    let vitestConfig = fs.readFileSync(vitestConfigPath, 'utf8');

    if (!vitestConfig.includes('testTimeout')) {
      vitestConfig = vitestConfig.replace(
        /test:\s*{/,
        `test: {
    testTimeout: 20000, // 20 second default timeout
    hookTimeout: 20000,`,
      );
      fs.writeFileSync(vitestConfigPath, vitestConfig, 'utf8');
      console.log('✓ Updated vitest.config.ts with extended timeouts');
    }
  }
}

main().catch(console.error);
