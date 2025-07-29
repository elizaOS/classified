#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route files in app/api
const routeFiles = glob.sync('app/api/**/*.ts', { cwd: process.cwd() });

let filesFixed = 0;

routeFiles.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Check if file has exported handle* functions
  const hasExportedHandleFunctions =
    /export\s+async\s+function\s+handle(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/g.test(
      content,
    );

  if (hasExportedHandleFunctions) {
    // Check if already has proper exports at the end
    const hasProperExports =
      /export\s+const\s+\{\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/.test(
        content,
      );
    const hasDirectExports =
      /export\s+const\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*=/.test(
        content,
      );

    if (!hasProperExports && !hasDirectExports) {
      console.log(`Fixing ${file}...`);

      // First, add the import for wrapHandlers if not present
      if (!content.includes('wrapHandlers')) {
        const nextImportMatch = content.match(
          /import\s+.*?\s+from\s+['"]next\/server['"]/,
        );
        if (nextImportMatch) {
          const insertPosition =
            nextImportMatch.index + nextImportMatch[0].length;
          content =
            content.slice(0, insertPosition) +
            ";\nimport { wrapHandlers } from '@/lib/api/route-wrapper'" +
            content.slice(insertPosition);
          modified = true;
        }
      }

      // Remove 'export' from handle* functions
      content = content.replace(
        /export\s+(async\s+function\s+handle(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS))/g,
        '$1',
      );

      // Find all handle* functions in the file
      const handleFunctions = [];
      const functionMatches = content.matchAll(
        /async\s+function\s+handle(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/g,
      );
      for (const match of functionMatches) {
        handleFunctions.push(`handle${match[1]}`);
      }

      // Add proper exports at the end if we found functions
      if (handleFunctions.length > 0) {
        const exportObject = handleFunctions
          .map((fn) => {
            const method = fn.replace('handle', '');
            return `${method}`;
          })
          .join(', ');

        const wrapperObject = handleFunctions
          .map((fn) => {
            return `${fn}`;
          })
          .join(', ');

        // Remove any existing improper exports
        content = content.replace(
          /\nexport const (GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) = handle\1;/g,
          '',
        );

        // Add proper export at the end
        if (!content.trim().endsWith(';')) {
          content = content.trimEnd() + '\n';
        }
        content =
          content.trimEnd() +
          `\n\nexport const { ${exportObject} } = wrapHandlers({ ${wrapperObject} });\n`;
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(file, content);
        filesFixed++;
      }
    }
  }
});

console.log(`\nFixed ${filesFixed} route files.`);
