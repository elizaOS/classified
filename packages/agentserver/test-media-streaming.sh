#!/bin/bash

echo "Testing bidirectional media streaming..."

# Wait for container to be ready
echo "Waiting for container to be ready..."
sleep 10

# Test API endpoints
echo -e "\n1. Testing media stream API..."
curl -X POST http://localhost:7777/api/media/stream \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":"Hello from test script"}' \
  -w "\nStatus: %{http_code}\n"

echo -e "\n2. Testing media status API..."
curl -X GET http://localhost:7777/api/media/status \
  -w "\nStatus: %{http_code}\n"

echo -e "\n3. Testing agent screen capture start..."
AGENT_ID=$(curl -s http://localhost:7777/api/agents | jq -r '.[0].id' || echo "default")
echo "Agent ID: $AGENT_ID"

curl -X POST "http://localhost:7777/api/agents/$AGENT_ID/screen/start" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

sleep 3

echo -e "\n4. Testing agent screen latest frame (JSON)..."
curl -s "http://localhost:7777/api/agents/$AGENT_ID/screen/latest" | jq '.success, .data.encoding, (.data.frame | length)' || echo "Failed to parse JSON"

echo -e "\n5. Testing agent screen latest frame (Raw Image)..."
curl -s "http://localhost:7777/api/agents/$AGENT_ID/screen/latest/image" -o /tmp/media-frame.jpg
if [ -f /tmp/media-frame.jpg ]; then
    file /tmp/media-frame.jpg
    echo "Frame size: $(ls -lh /tmp/media-frame.jpg | awk '{print $5}')"
else
    echo "Failed to download frame"
fi

echo -e "\n6. Testing WebSocket connection..."
wscat -c ws://localhost:7777/ws -x '{"type":"ping"}' -w 5 || echo "WebSocket test completed"

echo -e "\nMedia streaming test complete!"