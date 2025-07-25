# CI/CD Setup Instructions

This repository is configured with automated CI/CD for both the landing page and Tauri app releases.

## Setup Requirements

### 1. GitHub Pages Setup

1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. The lander will automatically deploy to `https://lalalune.github.io/thegame/`

### 2. Tauri Release Setup

The Tauri app builds automatically without requiring signing keys (since this is just an application layer, not a distributed app requiring code signing).

#### No Additional Secrets Needed

The workflow uses only the automatic `GITHUB_TOKEN` provided by GitHub Actions.

### 3. Repository Permissions

Ensure the repository has these permissions:

- Actions: Read and write
- Contents: Write
- Pages: Write
- Packages: Write

## Workflows

### 1. Lander Deployment (`lander-deploy.yml`)

- **Triggers**:
  - Push to main (when lander files change)
  - Manual dispatch
  - Triggered automatically after releases
- **Deploys**: Landing page to GitHub Pages
- **URL**: https://lalalune.github.io/thegame/

### 2. Tauri Release (`tauri-release.yml`)

- **Triggers**:
  - Git tags (v*.*.\*)
  - Manual dispatch
- **Builds**:
  - macOS (Universal binary)
  - Windows (MSI + EXE)
  - Linux (AppImage + DEB)
- **Publishes**: GitHub Releases with all platform binaries

### 3. Manual Release (`manual-release.yml`)

- **Trigger**: Manual dispatch only
- **Creates**: Git tag and triggers full release process

## Usage

### Creating a Release

#### Method 1: Manual Release Workflow

1. Go to Actions → Manual Release
2. Click "Run workflow"
3. Enter version (e.g., `v1.0.0`)
4. Choose if pre-release
5. Click "Run workflow"

#### Method 2: Git Tags

```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0
```

Both methods will:

1. Create a GitHub release with mysterious description
2. Build apps for all platforms
3. Upload binaries to the release
4. Trigger lander update to show new release

### Updating Just the Lander

- Push changes to `packages/lander/` on main branch
- Or manually trigger the "Deploy Lander" workflow

## Automation Flow

1. **New Release Created** → Tauri builds triggered
2. **Tauri builds complete** → Binaries uploaded to release
3. **Release published** → Lander rebuild triggered
4. **Lander updated** → New releases show on website

The lander automatically fetches and displays the latest releases from the GitHub API, so users always see current download options.

## Troubleshooting

### Tauri Build Fails

- Check that all secrets are set correctly
- Verify Tauri configuration in `packages/game/src-tauri/tauri.conf.json`
- Check build logs for platform-specific issues

### Lander Not Updating

- Verify GitHub Pages is set to "GitHub Actions" source
- Check that the workflow has Pages write permissions
- Clear browser cache (GitHub Pages can take a few minutes to update)

### Release Assets Missing

- Check that the build paths in `tauri-release.yml` match your Tauri output structure
- Verify the file upload scripts are finding the correct bundle files
