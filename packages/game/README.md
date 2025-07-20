# ELIZA Game - AI Agent Sandbox Terminal

A comprehensive game interface for interacting with autonomous AI agents built on ElizaOS. Features real-time chat, autonomous thinking mode, goal/task management, and complete agent capability control.

## Features

- 🤖 **Autonomous AI Agent** - Real ElizaOS agent with independent thinking
- 💬 **Real-time Chat** - Natural conversation interface with WebSocket communication
- 🧠 **Autonomy Control** - Enable/disable autonomous thinking mode
- 📋 **Goals & Tasks** - View and manage agent's self-generated objectives
- 🧭 **Agent Capabilities** - Toggle plugins (shell, browser, vision, etc.)
- 👁️ **Monologue View** - See the agent's internal thought process
- 📁 **Knowledge Management** - File upload and knowledge base interaction
- ⚙️ **Agent Configuration** - Customize model settings and behavior
- 🧪 **Comprehensive Testing** - Full test suite with real API validation

## Prerequisites

- Node.js 20+ (recommended: use fnm or nvm)
- Bun (recommended) or npm
- Git
- OpenAI API key and/or Anthropic API key

## Quick Start

### Installation

```bash
# Clone the ElizaOS repository
git clone https://github.com/ai16z/eliza.git
cd eliza

# Install dependencies
npm install

# Navigate to game package
cd packages/game

# Install game-specific dependencies
npm install
```

### Configuration

Create a `.env` file in the project root with your API keys:

```env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Running the Game

```bash
# Run comprehensive test suite (recommended first run)
npm run test

# Start development environment
npm run dev

# Or run components separately
npm run dev:backend  # Backend on port 7777
npm run dev:frontend # Frontend on port 5173
```

Visit http://localhost:5173 to access the game interface.

## Testing

The project includes a comprehensive test suite that validates real functionality:

### Running Tests

```bash
# Run full test suite (API + E2E + Autonomy)
npm run test

# Open Cypress test runner
npm run test:open
```

### Test Coverage

- ✅ **API Integration Tests** - All endpoints verified with real requests
- ✅ **Autonomy Functionality** - Enable/disable/toggle operations tested
- ✅ **Frontend Integration** - UI component interactions validated
- ✅ **Real Agent Runtime** - Tests against actual ElizaOS agent
- ✅ **Error Handling** - Graceful failure scenarios covered
- ✅ **Production Ready** - No mocks, tests real system integration

### Test Philosophy

- **Real API Keys** - Tests use actual AI models (OpenAI/Anthropic)
- **Live Database** - PGLite in-memory database for testing
- **No Mocks** - Tests validate real system integration
- **Comprehensive** - Tests both API and UI functionality

## Architecture

### Backend (`src-backend/`)

- **`server.ts`** - Main server entry point using ElizaOS AgentServer
- **`game-api-plugin.ts`** - Custom API routes plugin for game interface  
- **`terminal-character.ts`** - Agent character configuration and personality
- **ElizaOS Runtime** - Real autonomous agent with plugin ecosystem
- **PGLite Database** - In-memory PostgreSQL for development/testing

### Frontend (`src/`)

- **React + Vite** - Modern frontend stack with TypeScript
- **`GameInterface.tsx`** - Main game component with chat and controls
- **Real-time WebSocket** - Live agent communication via socket.io
- **Terminal UI** - Retro aesthetic with modern functionality
- **Responsive Design** - Works on desktop and mobile

### Key Components

- **Autonomy System** - Independent agent thinking and goal setting
- **Plugin Management** - Dynamic control over agent capabilities  
- **Memory System** - Persistent conversation and learning storage
- **Testing Framework** - Comprehensive validation of all systems

## API Endpoints

The game provides a comprehensive REST API for agent interaction:

### Core APIs

```bash
# Health check
GET /api/server/health

# Agent data
GET /api/goals      # Agent's self-generated goals
GET /api/todos      # Agent's task list  
GET /api/memories   # Conversation history

# Agent settings
GET /api/agents/default/settings/vision
POST /api/agents/default/settings
```

### Autonomy Control

```bash
# Status
GET /autonomy/status

# Control
POST /autonomy/enable   # Enable autonomous thinking
POST /autonomy/disable  # Disable autonomous thinking
POST /autonomy/toggle   # Toggle current state
```

### Capability Management

```bash
# Shell access
GET /api/agents/default/capabilities/shell
POST /api/agents/default/capabilities/shell/toggle

