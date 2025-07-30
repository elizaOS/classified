# ElizaOS Bidirectional Media Streaming Setup

## Overview

This document provides complete setup instructions for the bidirectional video/audio streaming system between the ElizaOS client and agent server.

## Architecture

```
┌─────────────────┐                    ┌─────────────────────┐
│   Client Side   │                    │    Agent Server     │
│                 │                    │                     │
│ Camera ─────────┼──── WebSocket ────▶│ Media Buffers       │
│ Microphone ─────┼──── Streaming ────▶│ Plugin-Vision       │
│ Screen Share ───┘                    │                     │
│                                      │ Virtual Display :99 │
│ Display ◀────── WebSocket Broadcast ─┼─ FFmpeg Capture    │
│                                      │ VNC Server :5900    │
└─────────────────┘                    └─────────────────────┘
```

## Key Changes Made

### 1. **Docker Configuration**
- Added Chromium browser and dependencies for headful automation
- Installed x11-xserver-utils for xdpyinfo
- Installed net-tools for network diagnostics
- Exposed VNC port 5900 for remote desktop access

### 2. **Display Services**
- Enhanced start-with-display.sh with better logging
- Changed x11vnc to listen on all interfaces (0.0.0.0)
- Added longer startup delays for reliability
- Created persistent VNC content windows

### 3. **Automatic Screen Capture**
- Game API plugin now auto-starts screen capture after 15 seconds
- Added FFmpeg validation and error handling
- Improved frame validation (minimum size checks)
- Added WebSocket broadcasting integration

### 4. **Media Streaming**
- Fixed server instance availability for WebSocket broadcasting
- Added environment variables for media configuration
- Integrated with plugin-vision for AI processing

## Quick Start

### 1. Build and Start Containers

```bash
cd packages/agentserver

# Using podman (recommended)
podman compose down
podman compose build --no-cache
podman compose up -d

# Or using docker
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 2. Verify Services

Wait about 30 seconds for all services to initialize, then run:

```bash
./test-media-flow-complete.sh
```

Expected output:
```
=== 1. Infrastructure Tests ===
Testing: Server Health... ✓ PASSED
Testing: Database Connection... ✓ PASSED
Testing: WebSocket Endpoint... ✓ PASSED
Testing: Messaging UI Available... ✓ PASSED

=== 2. VNC Display Tests ===
✓ VNC Port 5900 accessible
✓ Xvfb display server running
✓ Fluxbox window manager running
✓ x11vnc server running
```

### 3. Connect to VNC

Use any VNC client to connect to `localhost:5900`:
- macOS: Screen Sharing app or RealVNC
- Windows: TightVNC or RealVNC
- Linux: Remmina or vncviewer

You should see:
- ElizaOS Agent Desktop window with live clock
- System Status panel showing CPU/Memory usage
- Both windows updating in real-time

### 4. Test Client Streaming

Open the messaging UI: http://localhost:7777/messaging

1. Click "Connect" to establish WebSocket connection
2. Enable Camera (grant permissions)
3. Enable Microphone (grant permissions)
4. Enable Screen Share (select window/screen)
5. Check browser console for any errors

### 5. Verify Agent Screen Streaming

The agent screen capture starts automatically after 15 seconds. To verify:

```bash
# Check if frames are being captured
curl http://localhost:7777/api/agents/2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f/screen/latest
```

You should see frame data in the response.

## Environment Variables

Configure these in docker-compose.yml or .env:

```env
# Display Configuration
DISPLAY=:99
BROWSER_HEADLESS=false

# Vision Configuration  
ENABLE_VISION=true
VISION_SCREEN_ENABLED=true
AUTO_START_VNC_CAPTURE=true

# API Keys (if using cloud services)
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
BROWSERBASE_API_KEY=your_key
```

## Troubleshooting

### VNC Shows Black Screen

1. Check display services:
```bash
podman exec eliza-agent /app/verify-display.sh
```

2. Restart VNC components:
```bash
podman exec eliza-agent bash -c "pkill xterm; /app/vnc-autostart.sh"
```

### Screen Capture Not Working

1. Check logs:
```bash
podman logs eliza-agent | grep -E "VirtualScreen|FFmpeg"
```

2. Test FFmpeg manually:
```bash
podman exec eliza-agent ffmpeg -f x11grab -video_size 1280x720 -i :99 -vframes 1 test.jpg
```

### WebSocket Connection Failed

1. Check CORS and protocol (ws:// vs wss://)
2. Ensure firewall allows WebSocket on port 7777
3. Check browser console for detailed errors

### No Media Permissions

1. Browser requires HTTPS for camera/mic (except localhost)
2. Check browser settings for blocked permissions
3. Try different browser if issues persist

## Advanced Usage

### Launch Browser on VNC

```bash
# Launch Chromium in the virtual display
podman exec eliza-agent bash -c 'DISPLAY=:99 chromium --no-sandbox --start-maximized https://example.com &'
```

### Monitor Performance

```bash
# Container resources
podman stats eliza-agent

# Frame capture rate
podman logs eliza-agent | grep "Broadcasted frame" | tail -20

# Active connections
podman exec eliza-agent netstat -an | grep 7777
```

### Enable Stagehand Headful Mode

Set `BROWSER_HEADLESS=false` in environment variables. Stagehand will then launch browsers on the virtual display visible through VNC.

## Architecture Details

### Media Buffers
- Located in game-api-plugin.ts
- Stores last 100 frames/audio chunks per agent
- Accessible by vision plugin for AI processing

### WebSocket Protocol
Messages use JSON format:
```json
{
  "type": "media_stream",
  "media_type": "video|audio", 
  "data": "base64_encoded_data",
  "encoding": "jpeg|pcm16",
  "timestamp": 1234567890
}
```

### Frame Capture
- Uses FFmpeg with x11grab input
- Captures at 10 FPS (100ms intervals)
- JPEG encoding with quality level 2
- Validates frame size (>1KB)

## Next Steps

1. **GPU Acceleration**: Add NVIDIA container toolkit for better performance
2. **Audio Capture**: Implement PulseAudio for agent audio streaming
3. **Compression**: Add H.264 video encoding for bandwidth efficiency
4. **Recording**: Implement session recording to disk
5. **Multi-Agent**: Support multiple displays per container

## Testing Checklist

- [ ] VNC displays persistent content (not black)
- [ ] Agent screen auto-captures after startup
- [ ] Client can stream camera to agent
- [ ] Client can stream microphone to agent
- [ ] Client can share screen to agent
- [ ] Agent screen streams to client via WebSocket
- [ ] Vision plugin receives media streams
- [ ] Browser automation visible on VNC
- [ ] No errors in container logs
- [ ] Performance acceptable (10 FPS, low latency)