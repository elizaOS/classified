# ElizaOS Terminal Setup Guide

## Quick Start

1. **Run the installer:**

   ```bash
   ./install.sh
   ```

2. **Configure your API key:**
   Edit the `.env` file and replace `your_openai_api_key_here` with your actual OpenAI API key.

3. **Start the application:**
   ```bash
   ./quick-start.sh
   ```

## Manual Setup

### 1. Create `.env` file

Create a `.env` file in the package root with the following content:

```env
# ElizaOS Terminal Environment Configuration

# Server Configuration
PORT=3000
SERVER_PORT=3000

# Database Configuration (optional - defaults to PGLite)
# POSTGRES_URL=postgresql://user:password@localhost:5432/elizaos

# LLM Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Model overrides
# MODEL_PROVIDER=openai
# TEXT_MODEL=gpt-4-turbo-preview

# Log Level
LOG_LEVEL=info

# Optional: CORS Configuration
# CORS_ORIGIN=*
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the backend

```bash
npm run build:backend
```

### 4. Start the application

```bash
npm run dev
```

## Testing

### Run all tests

```bash
./run-tests.sh
```

### Run visual tests (opens browser)

```bash
npm run test:visual
```

### Run tests in UI mode

```bash
npm run test:e2e:ui
```

## Troubleshooting

### Port already in use

If port 3000 is already in use:

```bash
lsof -ti:3000 | xargs kill -9
```

### OpenAI API errors

- Check your API key is valid
- Ensure you have credits in your OpenAI account
- Verify the API key has the necessary permissions

### WebSocket connection issues

- Check that the backend server is running
- Verify no firewall is blocking port 3000
- Try refreshing the browser
