# CI/CD Workflows for ElizaOS Game

This directory contains GitHub Actions workflows for building and releasing the ElizaOS Game across multiple platforms.

## Workflows

### 1. `release.yml` - Production Releases

**Trigger**: When a version tag is pushed (e.g., `v1.0.0`)

**Platforms Built**:

- macOS (Intel x86_64)
- macOS (Apple Silicon aarch64)
- Windows (x86_64)
- Linux (x86_64)

**Artifacts**:

- Creates a GitHub release with all platform binaries
- DMG files for macOS
- MSI installers for Windows
- DEB packages and AppImages for Linux

### 2. `build-test.yml` - Development Builds

**Trigger**: Pull requests and pushes to main branch affecting game package

**Purpose**:

- Test that builds work on all platforms
- Catch build issues early
- Store temporary build artifacts for testing

### 3. `release-universal.yml` - Universal macOS Builds

**Trigger**: Tags with `-universal` suffix (e.g., `v1.0.0-universal`)

**Purpose**:

- Creates universal macOS binaries containing both Intel and Apple Silicon code
- Single download works on all Macs

## Setting Up Code Signing (Optional)

For production releases, you may want to set up code signing:

### macOS Code Signing

Add these secrets to your GitHub repository:

```
APPLE_CERTIFICATE - Base64 encoded .p12 certificate
APPLE_CERTIFICATE_PASSWORD - Password for the certificate
APPLE_SIGNING_IDENTITY - Name of the signing identity
APPLE_ID - Apple ID email
APPLE_PASSWORD - App-specific password
APPLE_TEAM_ID - Apple Developer Team ID
```

Then uncomment the signing environment variables in `release.yml`.

### Windows Code Signing

Add these secrets for Windows signing:

```
WINDOWS_CERTIFICATE - Base64 encoded .pfx certificate
WINDOWS_CERTIFICATE_PASSWORD - Certificate password
```

## Creating a Release

### Automatic Release (Recommended)

1. Update version in `packages/game/package.json`
2. Commit and push changes
3. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. GitHub Actions will automatically build and create the release

### Manual Release

1. Go to GitHub Actions
2. Select "Release ElizaOS Game" workflow
3. Click "Run workflow"
4. Enter the desired tag version

## Build Artifacts

After a successful release build, the following artifacts are created:

### macOS

- `ElizaOS-Terminal-{version}-aarch64.dmg` - Apple Silicon installer
- `ElizaOS-Terminal-{version}-x86_64.dmg` - Intel Mac installer
- `ElizaOS Terminal.app` - App bundle (in tar.gz)

### Windows

- `ElizaOS-Terminal-{version}-x86_64.msi` - Windows installer
- `ElizaOS Terminal.exe` - Executable

### Linux

- `ElizaOS-Terminal-{version}-amd64.deb` - Debian package
- `ElizaOS-Terminal-{version}-x86_64.AppImage` - Portable AppImage

## Troubleshooting

### Build Failures

1. Check the Actions logs for specific error messages
2. Common issues:
   - Missing dependencies (ensure all platforms have required libs)
   - Rust compilation errors (check Rust target availability)
   - Node.js/Bun version mismatches

### Platform-Specific Issues

**macOS**:

- Ensure both Intel and ARM targets are available
- Check if Xcode Command Line Tools are installed in CI

**Windows**:

- WebView2 dependency is automatically handled by Tauri
- Ensure Visual Studio Build Tools are available

**Linux**:

- System dependencies must be explicitly installed
- AppImage requires additional setup

## Workflow Security

- All workflows use pinned action versions for security
- Secrets are only accessible to the main repository
- Pull requests from forks cannot access secrets (builds without signing)
- Release creation requires `contents: write` permission

## Monitoring Builds

- Check the Actions tab in GitHub for build status
- Each platform builds in parallel for faster completion
- Failed builds will show detailed logs
- Artifacts are retained for 7 days on test builds, permanently on releases
