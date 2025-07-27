import { readFile, writeFile, copyFile, mkdir, chmod } from 'fs/promises';
import { createRequire } from 'module';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const platforms = [
  { name: 'linux', nodeUrl: 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-x64.tar.gz' },
  { name: 'darwin', nodeUrl: 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-darwin-x64.tar.gz' },
  { name: 'win32', nodeUrl: 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' },
];

async function buildSEA() {
  console.log('Building Stagehand Server SEA binaries...');

  // Ensure dist directory exists
  await mkdir(join(__dirname, '../dist'), { recursive: true });
  await mkdir(join(__dirname, '../binaries'), { recursive: true });

  // Create SEA config
  const seaConfig = {
    main: './dist/index.js',
    output: './binaries/stagehand-server.blob',
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
  };

  await writeFile(join(__dirname, '../sea-config.json'), JSON.stringify(seaConfig, null, 2));

  try {
    // Step 1: Create the blob
    console.log('Creating SEA blob...');
    await execAsync('node --experimental-sea-config sea-config.json', {
      cwd: join(__dirname, '..'),
    });

    // Step 2: Create binaries for each platform
    for (const platform of platforms) {
      console.log(`Building for ${platform.name}...`);

      const ext = platform.name === 'win32' ? '.exe' : '';
      const outputName = `stagehand-server-${platform.name}${ext}`;
      const outputPath = join(__dirname, '../binaries', outputName);

      if (platform.name === process.platform) {
        // For current platform, use local node
        await copyFile(process.execPath, outputPath);
      } else {
        // For other platforms, we'd need to download node binaries
        // This is simplified - in production you'd download and extract
        console.log(`Skipping cross-platform build for ${platform.name} (requires CI/CD setup)`);
        continue;
      }

      // Step 3: Inject the blob
      const postjectCommand = `npx postject ${outputPath} NODE_SEA_BLOB ./binaries/stagehand-server.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;

      console.log('Running postject...');
      await execAsync(postjectCommand, {
        cwd: join(__dirname, '..'),
      });

      // Make executable on Unix systems
      if (platform.name !== 'win32') {
        await chmod(outputPath, 0o755);
      }

      console.log(`Created: ${outputPath}`);
    }

    // Step 4: Create a wrapper script for easier execution
    const wrapperScript = `#!/usr/bin/env node
// Stagehand Server Launcher
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const platform = os.platform();
const ext = platform === 'win32' ? '.exe' : '';
const binaryName = \`stagehand-server-\${platform}\${ext}\`;
const binaryPath = path.join(__dirname, 'binaries', binaryName);

const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code);
});
`;

    await writeFile(join(__dirname, '../stagehand-server'), wrapperScript, { mode: 0o755 });

    console.log('SEA build completed successfully!');
  } catch (error) {
    console.error('Error building SEA:', error);
    process.exit(1);
  }
}

// Run the build
buildSEA().catch(console.error);
