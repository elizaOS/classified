# Eliza E2B Code Interpreter Plugin

This package provides secure code execution capabilities for the Eliza AI agent using E2B's isolated sandbox environments.

## 🚨 TL;DR - Quick Setup

**Just want your bot to execute code? Here's the fastest path:**

1. **Get E2B account** → https://e2b.dev
2. **Get your API key** → From E2B dashboard
3. **Add to `.env`:**
   ```bash
   E2B_API_KEY=your_e2b_api_key_here
   ```
4. **Add plugin to your character:**
   ```typescript
   const character = {
       plugins: ["@elizaos/plugin-e2b"]
   }
   ```
5. **Run:** `bun start`

⚠️ **Testing locally?** The plugin runs in mock mode without an API key - perfect for development!

## Features

- 🔒 **Secure Isolation** - Each code execution runs in isolated E2B sandboxes (Firecracker micro-VMs)
- 🐍 **Multi-Language Support** - Python, JavaScript, and other languages
- 📦 **Package Installation** - Install and use any packages (pip, npm, etc.)
- 💾 **Persistent Sessions** - Variables and files persist across code executions
- 🌐 **Internet Access** - Full network connectivity for data fetching and API calls
- 📊 **Rich Output** - Support for plots, charts, images, and multimedia results
- ⚡ **Fast Startup** - Sandboxes start in ~150ms
- 🔄 **Automatic Management** - Lifecycle management with cleanup and monitoring
- 📋 **Three Execution Modes** - Mock (testing), Local (development), Production (cloud)

## Prerequisites

- E2B account with API access (optional for production)
- Node.js and bun installed
- Docker (optional for local mode)

## 🚀 Quick Start

### Step 1: Get E2B Access

1. Sign up at https://e2b.dev
2. Navigate to your [Dashboard](https://e2b.dev/dashboard)
3. Copy your API key

### Step 2: Configure Environment Variables

Create or edit `.env` file in your project root:

```bash
# REQUIRED for production (get from E2B dashboard)
E2B_API_KEY=your_e2b_api_key_here

# Optional: Execution Mode Configuration
E2B_MODE=production              # Options: mock, local, production
E2B_SANDBOX_POOL_SIZE=2         # Number of sandboxes to maintain
E2B_RATE_LIMIT_PER_MIN=20       # Max executions per minute
E2B_EXECUTION_TIMEOUT=30000     # Execution timeout in ms
```

### Step 3: Add Plugin to Your Character

```typescript
// Your character should include the e2b plugin
const character = {
    name: "CodeHelper",
    // ... other config
    plugins: [
        "@elizaos/plugin-bootstrap",  // Required for basic functionality
        "@elizaos/plugin-e2b"         // E2B code execution
    ]
};
```

### Step 4: Run Your Bot

```bash
bun run start
```

Then ask your bot to execute code:
```
"Calculate the fibonacci sequence up to 10 using Python"
"Create a matplotlib chart showing sin and cos waves"
"Analyze this CSV data and show me statistics"
```

## 📋 Complete Configuration Reference

```bash
# Required for Production
E2B_API_KEY=                     # Your E2B API key

# Execution Mode
E2B_MODE=production             # Options: mock, local, production
                               # - mock: Simulated responses (default without API key)
                               # - local: Use Docker containers locally
                               # - production: Use E2B cloud infrastructure

# Local Mode Options
E2B_LOCAL_USE_DOCKER=true       # Use Docker for local execution (default: true)

# Resource Management
E2B_SANDBOX_POOL_SIZE=2         # Pre-warmed sandboxes (default: 2)
E2B_RATE_LIMIT_PER_MIN=20       # Rate limit per minute (default: 20)
E2B_EXECUTION_TIMEOUT=30000     # Timeout in ms (default: 30s)
E2B_MAX_OUTPUT_LENGTH=10000     # Max output chars (default: 10000)

# Advanced Settings
E2B_ENVIRONMENT=development     # Environment setting
E2B_SANDBOX_METADATA={}        # Default metadata for sandboxes
```

## 🎯 Common Use Cases

### Data Analysis & Visualization

```python
import pandas as pd
import matplotlib.pyplot as plt

# Load and analyze data
df = pd.read_csv('https://example.com/data.csv')
print(df.describe())

# Create visualization
plt.figure(figsize=(10, 6))
df.plot(kind='bar')
plt.title('Data Analysis')
plt.show()
```

### API Integration & Web Scraping

```python
import requests
from bs4 import BeautifulSoup

# API call
response = requests.get('https://api.github.com/user/repos')
repos = response.json()
print(f"Found {len(repos)} repositories")

# Web scraping
html = requests.get('https://example.com').text
soup = BeautifulSoup(html, 'html.parser')
title = soup.find('title').text
print(f"Page title: {title}")
```

### Machine Learning

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

# Load and train model
iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.2
)

model = RandomForestClassifier()
model.fit(X_train, y_train)

