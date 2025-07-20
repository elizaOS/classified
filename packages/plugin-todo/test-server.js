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

  if (url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Plugin Todo Test Server</title>
</head>
<body>
    <h1>Plugin Todo Test Server</h1>
    <div id="test-container">
        <p>This is a test server for Cypress tests</p>
        <button id="test-button">Test Button</button>
        <div id="result"></div>
    </div>
    <script>
        document.getElementById('test-button').addEventListener('click', function() {
            document.getElementById('result').textContent = 'Button clicked!';
        });
    </script>
</body>
</html>
    `);
  } else if (url.startsWith('/api/todos')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          todos: [
            { id: 1, title: 'Test Todo 1', completed: false },
            { id: 2, title: 'Test Todo 2', completed: true },
          ],
        },
      })
    );
  } else if (url === '/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'plugin-todo-test' }));
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>404 - Not Found</h1>');
  }
});

const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Test server shutting down...');
  server.close(() => {
    console.log('Test server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Test server shutting down...');
  server.close(() => {
    console.log('Test server stopped');
    process.exit(0);
  });
});
