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
    <title>Plugin Knowledge Test Server</title>
</head>
<body>
    <h1>Plugin Knowledge Test Server</h1>
    <div id="test-container">
        <p>This is a test server for Knowledge plugin Cypress tests</p>
        <button id="search-button">Search Knowledge</button>
        <div id="search-results"></div>
    </div>
    <script>
        document.getElementById('search-button').addEventListener('click', function() {
            document.getElementById('search-results').innerHTML = '<p>Search functionality would go here</p>';
        });
    </script>
</body>
</html>
    `);
  } else if (url.startsWith('/api/documents')) {
    const agentId = urlParams.searchParams.get('agentId');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          memories: [
            { id: 1, content: { text: 'Test document 1' }, agentId },
            { id: 2, content: { text: 'Test document 2' }, agentId },
          ],
        },
      })
    );
  } else if (url.startsWith('/api/search')) {
    const agentId = urlParams.searchParams.get('agentId');
    const query = urlParams.searchParams.get('q');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          results: [
            { id: 1, text: `Search result for "${query}"`, relevance: 0.9 },
            { id: 2, text: `Another result for "${query}"`, relevance: 0.7 },
          ],
        },
      })
    );
  } else if (url.startsWith('/api/knowledges')) {
    const agentId = urlParams.searchParams.get('agentId');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          chunks: [
            { id: 1, content: 'Knowledge chunk 1', agentId },
            { id: 2, content: 'Knowledge chunk 2', agentId },
          ],
        },
      })
    );
  } else if (url === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'plugin-knowledge-test' }));
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>404 - Not Found</h1>');
  }
});

const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
  console.log(`Knowledge test server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Knowledge test server shutting down...');
  server.close(() => {
    console.log('Knowledge test server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Knowledge test server shutting down...');
  server.close(() => {
    console.log('Knowledge test server stopped');
    process.exit(0);
  });
});