# Evaluate
accuracy = model.score(X_test, y_test)
print(f"Model accuracy: {accuracy:.2%}")
```

## 🔧 Troubleshooting

### "No E2B_API_KEY provided"

The plugin runs in mock mode without an API key - perfect for testing!

**For production:**
1. Get your API key from https://e2b.dev/dashboard
2. Add to `.env`: `E2B_API_KEY=your_key_here`
3. Restart your bot

### "Sandbox creation failed"

**Common causes:**
- Invalid API key
- Rate limit exceeded
- Network connectivity issues

**Solution:**
```bash
# Verify API key
curl -X GET "https://api.e2b.dev/sandboxes" \
  -H "X-API-Key: $E2B_API_KEY"

# Check E2B service status
https://status.e2b.dev
```

### Code Not Executing

**Checklist:**
- ✅ Is the plugin included in your character?
- ✅ Are you using proper code blocks with language specifiers?
- ✅ Check logs for "E2B Service initialized"
- ✅ Try a simple test: `print("Hello World")`

### Local Mode Issues

**Docker not available?**
```bash
# Disable Docker requirement
E2B_MODE=local
E2B_LOCAL_USE_DOCKER=false
```

## 📚 Advanced Features

### Execution Modes

**Mock Mode** (Default without API key):
- Returns simulated responses
- Perfect for testing and development
- No actual code execution
- Zero cost

**Local Mode**:
- Executes code locally using Docker
- Falls back to direct execution without Docker
- Good for development without API usage

**Production Mode**:
- Full E2B cloud infrastructure
- Complete isolation and security
- Support for all languages and features
- Requires API key

### Sandbox Management

```typescript
// Direct service usage
const e2bService = runtime.getService('e2b');

// Create custom sandbox
const sandboxId = await e2bService.createSandbox({
  timeoutMs: 600000,  // 10 minutes
  metadata: {
    userId: 'user123',
    purpose: 'data-analysis'
  }
});

// List active sandboxes
const sandboxes = e2bService.listSandboxes();
console.log(`Active sandboxes: ${sandboxes.length}`);

// Kill specific sandbox
await e2bService.killSandbox(sandboxId);
```

### File Operations

```typescript
// Write file to sandbox
await e2bService.writeFileToSandbox(
  sandboxId, 
  '/tmp/data.json',
  JSON.stringify(data)
);

// Read file from sandbox
const content = await e2bService.readFileFromSandbox(
  sandboxId,
  '/tmp/results.json'
);
```

### Custom Templates

```typescript
// Use specialized templates
const sandboxId = await e2bService.createSandbox({
  template: 'python-datascience',  // Pre-installed ML packages
  timeoutMs: 1800000  // 30 minutes
});
```

## 🧪 Development & Testing

```bash
# Run tests
bun test

# Run with debug logging  
DEBUG=e2b:* bun start

# Test in mock mode
E2B_MODE=mock bun start

# Test in local mode
E2B_MODE=local bun start
```

### Testing Checklist

1. **Test Mock Mode**: Default behavior without API key
2. **Test Code Detection**: Try various code formats
3. **Test Error Handling**: Invalid code, timeouts
4. **Monitor Logs**: Look for "E2B Service initialized"

## 🔒 Security Best Practices

- **Isolation**: Each sandbox is completely isolated
- **Timeouts**: Set appropriate execution timeouts
- **Rate Limiting**: Built-in rate limiting protection
- **Resource Limits**: CPU, memory, and disk limitations
- **Network Policies**: Controlled internet access
- **Automatic Cleanup**: Sandboxes auto-terminate

### Security Configuration

```typescript
// Secure sandbox creation
const sandboxId = await e2bService.createSandbox({
  timeoutMs: 300000,  // 5 minute limit
  metadata: {
    userId: runtime.userId,
    sessionId: runtime.sessionId,
    ip: request.ip,
    timestamp: Date.now()
  }
});
```

## 📊 Usage Patterns

### Basic Code Execution

The plugin automatically detects and executes code blocks:

````
Execute this Python code:
```python
print("Hello from E2B!")
```
````

### Interactive Sessions

Variables persist across executions in the same conversation:

```
First: "Set x = 10 in Python"
Then: "Now calculate x * 2"
Result: 20
```

### Package Installation

```python
# Packages can be installed on-demand
import subprocess
subprocess.run(["pip", "install", "requests"])

import requests
response = requests.get("https://api.example.com")
```

## 📖 Additional Resources

- [E2B Documentation](https://e2b.dev/docs)
- [E2B Python SDK](https://github.com/e2b-dev/e2b-python)
- [Sandbox Templates](https://e2b.dev/docs/sandbox-templates)
- [ElizaOS Documentation](https://github.com/elizaos/eliza)

## 🤝 Contributing

Contributions are welcome! Please:
1. Check existing issues first
2. Follow the code style
3. Add tests for new features
4. Update documentation

## 📝 License

This plugin is part of the ElizaOS project. See the main repository for license information.
