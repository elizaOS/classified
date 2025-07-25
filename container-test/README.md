# Container Communication Test

This is a minimal Rust test project that validates the containerization communication between the ELIZA agent server and PostgreSQL containers using Socket.IO.

## What this test does

1. **Container Setup**: Starts PostgreSQL and agent server containers using Podman/Docker
2. **Network Configuration**: Creates an isolated network for container communication  
3. **Database Migration**: Waits for PostgreSQL to be ready and agent to complete migrations
4. **Socket.IO Connection**: Establishes a Socket.IO client connection to the agent server
5. **Message Flow Test**: Sends a message to the agent and waits for a response
6. **Cleanup**: Properly tears down all containers and networks

## Prerequisites

- Rust (latest stable)
- Podman or Docker installed and running
- OpenAI API key (set in `.env` file)
- Agent server container image built (`eliza-agentserver:latest`)

## Usage

1. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

2. **Build the agent server image** (if not already built):
   ```bash
   cd ../packages/game
   bun run build
   ```

3. **Run the test**:
   ```bash
   cargo run
   ```

The test will output detailed logs showing each step and whether the communication is working properly.

## What the test validates

- ✅ Container startup and networking
- ✅ PostgreSQL connection and readiness
- ✅ Agent server startup and health checks
- ✅ Socket.IO connection establishment
- ✅ Room joining functionality
- ✅ Message sending and receiving
- ✅ Proper cleanup and teardown

## Configuration

The test uses these default settings:
- PostgreSQL port: 5432
- Agent server port: 7777
- Network name: `eliza-test-network`
- Database: `eliza_game`
- User: `eliza`
- Password: `eliza_secure_pass`

## Troubleshooting

If the test fails:

1. **Check container runtime**: Ensure Podman/Docker is running
2. **Verify images**: Make sure `pgvector/pgvector:pg16` and `eliza-agentserver:latest` are available
3. **Port conflicts**: Ensure ports 5432 and 7777 are not in use
4. **API key**: Verify OPENAI_API_KEY is set correctly
5. **Logs**: Check the detailed logs for specific error messages

## Example output

```
INFO Starting container communication test
INFO Setting up test network: eliza-test-network
INFO Starting PostgreSQL container
INFO PostgreSQL is ready after 3 attempts
INFO Starting agent server container
INFO Agent server is ready after 12 attempts
INFO Connecting to Socket.IO server at: http://localhost:7777
INFO Connected to Socket.IO server
INFO Joining room: terminal-room-test
INFO Sending message to room terminal-room-test: Hello, agent! This is a test message.
INFO Received agent response: {"text":"Hello! I'm ELIZA...","senderId":"agent-123"}
INFO ✅ Container communication test completed successfully
```

This test serves as a reliable way to validate that your containerized setup is working correctly before running the full game application.