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

// Mock goals state
let goalsDatabase = [
  {
    id: 'goal-1',
    agentId: 'test-agent-id',
    ownerType: 'agent',
    ownerId: 'test-agent-id',
    name: 'Communicate with the admin',
    description: 'Establish and maintain communication with the admin user to understand their needs and provide assistance',
    isCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['communication', 'admin', 'relationship'],
    metadata: {}
  },
  {
    id: 'goal-2', 
    agentId: 'test-agent-id',
    ownerType: 'agent',
    ownerId: 'test-agent-id',
    name: 'Read the message from the founders',
    description: 'Find and read any important messages or documentation from the project founders to understand the mission',
    isCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['learning', 'founders', 'documentation'],
    metadata: {}
  }
];

// Mock agents endpoint
app.get('/api/agents', (req, res) => {
  res.json([
    {
      id: 'test-agent-id',
      name: 'Test Agent',
      character: {
        name: 'Test Agent',
        bio: 'A test agent for Cypress testing'
      }
    }
  ]);
});

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

// Goals API endpoints
app.get('/api/goals', (req, res) => {
  const { agentId } = req.query;
  
  if (!agentId) {
    return res.status(400).json({
      error: 'agentId query parameter is required'
    });
  }
  
  const agentGoals = goalsDatabase.filter(goal => goal.agentId === agentId);
  res.json(agentGoals);
});

app.post('/api/goals', (req, res) => {
  const { agentId } = req.query;
  const goalData = req.body;
  
  if (!agentId) {
    return res.status(400).json({
      error: 'agentId query parameter is required'
    });
  }
  
  if (!goalData.name || !goalData.name.trim()) {
    return res.status(400).json({
      error: 'Goal name is required'
    });
  }
  
  const newGoal = {
    id: `goal-${Date.now()}`,
    agentId: agentId,
    ownerType: goalData.ownerType || 'agent',
    ownerId: goalData.ownerId || agentId,
    name: goalData.name,
    description: goalData.description || '',
    isCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: goalData.tags || [],
    metadata: goalData.metadata || {}
  };
  
  goalsDatabase.push(newGoal);
  res.status(201).json(newGoal);
});

app.put('/api/goals/:id/complete', (req, res) => {
  const { id } = req.params;
  const { agentId } = req.query;
  
  const goal = goalsDatabase.find(g => g.id === id && g.agentId === agentId);
  if (!goal) {
    return res.status(404).json({
      error: 'Goal not found'
    });
  }
  
  goal.isCompleted = true;
  goal.updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    message: 'Goal completed successfully',
    task: goal
  });
});

app.put('/api/goals/:id/uncomplete', (req, res) => {
  const { id } = req.params;
  const { agentId } = req.query;
  
  const goal = goalsDatabase.find(g => g.id === id && g.agentId === agentId);
  if (!goal) {
    return res.status(404).json({
      error: 'Goal not found'
    });
  }
  
  goal.isCompleted = false;
  goal.updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    message: 'Goal marked as incomplete',
    task: goal
  });
});

app.delete('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  const { agentId } = req.query;
  
  const goalIndex = goalsDatabase.findIndex(g => g.id === id && g.agentId === agentId);
  if (goalIndex === -1) {
    return res.status(404).json({
      error: 'Goal not found'
    });
  }
  
  goalsDatabase.splice(goalIndex, 1);
  res.json({
    success: true,
    message: 'Goal deleted successfully'
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
