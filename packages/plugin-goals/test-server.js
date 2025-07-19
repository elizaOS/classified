import http from 'http';

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = req.url;
  const urlParams = new URL(url, `http://localhost:${PORT}`);

  if (url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Plugin Goals Test Server</title>
</head>
<body>
    <h1>Plugin Goals Test Server</h1>
    <div id="test-container">
        <p>This is a test server for Goals plugin Cypress tests</p>
        <button id="create-goal">Create Goal</button>
        <div id="goals-list"></div>
    </div>
    <script>
        document.getElementById('create-goal').addEventListener('click', function() {
            document.getElementById('goals-list').innerHTML = '<p>Goal created successfully!</p>';
        });
    </script>
</body>
</html>
    `);
  } else if (url.startsWith('/api/goals')) {
    const agentId = urlParams.searchParams.get('agentId');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          goals: [
            { id: 1, title: 'Complete project', status: 'in_progress', agentId },
            { id: 2, title: 'Learn new skills', status: 'completed', agentId },
          ],
        },
      })
    );
  } else if (url === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'plugin-goals-test' }));
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>404 - Not Found</h1>');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Goals test server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Goals test server shutting down...');
  server.close(() => {
    console.log('Goals test server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Goals test server shutting down...');
  server.close(() => {
    console.log('Goals test server stopped');
    process.exit(0);
  });
});
