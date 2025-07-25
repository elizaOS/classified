#!/usr/bin/env node
/**
 * Bundle Container Runtime Script
 *
 * This script downloads and bundles portable Podman for different platforms
 * to be included in the Tauri app bundle.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_DIR = path.join(__dirname, '..', 'src-tauri', 'resources');
const BIN_DIR = path.join(RESOURCES_DIR, 'bin');

// Platform-specific Podman download URLs
const PODMAN_RELEASES = {
  'darwin-x64': {
    url: 'https://github.com/containers/podman/releases/download/v4.8.3/podman-remote-release-darwin_amd64.zip',
    filename: 'podman-remote-release-darwin_amd64.zip',
    executable: null, // Will be auto-detected
  },
  'darwin-arm64': {
    url: 'https://github.com/containers/podman/releases/download/v4.8.3/podman-remote-release-darwin_arm64.zip',
    filename: 'podman-remote-release-darwin_arm64.zip',
    executable: null, // Will be auto-detected
  },
  'linux-x64': {
    url: 'https://github.com/containers/podman/releases/download/v4.8.3/podman-remote-static-linux_amd64.tar.gz',
    filename: 'podman-remote-static-linux_amd64.tar.gz',
    executable: null, // Will be auto-detected
  },
  'win32-x64': {
    url: 'https://github.com/containers/podman/releases/download/v4.8.3/podman-remote-release-windows_amd64.zip',
    filename: 'podman-remote-release-windows_amd64.zip',
    executable: null, // Will be auto-detected
  },
};

async function downloadFile(url, outputPath) {
  console.log(`📥 Downloading ${url}...`);

  return new Promise((resolve, reject) => {
    import('fs').then(({ createWriteStream, unlink }) => {
      const file = createWriteStream(outputPath);

      https
        .get(url, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Handle redirect
            return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            console.log(`✅ Downloaded to ${outputPath}`);
            resolve();
          });

          file.on('error', (err) => {
            unlink(outputPath, () => {}); // Delete incomplete file
            reject(err);
          });
        })
        .on('error', reject);
    }).catch(reject);
  });
}

async function extractArchive(archivePath, extractDir) {
  const ext = path.extname(archivePath);

  console.log(`📦 Extracting ${archivePath}...`);

  if (ext === '.zip') {
    // Use unzip command or node module
    try {
      execSync(`unzip -o -q "${archivePath}" -d "${extractDir}"`, { stdio: 'pipe' });
    } catch (error) {
      // Fallback to using a Node.js zip library if available
      throw new Error(`Failed to extract ZIP file: ${error.message}`);
    }
  } else if (ext === '.gz') {
    // Extract tar.gz
    try {
      execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Failed to extract tar.gz file: ${error.message}`);
    }
  }

  console.log(`✅ Extracted to ${extractDir}`);
}

async function detectPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  let key = `${platform}-${arch}`;

  // Map Node.js arch to our keys
  if (arch === 'x64') {key = `${platform}-x64`;}
  if (arch === 'arm64') {key = `${platform}-arm64`;}

  if (!PODMAN_RELEASES[key]) {
    throw new Error(`Unsupported platform: ${key}`);
  }

  return key;
}

async function bundleContainerRuntime() {
  console.log('🚀 Bundling Container Runtime for ELIZA Game');
  console.log('='.repeat(50));

  try {
    // Create directories
    await fs.mkdir(RESOURCES_DIR, { recursive: true });
    await fs.mkdir(BIN_DIR, { recursive: true });

    // Detect current platform
    const platformKey = await detectPlatform();
    const release = PODMAN_RELEASES[platformKey];

    console.log(`🔍 Detected platform: ${platformKey}`);
    console.log(`📦 Will download: ${release.url}`);

    // Check if runtime already exists
    const finalExecutable = path.join(
      BIN_DIR,
      process.platform === 'win32' ? 'podman.exe' : 'podman'
    );

    if (await fileExists(finalExecutable)) {
      console.log(`⚠️  Container runtime already exists: ${finalExecutable}`);
      console.log('🔄 Use --force to overwrite existing runtime');

      if (!process.argv.includes('--force')) {
        console.log('✅ Skipping download - use --force to overwrite');
        return;
      }

      console.log('🗑️  Removing existing runtime...');
      await fs.rm(finalExecutable, { force: true });
    }

    // Download the archive
    const downloadPath = path.join(RESOURCES_DIR, release.filename);
    await downloadFile(release.url, downloadPath);

    // Clean and create extract directory
    const extractDir = path.join(RESOURCES_DIR, 'temp-extract');
    await fs.rm(extractDir, { recursive: true, force: true });
    await fs.mkdir(extractDir, { recursive: true });
    await extractArchive(downloadPath, extractDir);

    // Find the executable in the extracted directory
    const extractedExecutable = await findExecutableInExtract(extractDir);

    if (!extractedExecutable) {
      throw new Error('Could not find podman executable in extracted archive');
    }

    console.log(`🔍 Found executable: ${extractedExecutable}`);

    // Check if the extracted executable exists
    try {
      await fs.access(extractedExecutable);
      await fs.copyFile(extractedExecutable, finalExecutable);

      // Make executable on Unix systems
      if (process.platform !== 'win32') {
        execSync(`chmod +x "${finalExecutable}"`);
      }

      // Verify the executable works
      console.log('🔍 Verifying bundled runtime...');
      try {
        const verifyOutput = execSync(`"${finalExecutable}" --version`, {
          encoding: 'utf8',
          timeout: 10000
        });
        console.log(`✅ Runtime verification successful: ${verifyOutput.trim()}`);
      } catch (verifyError) {
        console.warn(`⚠️  Runtime verification failed: ${verifyError.message}`);
      }

      console.log(`✅ Bundled Podman executable: ${finalExecutable}`);
    } catch (error) {
      console.error(`❌ Failed to copy executable: ${error.message}`);
      console.log(`🔍 Looking for files in: ${extractDir}`);

      // List files in extract directory for debugging
      try {
        const files = await fs.readdir(extractDir, { recursive: true });
        console.log('📁 Available files:');
        files.forEach((file) => console.log(`   ${file}`));
      } catch (listError) {
        console.error(`Failed to list extracted files: ${listError.message}`);
      }

      throw error;
    }

    // Clean up
    await fs.rm(downloadPath, { force: true });
    await fs.rm(extractDir, { recursive: true, force: true });

    console.log('');
    console.log('✅ Container runtime bundling complete!');
    console.log(`📦 Bundled executable: ${finalExecutable}`);
    console.log('🎮 The ELIZA game can now run with bundled container support');

    // Create a metadata file for version tracking
    const metadataPath = path.join(BIN_DIR, 'runtime-info.json');
    const metadata = {
      version: '4.8.3',
      platform: platformKey,
      downloadedAt: new Date().toISOString(),
      url: release.url,
      executable: finalExecutable
    };

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`📝 Runtime metadata saved: ${metadataPath}`);

  } catch (error) {
    console.error('');
    console.error('❌ Container runtime bundling failed:');
    console.error(error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   1. Check internet connection');
    console.error('   2. Verify platform support');
    console.error('   3. Ensure write permissions to resources directory');
    console.error('   4. Try running with --force to overwrite existing files');
    process.exit(1);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findExecutableInExtract(extractDir) {
  try {
    const files = await fs.readdir(extractDir, { recursive: true });

    // Look for podman executables
    const candidates = [];

    for (const file of files) {
      const fullPath = path.join(extractDir, file);
      const fileName = path.basename(file);

      // Check if it's a podman executable
      if (fileName === 'podman' || fileName === 'podman.exe' || fileName === 'podman-remote') {
        try {
          const stats = await fs.stat(fullPath);
          if (stats.isFile()) {
            candidates.push({
              path: fullPath,
              name: fileName,
              relativePath: file
            });
          }
        } catch (e) {
          // Skip if we can't stat the file
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Prefer 'podman' over 'podman-remote'
    const preferred = candidates.find(c => c.name === 'podman') || candidates[0];
    console.log(`🎯 Selected executable: ${preferred.relativePath}`);

    return preferred.path;
  } catch (error) {
    console.error(`Failed to find executable: ${error.message}`);
    return null;
  }
}

// Add option to bundle for all platforms (for CI/release builds)
async function bundleAllPlatforms() {
  console.log('🚀 Bundling Container Runtime for All Platforms');
  console.log('='.repeat(50));

  for (const [platformKey, release] of Object.entries(PODMAN_RELEASES)) {
    console.log(`\n📦 Bundling for ${platformKey}...`);

    try {
      const platformBinDir = path.join(RESOURCES_DIR, 'bin', platformKey);
      await fs.mkdir(platformBinDir, { recursive: true });

      // Download
      const downloadPath = path.join(RESOURCES_DIR, release.filename);
      await downloadFile(release.url, downloadPath);

      // Extract
      const extractDir = path.join(RESOURCES_DIR, `temp-extract-${platformKey}`);
      await fs.mkdir(extractDir, { recursive: true });
      await extractArchive(downloadPath, extractDir);

      // Copy executable
      const extractedExecutable = path.join(extractDir, release.executable);
      const finalExecutable = path.join(
        platformBinDir,
        platformKey.includes('win32') ? 'podman.exe' : 'podman'
      );

      await fs.copyFile(extractedExecutable, finalExecutable);

      // Make executable on Unix systems
      if (!platformKey.includes('win32')) {
        execSync(`chmod +x "${finalExecutable}"`);
      }

      console.log(`✅ Bundled for ${platformKey}: ${finalExecutable}`);

      // Clean up
      await fs.rm(downloadPath, { force: true });
      await fs.rm(extractDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`❌ Failed to bundle for ${platformKey}: ${error.message}`);
      // Continue with other platforms
    }
  }

  console.log('\n✅ Multi-platform container runtime bundling complete!');
}

// Check command line arguments
if (process.argv.includes('--all-platforms')) {
  bundleAllPlatforms().catch(console.error);
} else {
  bundleContainerRuntime().catch(console.error);
}
