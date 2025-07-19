# ElizaOS Terminal

A retro terminal-style chat application for interacting with ElizaOS agents, featuring a 90s hacker aesthetic.

![Terminal Screenshot](./docs/screenshot.png)

## Features

- 🖥️ **Terminal-style UI**: Classic green-on-black terminal interface
- 💬 **Real-time Chat**: WebSocket-based communication with ElizaOS agents
- 📊 **System Monitor**: Live log streaming and process monitoring
- 🎮 **Command History**: Navigate through previous messages with arrow keys
- 🔌 **Offline Support**: Automatic reconnection and message queuing
- 🖼️ **Desktop App**: Built with Tauri for native performance

## Prerequisites

- Node.js 18+ and npm
- Rust (for Tauri development)
- An OpenAI API key (or other supported LLM provider)

## Installation

1. Clone the repository and navigate to the game package:

```bash
cd packages/game
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the package root:

```bash
cp .env.example .env
```

4. Add your OpenAI API key to the `.env` file:

```
OPENAI_API_KEY=your_api_key_here
```

## Development

### Running the Web Version

Start both the backend server and frontend development server:

```bash
npm run dev
```

The application will be available at:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Running the Desktop App

Build the backend and start the Tauri development environment:

```bash
npm run tauri:dev
```

## Building

### Web Build

```bash
npm run build
```

This creates:

- `dist/` - Frontend production build
- `dist-backend/` - Bundled backend server

### Desktop Build

```bash
npm run tauri:build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`.

## Testing

Run the E2E test suite:

```bash
npm run test:e2e
```

Run tests with UI mode:

```bash
npm run test:e2e:ui
```

## Architecture

The application consists of three main components:

### Backend Server

- Built on `@elizaos/server`
- Provides REST API and WebSocket endpoints
- Manages ElizaOS agent runtime
- Uses PGLite for local database storage

### Frontend

- React with TypeScript
- Terminal-inspired UI components
- Real-time WebSocket communication
- Command history and keyboard navigation

### Desktop Wrapper

- Tauri-based native application
- Bundles backend server with frontend
- Manages server lifecycle

## Configuration

### Environment Variables

| Variable         | Description               | Default     |
| ---------------- | ------------------------- | ----------- |
| `PORT`           | Server port               | 3000        |
| `OPENAI_API_KEY` | OpenAI API key            | Required    |
| `LOG_LEVEL`      | Logging level             | info        |
| `POSTGRES_URL`   | PostgreSQL URL (optional) | Uses PGLite |

### Character Customization

The Terminal agent personality can be customized in `src-backend/server.ts`. Modify the `terminalElizaCharacter` object to change:

- System prompt
- Message examples
- Topics of interest
- Communication style

## Keyboard Shortcuts

- `Enter` - Send message
- `Shift+Enter` - New line in message
- `↑` - Previous command (when input is empty)
- `↓` - Next command in history

## Troubleshooting

### Connection Issues

- Ensure the backend server is running on port 3000
- Check browser console for WebSocket errors
- Verify no firewall is blocking connections

### Agent Not Responding

- Check your OpenAI API key is valid
- Verify the backend server logs for errors
- Ensure you have API credits available

### Build Failures

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Ensure Rust is installed for Tauri builds
- Check you have sufficient disk space

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT
