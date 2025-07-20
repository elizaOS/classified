# ELIZA Game Sandbox Architecture

The ELIZA game now supports running agents in isolated containers for enhanced security and deployment flexibility.

## Overview

The sandboxing system provides:
- **Isolation**: Agent runs in a container, separated from the host system
- **Security**: Prevents potential security issues from affecting the host
- **Portability**: Consistent execution environment across platforms
- **Cross-platform**: Works on macOS, Windows, and Linux
- **Auto-installation**: Automatically installs Podman if needed

## Container Runtime Support

### Podman (Preferred)
- Open source container runtime
- No Docker Desktop EULA restrictions
- Rootless containers by default
- Compatible with Docker commands

### Docker (Fallback)
- Used if Podman is not available
- Requires Docker Desktop on Mac/Windows
- Subject to Docker Desktop licensing

## Quick Start

### Option 1: Container Mode (Recommended)
```bash
# Install dependencies
npm install

# Launch in container mode (auto-installs Podman if needed)
npm run launch:container

# Or with custom options
npm run launch -- --container --port 3001 --data-volume ./my-data
```

### Option 2: Direct Mode
```bash
# Launch directly on host (traditional mode)
npm run launch:direct

# Or simply
npm run launch
```

## Installation Process

### Automatic Installation
The launcher will automatically detect and install container runtimes:

1. **Check Existing**: First checks if Podman or Docker is available
2. **Install Podman**: If none found, attempts to install Podman
3. **Platform-Specific**: Uses appropriate installation method per OS

### Manual Installation
If automatic installation fails:

#### macOS
```bash
# Using Homebrew (recommended)
brew install podman
podman machine init --memory 2048 --disk-size 20
podman machine start

# Or download Podman Desktop
open https://podman-desktop.io/downloads
```

#### Windows
```bash
# Download and run Podman Desktop installer
# https://podman-desktop.io/downloads
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y podman
```

#### Linux (RHEL/CentOS/Fedora)
```bash
sudo dnf install -y podman
```

## Architecture

### Components

1. **SandboxManager**: Core container management
2. **GameLauncher**: High-level orchestration
3. **Dockerfile**: Agent container definition
4. **CLI Tools**: User-friendly launch scripts

### Container Configuration

```typescript
interface SandboxConfig {
  containerName: string;     // Container identifier
  imageName: string;         // Image to build/run
  ports: Array<{            // Port mappings
    host: number;
    container: number;
  }>;
  volumes: Array<{          // Volume mounts
    host: string;
    container: string;
  }>;
  environment: Record<string, string>; // Environment variables
}
```

### Default Configuration
```typescript
{
  containerName: 'eliza-agent',
  imageName: 'eliza-agent:latest',
  ports: [{ host: 7777, container: 7777 }],
  volumes: [
    { host: './container-data', container: '/app/data' },
    { host: './.env', container: '/app/.env' }
  ],
  environment: {
    NODE_ENV: 'production',
    DATABASE_PATH: '/app/data'
  }
}
```

## Usage Examples

### Basic Container Launch
```bash
# Launch with default settings
npm run launch:container
```

### Custom Configuration
```bash
# Custom port and data directory
npm run launch -- --container --port 8080 --data-volume /path/to/data

# With additional environment variables
npm run launch -- --container --env "MODEL=gpt-4" --env "DEBUG=true"
```

### Development Workflow
```bash
# Direct mode for development (faster startup)
npm run dev

# Container mode for testing deployment
npm run launch:container

# Check container status
podman ps
podman logs eliza-agent

# Connect to container
podman exec -it eliza-agent /bin/bash
```

## Container Management

### Monitoring
The launcher automatically monitors container health:
- Health checks every 30 seconds
- Automatic restart on failure
- Logs capture for debugging

### Manual Operations
```bash
# View container status
podman ps -a

# Check logs
podman logs eliza-agent

# Restart container
podman restart eliza-agent

# Stop container
podman stop eliza-agent

# Remove container
podman rm eliza-agent

# View images
podman images

# Remove image
podman rmi eliza-agent:latest
```

### Debugging
```bash
# Interactive shell in container
podman exec -it eliza-agent /bin/bash

# Follow logs in real-time
podman logs -f eliza-agent

# Inspect container configuration
podman inspect eliza-agent

# Check resource usage
podman stats eliza-agent
```

## Data Persistence

### Default Behavior
- Agent data stored in `./container-data` directory
- Database files persist between container restarts
- Configuration files mounted from host

### Custom Data Volume
```bash
# Use specific directory
npm run launch -- --container --data-volume /my/data/path
```

### Backup Strategy
```bash
# Backup data directory
tar -czf eliza-backup.tar.gz container-data/

# Restore from backup
tar -xzf eliza-backup.tar.gz
```

## Security Considerations

### Container Isolation
- Agent runs in isolated container namespace
- Limited access to host filesystem
- Network isolation (only exposed ports accessible)
- Resource limits can be configured

### Data Security
- Sensitive environment variables passed securely
- API keys isolated within container
- Host system protected from agent actions

### Network Security
- Only necessary ports exposed
- Internal container communication isolated
- Optional network policies can be applied

## Performance Optimization

### Resource Limits
```bash
# Set memory and CPU limits
podman run --memory=2g --cpus=1.0 eliza-agent:latest
```

### Image Optimization
- Multi-stage builds reduce image size
- Only production dependencies included
- Alpine Linux base for minimal footprint

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Use different port
   npm run launch -- --container --port 3001
   ```

2. **Permission Denied**
   ```bash
   # Check Podman installation
   podman --version
   
   # Restart Podman machine (macOS)
   podman machine restart
   ```

3. **Container Build Fails**
   ```bash
   # Clean build cache
   podman system prune
   
   # Rebuild image
   podman build -t eliza-agent:latest -f src-backend/Dockerfile .
   ```

4. **Health Check Fails**
   ```bash
   # Check container logs
   podman logs eliza-agent
   
   # Verify port mapping
   podman port eliza-agent
   ```

### Getting Help
- Check container logs for error messages
- Verify system requirements are met
- Ensure API keys are properly configured
- Try direct mode if container issues persist

## Migration Guide

### From Direct to Container Mode
1. Stop existing direct instance
2. Backup any important data
3. Launch in container mode
4. Verify functionality

### Container Configuration Migration
- Environment variables automatically passed through
- Data directory preserved with volume mounts
- API keys securely transferred

## Development

### Building Custom Images
```dockerfile
# Extend base image
FROM eliza-agent:latest

# Add custom plugins or configuration
COPY my-plugins/ /app/plugins/
RUN npm install /app/plugins/*

# Custom startup script
COPY startup.sh /app/
CMD ["/app/startup.sh"]
```

### Testing Containers
```bash
# Build and test locally
npm run build
npm run launch:container

# Run tests against container
npm test
```

This sandbox architecture provides a secure, portable, and user-friendly way to deploy ELIZA agents while maintaining the flexibility to run directly when needed.