const express = require('express');
const path = require('path');
const { fileURLToPath } = require('url');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Enable JSON parsing
app.use(express.json());

// Serve the autonomy UI at /autonomy
app.get('/autonomy', (req, res) => {
  const indexPath = path.resolve(__dirname, '../../dist/index.html');
  if (fs.existsSync(indexPath)) {
    const htmlContent = fs.readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } else {
    res.status(404).send('Autonomy UI not found. Please run "bun run build:frontend" first.');
  }
});

// Serve static assets
app.use('/assets', express.static(path.resolve(__dirname, '../../dist/assets')));

// Mock autonomy state
let autonomyState = {
  enabled: false,
  interval: 30000,
};

// Mock API endpoints
app.get('/api/autonomy/status', (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: autonomyState.enabled,
      interval: autonomyState.interval,
      agentId: 'test-agent-id',
      characterName: 'Test Agent',
    },
  });
});

app.post('/api/autonomy/enable', (req, res) => {
  autonomyState.enabled = true;
  res.json({
    success: true,
    message: 'Autonomy enabled successfully',
    data: {
      enabled: true,
      interval: autonomyState.interval,
      agentId: 'test-agent-id',
    },
  });
});

app.post('/api/autonomy/disable', (req, res) => {
  autonomyState.enabled = false;
  res.json({
    success: true,
    message: 'Autonomy disabled successfully',
    data: {
      enabled: false,
      interval: autonomyState.interval,
      agentId: 'test-agent-id',
    },
  });
});

app.post('/api/autonomy/toggle', (req, res) => {
  autonomyState.enabled = !autonomyState.enabled;
  res.json({
    success: true,
    message: `Autonomy ${autonomyState.enabled ? 'enabled' : 'disabled'} successfully`,
    data: {
      enabled: autonomyState.enabled,
      interval: autonomyState.interval,
      agentId: 'test-agent-id',
    },
  });
});

app.post('/api/autonomy/interval', (req, res) => {
  const { interval } = req.body;

  if (!interval || typeof interval !== 'number' || interval < 1000) {
    return res.status(400).json({
      success: false,
      error: 'Invalid interval. Must be a number >= 1000 (milliseconds)',
    });
  }

  autonomyState.interval = interval;
  res.json({
    success: true,
    message: 'Autonomy interval updated successfully',
    data: {
      interval: autonomyState.interval,
      enabled: autonomyState.enabled,
      agentId: 'test-agent-id',
    },
  });
});

// Start server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
    console.log('Use Ctrl+C to stop');
  });
}

module.exports = app;
