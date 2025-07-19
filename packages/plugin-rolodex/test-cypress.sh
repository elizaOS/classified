#!/bin/bash

# Start the test server in background
echo "Starting test server..."
node cypress-server.js &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
sleep 3

# Check if server is responding
if curl -s http://localhost:3000/test-components > /dev/null; then
    echo "Server is ready, running Cypress tests..."
    # Run Cypress tests
    npx cypress run
    CYPRESS_EXIT_CODE=$?
else
    echo "Server failed to start"
    CYPRESS_EXIT_CODE=1
fi

# Stop the server
echo "Stopping test server..."
kill $SERVER_PID 2>/dev/null || true

# Exit with Cypress exit code
exit $CYPRESS_EXIT_CODE