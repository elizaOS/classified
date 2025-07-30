#!/bin/bash

# Display Verification Script
# Runs inside the container to verify all display components are working

echo "=== ElizaOS Display Verification ==="
echo "Time: $(date)"
echo ""

# Check environment
echo "1. Environment Variables:"
echo "   DISPLAY=$DISPLAY"
echo "   XVFB_SCREEN_SIZE=$XVFB_SCREEN_SIZE"
echo ""

# Check processes
echo "2. Running Processes:"
echo -n "   Xvfb: "
if pgrep Xvfb > /dev/null; then
    echo "✓ Running (PID: $(pgrep Xvfb))"
else
    echo "✗ Not running"
fi

echo -n "   fluxbox: "
if pgrep fluxbox > /dev/null; then
    echo "✓ Running (PID: $(pgrep fluxbox))"
else
    echo "✗ Not running"
fi

echo -n "   x11vnc: "
if pgrep x11vnc > /dev/null; then
    echo "✓ Running (PID: $(pgrep x11vnc))"
    # Get VNC port info
    VNC_INFO=$(ps aux | grep x11vnc | grep -v grep | head -1)
    echo "   VNC Info: $VNC_INFO"
else
    echo "✗ Not running"
fi

echo -n "   xterm windows: "
XTERM_COUNT=$(ps aux | grep xterm | grep -v grep | wc -l)
echo "$XTERM_COUNT running"
echo ""

# Check X11 display
echo "3. X11 Display Check:"
if command -v xdpyinfo > /dev/null 2>&1; then
    if xdpyinfo -display $DISPLAY > /dev/null 2>&1; then
        echo "   ✓ X11 display is accessible"
        # Get display info
        SCREEN_DIM=$(xdpyinfo -display $DISPLAY 2>/dev/null | grep dimensions | awk '{print $2}')
        echo "   Screen dimensions: $SCREEN_DIM"
    else
        echo "   ✗ X11 display not accessible"
    fi
else
    echo "   ⚠ xdpyinfo not installed"
fi
echo ""

# Check FFmpeg
echo "4. FFmpeg Check:"
if command -v ffmpeg > /dev/null 2>&1; then
    echo "   ✓ FFmpeg installed"
    # Test frame capture
    echo -n "   Testing frame capture: "
    if timeout 5 ffmpeg -f x11grab -video_size 1280x720 -i $DISPLAY -vframes 1 -f mjpeg - > /tmp/test.jpg 2>/dev/null; then
        FILE_SIZE=$(stat -c%s /tmp/test.jpg 2>/dev/null || echo "0")
        if [ "$FILE_SIZE" -gt 1000 ]; then
            echo "✓ Success (captured ${FILE_SIZE} bytes)"
        else
            echo "✗ Failed (file too small: ${FILE_SIZE} bytes)"
        fi
        rm -f /tmp/test.jpg
    else
        echo "✗ Failed to capture"
    fi
else
    echo "   ✗ FFmpeg not installed"
fi
echo ""

# Check network
echo "5. Network Ports:"
echo -n "   VNC port 5900: "
if netstat -tln 2>/dev/null | grep -q ":5900"; then
    echo "✓ Listening"
else
    echo "✗ Not listening"
fi

echo -n "   Agent port 7777: "
if netstat -tln 2>/dev/null | grep -q ":7777"; then
    echo "✓ Listening"
else
    echo "✗ Not listening"
fi
echo ""

# Check Chrome/Chromium
echo "6. Browser Check:"
for browser in chromium chromium-browser google-chrome; do
    echo -n "   $browser: "
    if command -v $browser > /dev/null 2>&1; then
        echo "✓ Installed"
        BROWSER_FOUND=$browser
        break
    else
        echo "✗ Not found"
    fi
done

if [ -n "$BROWSER_FOUND" ]; then
    echo "   Testing browser launch..."
    if timeout 5 $BROWSER_FOUND --version > /dev/null 2>&1; then
        echo "   ✓ Browser executable works"
    else
        echo "   ✗ Browser executable failed"
    fi
fi
echo ""

echo "=== Verification Complete ===