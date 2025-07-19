#!/bin/bash
set -e

echo "=== Starting ElizaOS AutoCoder Agent ==="
echo "Role: ${AGENT_ROLE:-unknown}"
echo "Task ID: ${TASK_ID:-unknown}"
echo "Agent ID: ${AGENT_ID:-unknown}"
echo "Room ID: ${ROOM_ID:-unknown}"

# Configure Git if credentials are provided
if [ -n "$GIT_USERNAME" ]; then
  echo "Configuring Git..."
  git config --global user.name "$GIT_USERNAME"
  git config --global user.email "$GIT_EMAIL"
  
  # Set up GitHub token for HTTPS auth if provided
  if [ -n "$GITHUB_TOKEN" ]; then
    git config --global credential.helper store
    echo "https://${GIT_USERNAME}:${GITHUB_TOKEN}@github.com" > ~/.git-credentials
  fi
fi

# Parse project context if provided
if [ -n "$PROJECT_CONTEXT" ]; then
  echo "Project context provided: $PROJECT_CONTEXT"
fi

# Create default agent config if not exists
if [ ! -f "/home/agent/.eliza/config.json" ]; then
  echo "Creating default agent configuration..."
  cat > /home/agent/.eliza/config.json << EOF
{
  "name": "autocoder-${AGENT_ROLE:-agent}",
  "plugins": ["autocoder", "github", "e2b-client"],
  "settings": {
    "communication": {
      "bridge": "websocket",
      "url": "${WEBSOCKET_URL:-ws://host.docker.internal:8080}",
      "room": "${ROOM_ID:-default}",
      "heartbeat": 10000
    },
    "git": {
      "username": "${GIT_USERNAME:-agent}",
      "email": "${GIT_EMAIL:-agent@elizaos.ai}"
    },
    "autocoder": {
      "role": "${AGENT_ROLE:-coder}",
      "specialization": "${SPECIALIZATION:-general}",
      "taskId": "${TASK_ID}"
    }
  }
}
EOF
fi

# Start health check server
echo "Starting health check server..."
node -e "
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      agentId: process.env.AGENT_ID,
      role: process.env.AGENT_ROLE,
      uptime: process.uptime() 
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.listen(8081, () => console.log('Health check server listening on port 8081'));
" &

# Wait for health server to start
sleep 2

# Change to Eliza directory
cd /home/agent/eliza

# Start the agent with the appropriate character
echo "Starting Eliza agent..."
if [ -f "/home/agent/.eliza/character.json" ]; then
  # Use custom character if provided
  npm run start -- --character /home/agent/.eliza/character.json
else
  # Use default autocoder character
  npm run start -- --character packages/plugin-autocoder/character.json
fi 