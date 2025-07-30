# ElizaOS Bidirectional Media Streaming Test Plan

## Overview

This document outlines the comprehensive testing procedure for the bidirectional video/audio streaming between the client (web UI/Tauri app) and the agent server with plugin-vision integration.

## Architecture Overview

### Client → Server Flow
1. **Client captures media**: Camera, microphone, screen share
2. **Tauri IPC**: Media data sent to Tauri backend
3. **WebSocket**: Tauri forwards to agent server
4. **Agent Server**: Stores in media buffers
5. **Plugin-Vision**: Processes media streams for AI vision

### Server → Client Flow
1. **VNC Server**: Agent's virtual desktop (X11 display :99)
2. **FFmpeg capture**: Grabs frames from virtual display
3. **WebSocket broadcast**: Sends frames to connected clients
4. **Client display**: Shows agent's screen in UI

## Test Scenarios

### 1. VNC Display Content Test
**Objective**: Verify VNC shows persistent content, not black screen

**Steps**:
1. Start containers: `podman compose up -d`
2. Connect VNC client to `localhost:5900`
3. Verify you see:
   - ElizaOS Agent Desktop terminal with live clock
   - System Status panel showing CPU/Memory
   - Both windows updating in real-time

**Expected Result**: Active, updating content visible in VNC

### 2. Agent Screen Capture Test
**Objective**: Verify FFmpeg captures frames from virtual display

**Steps**:
1. Start screen capture:
   ```bash
   curl -X POST http://localhost:7777/api/agents/${AGENT_ID}/screen/start
   ```
2. Check latest frame:
   ```bash
   curl http://localhost:7777/api/agents/${AGENT_ID}/screen/latest
   ```
3. Monitor logs:
   ```bash
   podman logs -f eliza-agent | grep VirtualScreen
   ```

**Expected Result**: 
- Frame data returned (not empty)
- No FFmpeg errors in logs
- "Broadcasted frame to WebSocket clients" messages

### 3. Client Media Streaming Test
**Objective**: Test camera/mic/screen streaming from client

**Steps**:
1. Open messaging UI: `http://localhost:7777/messaging`
2. Click "Connect" to establish WebSocket
3. Enable Camera - grant permissions
4. Enable Microphone - grant permissions  
5. Enable Screen Share - select screen/window
6. Monitor browser console for errors

**Expected Result**:
- All media streams start without errors
- "Media stream acknowledged" messages in console
- Agent receives media (check server logs)

### 4. Browser Automation on VNC Test
**Objective**: Launch headful browser in agent's display

**Steps**:
1. Exec into container:
   ```bash
   podman exec -it eliza-agent bash
   ```
2. Launch browser:
   ```bash
   /tmp/launch_browser.sh
   ```
3. Watch VNC display

**Expected Result**: Chromium browser opens on VNC display

### 5. Stagehand Headful Mode Test
**Objective**: Test Stagehand browser automation in headful mode

**Steps**:
1. Set environment:
   ```bash
   export BROWSER_HEADLESS=false
   export DISPLAY=:99
   ```
2. Trigger browser action via agent
3. Monitor VNC display

**Expected Result**: Browser automation visible on VNC

### 6. Vision Plugin Integration Test
**Objective**: Verify plugin-vision receives media streams

**Steps**:
1. Enable vision plugin in agent config
2. Stream video from client
3. Check vision service logs:
   ```bash
   podman logs eliza-agent | grep -E "VisionService|processMediaStream"
   ```

**Expected Result**: 
- "Processing media stream" messages
- Vision service analyzes frames

### 7. End-to-End Flow Test
**Objective**: Full bidirectional streaming

**Steps**:
1. Open messaging UI with all media enabled
2. Start agent screen capture
3. Launch browser on agent VNC
4. Interact with agent about what it sees
5. Verify agent can:
   - See your camera/screen
   - Show its screen to you
   - Respond to visual queries

**Expected Result**: Complete bidirectional visual communication

## Troubleshooting

### Black VNC Screen
- Check Xvfb: `podman exec eliza-agent pgrep Xvfb`
- Check fluxbox: `podman exec eliza-agent pgrep fluxbox`
- Check xterm windows: `podman exec eliza-agent ps aux | grep xterm`
- Restart vnc-autostart: `podman exec eliza-agent /app/vnc-autostart.sh`

### Empty Frame Capture
- Check DISPLAY: `podman exec eliza-agent echo $DISPLAY`
- Test FFmpeg manually:
  ```bash
  podman exec eliza-agent ffmpeg -f x11grab -video_size 1280x720 -i :99 -vframes 1 -f mjpeg test.jpg
  ```
- Check FFmpeg installation: `podman exec eliza-agent which ffmpeg`

### WebSocket Connection Issues
- Check CORS headers in browser console
- Verify WebSocket URL matches protocol (ws:// for http, wss:// for https)
- Check firewall/proxy settings

### Media Permissions
- Browser requires HTTPS for camera/mic (except localhost)
- Check browser permissions for media devices
- Try different browser if issues persist

## Performance Monitoring

### Metrics to Track
- Frame capture rate (target: 10 FPS)
- WebSocket message latency
- CPU usage in container
- Memory usage
- Network bandwidth

### Commands
```bash
# Container resources
podman stats eliza-agent

# Frame capture rate
podman logs eliza-agent | grep "Broadcasted frame" | tail -20

# WebSocket connections
podman exec eliza-agent netstat -an | grep 7777
```

## Success Criteria

✅ VNC displays persistent, updating content (not black)
✅ Agent screen capture works without errors
✅ Client can stream camera/mic/screen to agent
✅ Agent screen streams to client via WebSocket
✅ Vision plugin receives and processes media
✅ Headful browser automation works on VNC
✅ Bidirectional visual communication functions
✅ Performance meets targets (10 FPS, low latency)

## Next Steps

1. GPU Acceleration: Add GPU support for better performance
2. Audio Streaming: Implement audio capture from agent
3. Multiple Displays: Support multiple virtual displays
4. Recording: Add session recording capabilities
5. Compression: Optimize frame compression for bandwidth