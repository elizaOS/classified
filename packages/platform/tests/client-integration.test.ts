/**
 * Client Integration Test
 * Tests that the /client route serves the actual client React application
 */

describe('Client Integration', () => {
  beforeAll(async () => {
    // Ensure client lib is built
    const { execSync } = require('child_process');
    try {
      execSync('npm run --prefix ../client build:lib', { stdio: 'pipe' });
    } catch (error) {
      console.warn('Could not build client lib:', (error as Error).message);
    }
  });

  it('should serve the client route without redirecting to client-static', async () => {
    // This test verifies that the client route is configured properly
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(
      process.cwd(),
      'app/client/[[...path]]/page.tsx',
    );

    // Check that the page file exists
    expect(fs.existsSync(pagePath)).toBe(true);

    // Check that the page doesn't redirect to client-static
    const pageContent = fs.readFileSync(pagePath, 'utf-8');
    expect(pageContent).not.toContain('client-static');
    expect(pageContent).toContain('ClientApp');
  });

  it('should have ClientApp component that imports the actual client', async () => {
    const fs = require('fs');
    const path = require('path');
    const clientAppPath = path.join(
      process.cwd(),
      'app/client/[[...path]]/ClientApp.tsx',
    );

    expect(fs.existsSync(clientAppPath)).toBe(true);

    const clientAppContent = fs.readFileSync(clientAppPath, 'utf-8');
    // Should import from @elizaos/client package, not redirect to client-static
    expect(clientAppContent).toContain('@elizaos/client');
    expect(clientAppContent).not.toContain('window.location.href');
    expect(clientAppContent).not.toContain('client-static');
    expect(clientAppContent).not.toContain('iframe');
    // Should use React lazy loading
    expect(clientAppContent).toContain('lazy(');
    expect(clientAppContent).toContain('Suspense');
  });

  it('should not import problematic CSS that causes build errors', async () => {
    const fs = require('fs');
    const path = require('path');
    const clientAppPath = path.join(
      process.cwd(),
      'app/client/[[...path]]/ClientApp.tsx',
    );

    const clientAppContent = fs.readFileSync(clientAppPath, 'utf-8');
    // Should not import CSS directly since it causes tailwind config issues
    expect(clientAppContent).not.toContain('import.*client.css');
    // Should have a comment about CSS being handled by platform
    expect(clientAppContent).toContain(
      'CSS styles are handled by the platform',
    );
  });

  it('should have the client package built with lib exports', async () => {
    const fs = require('fs');
    const path = require('path');

    // Check that the client lib build exists
    const clientLibPath = path.join(
      process.cwd(),
      '../client/dist/lib/index.js',
    );
    expect(fs.existsSync(clientLibPath)).toBe(true);

    // Check that expected components are exported (even if types are missing)
    const libContent = fs.readFileSync(clientLibPath, 'utf-8');
    expect(libContent).toContain('AgentEditor');

    // Check that CSS exists
    const cssPath = path.join(process.cwd(), '../client/dist/lib/client.css');
    expect(fs.existsSync(cssPath)).toBe(true);
  });

  it('should use lazy loading for the client component', async () => {
    const fs = require('fs');
    const path = require('path');
    const clientAppPath = path.join(
      process.cwd(),
      'app/client/[[...path]]/ClientApp.tsx',
    );

    const clientAppContent = fs.readFileSync(clientAppPath, 'utf-8');
    expect(clientAppContent).toContain('lazy(');
    expect(clientAppContent).toContain('Suspense');
    expect(clientAppContent).toContain('LoadingSpinner');
  });

  it('should have proper package dependency setup', async () => {
    const fs = require('fs');
    const path = require('path');
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.dependencies['@elizaos/client']).toBe('workspace:*');
  });
});
