# ELIZA Game - Container Setup

**IMPORTANT:** ELIZA Game uses a built-in container orchestrator that manages containers via **podman** (not docker-compose). The Tauri app handles all container lifecycle management.

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env with your API keys:**
   ```bash
   # Required: Add your OpenAI or Anthropic API key
   OPENAI_API_KEY=your_key_here
   # OR
   ANTHROPIC_API_KEY=your_key_here
   ```

3. **Install podman (if not installed):**
   ```bash
   # macOS
   brew install podman
   
   # Linux (Ubuntu/Debian)
   sudo apt install podman
   
   # Windows - install Podman Desktop
   ```

4. **Start the game:**
   ```bash
   npm run dev    # Development mode with hot reload
   # OR
   npm run start  # Production build and run
   ```

## How It Works

**The Tauri app automatically manages containers:**
- **PostgreSQL** (port 5432) - Database with pgvector
- **Ollama** (port 11434) - Local AI models  
- **Agent Server** (port 7777) - ELIZA agent runtime
- **Game UI** - Native desktop app with web frontend

## Commands

- `npm run dev` - Development mode (hot reload)
- `npm run start` - Production build and run
- `npm run build` - Build only
- `npm run test` - Run Cypress tests

## Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ELIZA Game (Tauri App)                  │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │   Frontend      │  │     Container Orchestrator      │  │
│  │ (React/Vite)    │  │      (Rust + Podman)           │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │ manages via podman
                            ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │     Ollama      │    │  Agent Server   │
│   (pgvector)    │◄───┤   (AI Models)   │◄───┤   (ElizaOS)     │
│   Port: 5432    │    │   Port: 11434   │    │   Port: 7777    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ▲                       ▲                       ▲
        └───────────────────────┼───────────────────────┘
                  eliza-network (podman network)
```

## Built-in Container Management

The Tauri app provides:
- **Runtime Detection** - Auto-detects podman/docker
- **Progress Tracking** - Visual setup progress
- **Health Monitoring** - Container health checks
- **Network Management** - Creates `eliza-network`
- **Volume Management** - Persistent data storage
- **Error Recovery** - Automatic restart/retry

## Environment Variables

See `.env.example` for all configuration options. The app reads:
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - AI provider keys
- `USE_SMALL_MODELS` - Use smaller models for development
- Container settings are managed automatically

## Troubleshooting

- **"Podman not found"**: Install podman first
- **"Permission denied"**: Run `podman system service --time=0` on Linux
- **Container start fails**: Check the app's built-in error logs
- **API key issues**: Check your `.env` file
- **Port conflicts**: The app handles port detection automatically

## Why Podman?

- **Rootless containers** - Better security
- **No daemon** - More reliable
- **Docker compatible** - Same commands/images
- **Better for desktop** - Lower resource usage

## Manual Container Management

If you need to debug containers manually:
```bash
# List running containers
podman ps

# View logs
podman logs eliza-postgres
podman logs eliza-ollama
podman logs eliza-agent

# Stop all ELIZA containers
podman stop eliza-postgres eliza-ollama eliza-agent
```