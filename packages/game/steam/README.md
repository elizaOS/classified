# Steam Deployment Configuration

This directory contains Steam-specific deployment configurations for ElizaOS Terminal.

## Files

- `install_script_windows.vdf` - Windows installation script for Steam
  - Handles registry entries
  - Installs required redistributables (DirectX, VC++ Runtime)
  - Creates desktop and Start Menu shortcuts

## Depot Structure

The GitHub Actions workflow organizes builds into three Steam depots:

1. **Windows Depot** (Depot ID: APP_ID + 1)
   - `.exe` installer files
   - `.msi` installer files
   - `install_script.vdf`

2. **Linux Depot** (Depot ID: APP_ID + 2)
   - `.AppImage` files
   - `.deb` packages

3. **macOS Depot** (Depot ID: APP_ID + 3)
   - `.dmg` disk images
   - `.app` bundles

## Customization

### Install Scripts

You can customize the install scripts for each platform:

- **Windows**: Edit `install_script_windows.vdf`
- **Linux**: Add `install_script_linux.vdf` (optional)
- **macOS**: Add `install_script_macos.vdf` (optional)

### Redistributables

If your app requires specific redistributables:

1. Place them in `packages/game/redist/` directory
2. Update the install script to reference them
3. They will be included in the Steam depot

### Branch Configuration

The workflow automatically selects release branches:

- Beta tags (e.g., `v1.0.0-beta`) → `beta` branch
- Release tags (e.g., `v1.0.0`) → `release` branch

## Testing

To test Steam deployment locally:

1. Install `steamcmd`
2. Use the same depot structure as the workflow
3. Test with: `steamcmd +login <user> <pass> +run_app_build <path_to_app_build.vdf>`

## Notes

- The install script is only required for Windows if you need registry entries or shortcuts
- Steam automatically handles basic installation for all platforms
- Custom install scripts allow for advanced setup like firewall rules or system configuration
