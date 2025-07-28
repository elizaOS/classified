#!/bin/bash

# VNC Auto-start Script for ElizaOS Agent
# This script sets up a default terminal environment in the VNC display

echo "[VNC] Setting up default terminal environment..."

# Wait for display to be ready
sleep 3

# Check if DISPLAY is set
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:99
fi

# Create a tmux configuration if it doesn't exist
if [ ! -f ~/.tmux.conf ]; then
    cat > ~/.tmux.conf << 'EOF'
# ElizaOS tmux configuration
set -g default-terminal "xterm-256color"
set -g mouse on
set -g history-limit 10000

# Status bar customization
set -g status-bg black
set -g status-fg white
set -g status-left '#[fg=green][ElizaOS] '
set -g status-right '#[fg=yellow]%H:%M:%S'
set -g status-interval 1

# Pane borders
set -g pane-border-style fg=colour235
set -g pane-active-border-style fg=colour245

# Window titles
set -g window-status-format '#I:#W'
set -g window-status-current-format '#[fg=cyan,bold]#I:#W'

# Enable UTF-8
set -gq status-utf8 on
set -gq utf8 on

# Better key bindings
bind | split-window -h
bind - split-window -v
unbind '"'
unbind %
EOF
fi

# Start xterm with tmux session
echo "[VNC] Starting xterm with tmux session..."
DISPLAY=:99 xterm -geometry 140x40+50+50 \
    -fa 'Monospace' -fs 12 \
    -bg black -fg white \
    -title "ElizaOS Agent Terminal" \
    -e "bash -c 'tmux new-session -s eliza -d \"echo Welcome to ElizaOS Agent Terminal!; echo; echo Container: eliza-agent; echo Process: \$(ps aux | grep server | grep -v grep | head -1); echo; htop || top\" && tmux attach -t eliza'" &

# Give xterm time to start
sleep 2

# Start a second terminal for logs
echo "[VNC] Starting log viewer terminal..."
DISPLAY=:99 xterm -geometry 140x20+50+550 \
    -fa 'Monospace' -fs 10 \
    -bg '#1a1a1a' -fg '#00ff00' \
    -title "ElizaOS Agent Logs" \
    -e "bash -c 'echo Monitoring ElizaOS Agent Logs...; echo; tail -f /app/logs/*.log 2>/dev/null || echo No logs available yet.'" &

echo "[VNC] VNC terminal environment setup complete!" 