# Browser automation
GET /api/agents/default/capabilities/browser  
POST /api/agents/default/capabilities/browser/toggle

# Vision/camera
POST /api/agents/default/vision/refresh
```

## Autonomy System

The ELIZA Game features a complete autonomy system where the agent operates independently:

### Key Features

- **Starts by default** - Autonomy is enabled on first run
- **Independent thinking** - Agent generates autonomous thoughts and plans
- **Goal setting** - Creates and pursues self-directed objectives
- **Task management** - Breaks down goals into actionable todos
- **Real-time control** - Enable/disable via game interface or API

### Testing Autonomy

```bash
# Check current status
curl http://localhost:7777/autonomy/status

# Enable autonomous thinking
curl -X POST http://localhost:7777/autonomy/enable

# Disable autonomous thinking
curl -X POST http://localhost:7777/autonomy/disable

# Toggle state
curl -X POST http://localhost:7777/autonomy/toggle
```

### Monitoring Autonomy

- **Monologue View** - See agent's internal thoughts in real-time
- **Goals Panel** - View agent's self-generated objectives
- **Todos Panel** - Monitor agent's task planning
- **Status Indicator** - Visual feedback on autonomy state

## Configuration

### Environment Variables

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional
PORT=7777                    # Backend server port
DATABASE_PATH=./.elizadb     # Database storage path
LOG_LEVEL=info              # Logging verbosity
NODE_ENV=development        # Environment mode
```

### Character Customization

Customize the agent personality in `src-backend/terminal-character.ts`:

- **System prompt** - Core personality and behavior
- **Message examples** - Training data for conversation style  
- **Topics** - Areas of interest and expertise
- **Bio elements** - Character background and traits
- **Knowledge** - Initial files and information

## Development

### Available Scripts

```bash
npm run dev              # Start full development environment
npm run build            # Build for production
npm run test             # Run comprehensive test suite
npm run test:open        # Open Cypress test runner
npm run dev:backend      # Backend only (port 7777)
npm run dev:frontend     # Frontend only (port 5173)
npm run kill-processes   # Kill all running processes
```

### Development Workflow

1. **Make changes** to source code
2. **Run tests** with `npm run test` to verify functionality
3. **Start dev environment** with `npm run dev`
4. **Test in browser** at http://localhost:5173
5. **Verify autonomy** functionality via API or UI

### Code Style

- **TypeScript** - Strict typing throughout
- **React Hooks** - Modern functional components
- **ElizaOS Patterns** - Follow plugin architecture guidelines
- **Real Testing** - No mocks, test actual functionality

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
npm run kill-processes
npm run dev
```

**API connection errors:**
- Verify `.env` file has valid API keys
- Check backend is running on port 7777  
- Ensure no firewall blocking localhost

**Frontend not loading:**
- Clear browser cache and refresh
- Check browser console for errors
- Verify frontend is running on port 5173

**Agent not responding:**
- Check autonomy is enabled in capabilities panel
- Verify API keys are valid and have credits
- Look at browser console for WebSocket errors
- Check backend logs for runtime errors

**Tests failing:**
- Ensure API keys are valid
- Check no other processes using ports 7777/5173
- Run `npm run kill-processes` and retry
- Verify database permissions

### Logs and Debugging

- **Backend logs** - Terminal running `npm run dev:backend`
- **Frontend logs** - Browser developer tools console  
- **Agent logs** - Backend includes detailed ElizaOS runtime logs
- **Test logs** - `npm run test` provides comprehensive output
- **API testing** - Use curl or Postman to test endpoints directly

### Performance Tips

- **API Rate Limits** - Monitor API usage to avoid hitting limits
- **Memory Usage** - Agent maintains conversation history in memory
- **Database Size** - PGLite database grows with agent interactions
- **Resource Monitor** - Watch system resources during long sessions

## Production Deployment

```bash
# Build optimized version
npm run build

# Output files
# - dist-backend/server.js (backend)  
# - dist/ (frontend static files)

# Run production server
cd dist-backend
node server.js
```

For production deployment:
- Use environment variables for configuration
- Consider PostgreSQL instead of PGLite for persistence
- Implement proper logging and monitoring
- Set up reverse proxy (nginx) for static file serving

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add comprehensive tests
4. Run `npm run test` to verify all tests pass
5. Submit a pull request with detailed description

**Testing Requirements:**
- All new features must include tests
- Tests must use real API calls (no mocks)
- API endpoints must be validated
- UI interactions must have Cypress tests

## License

MIT License - see the main ElizaOS repository for complete details.
